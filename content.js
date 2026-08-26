(() => {
    "use strict";

    const SA_BADGE_CLASS = "gired-structure-mapper-sa";
    const AT_BADGE_CLASS = "gired-structure-mapper-at";
    const MENU_BADGE_CLASS = "gired-structure-mapper-menu-badge";
    const CMS_SA_BADGE_CLASS = "gired-structure-mapper-cms-sa";
    const CMS_AT_BADGE_CLASS = "gired-structure-mapper-cms-at";
    const SUBSECTIONS_SELECTOR = '[data-testid="section-card__subsections"]';
    const SUBSECTION_SELECTOR = '[data-testid="subsection-card"]';
    const SUBSECTION_HEADER_SELECTOR = '[data-testid="subsection-card-header"]';
    const SUBSECTION_TITLE_SELECTOR = ".subsection-card-title";
    const UNITS_SELECTOR = '[data-testid="subsection-card__units"]';
    const UNIT_SELECTOR = '[data-testid="unit-card"]';
    const UNIT_HEADER_SELECTOR = '[data-testid="unit-card-header"]';
    const UNIT_TITLE_SELECTOR = ".unit-card-title";
    const CONTEXT_CLASS = "gired-structure-mapper-context";
    const STORAGE_KEY = "giredStructureMapperContextV2";
    const ROUTE_MAP_KEY = "giredStructureMapperRoutesV2";
    const LEGACY_STORAGE_KEY = "giredStructureMapperContextV1";
    const LEGACY_ROUTE_MAP_KEY = "giredStructureMapperRoutesV1";

    let updateScheduled = false;
    let lastUrl = location.href;

    /** Formata um número com dois algarismos. */
    function formatNumber(value) { return String(value).padStart(2, "0"); }

    /** Normaliza texto para permitir correspondência segura entre estrutura e menus. */
    function normalizeText(value) { return (value || "").replace(/\s+/g, " ").trim(); }

    /** Obtém apenas as SAs diretamente pertencentes ao contentor indicado. */
    function getSubsections(container) {
        return Array.from(container.querySelectorAll(SUBSECTION_SELECTOR))
            .filter(subsection => subsection.closest(SUBSECTIONS_SELECTOR) === container);
    }

    /** Obtém apenas as ATs pertencentes à SA indicada. */
    function getUnits(subsection) {
        const unitsContainer = subsection.querySelector(UNITS_SELECTOR);
        if (!unitsContainer) return [];
        return Array.from(unitsContainer.querySelectorAll(UNIT_SELECTOR))
            .filter(unit => unit.closest(SUBSECTION_SELECTOR) === subsection);
    }

    /** Cria ou atualiza a etiqueta SA. */
    function applySaBadge(subsection, index) {
        const header = subsection.querySelector(SUBSECTION_HEADER_SELECTOR);
        const title = subsection.querySelector(SUBSECTION_TITLE_SELECTOR);
        if (!header || !title) return;
        const titleButton = title.closest("button");
        if (!titleButton) return;
        let badge = titleButton.querySelector(`.${SA_BADGE_CLASS}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = SA_BADGE_CLASS;
            badge.setAttribute("aria-hidden", "true");
            title.before(badge);
        }
        const text = `SA ${formatNumber(index + 1)}`;
        if (badge.textContent !== text) badge.textContent = text;
    }

    /** Cria ou atualiza a etiqueta AT dentro da respetiva SA. */
    function applyAtBadge(unit, index) {
        const header = unit.querySelector(UNIT_HEADER_SELECTOR);
        const title = unit.querySelector(UNIT_TITLE_SELECTOR);
        if (!header || !title) return;
        const titleLink = title.closest("a");
        if (!titleLink) return;
        let badge = titleLink.querySelector(`.${AT_BADGE_CLASS}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = AT_BADGE_CLASS;
            badge.setAttribute("aria-hidden", "true");
            title.before(badge);
        }
        const text = index === 0 ? "INTROD" : `AT ${formatNumber(index)}`;
        if (badge.textContent !== text) badge.textContent = text;
    }

    /** Constrói os mapas de nomes -> códigos a partir da própria estrutura do GiRED. */
    function buildStructureMaps() {
        const saMap = new Map();
        const atMap = new Map();
        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saName = normalizeText(subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent);
                if (saName) saMap.set(saName, `SA ${formatNumber(saIndex + 1)}`);
                getUnits(subsection).forEach((unit, atIndex) => {
                    const atName = normalizeText(unit.querySelector(UNIT_TITLE_SELECTOR)?.textContent);
                    if (atName) atMap.set(atName, atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`);
                });
            });
        });
        return { saMap, atMap };
    }

    /** Adiciona um badge a um item de menu sem duplicar elementos. */
    function setMenuBadge(item, code) {
        let badge = item.querySelector(`:scope > .${MENU_BADGE_CLASS}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = MENU_BADGE_CLASS;
            badge.setAttribute("aria-hidden", "true");
            item.prepend(badge);
        }
        if (badge.textContent !== code) badge.textContent = code;
        badge.classList.toggle("is-at", code.startsWith("AT"));
        badge.classList.toggle("is-introd", code === "INTROD");
    }

    /** Texto de um item de menu sem os badges, evitando o custo de clonar o nó. */
    function getMenuItemLabel(item) {
        // Só os badges diretos são nossos; um badge aninhado obriga ao caminho antigo.
        if (item.querySelector(`:scope > * .${MENU_BADGE_CLASS}`)) {
            const clone = item.cloneNode(true);
            clone.querySelectorAll(`.${MENU_BADGE_CLASS}`).forEach(el => el.remove());
            return normalizeText(clone.textContent);
        }
        let text = "";
        for (const node of item.childNodes) {
            if (node instanceof Element && node.classList.contains(MENU_BADGE_CLASS)) continue;
            text += node.textContent;
        }
        return normalizeText(text);
    }

    /** Adiciona códigos aos itens dos menus quando existe um mapa por nome. */
    function updateNavigationMenus(saMap, atMap) {
        document.querySelectorAll('.dropdown-menu a, .dropdown-menu button, [role="menu"] a, [role="menu"] button, [role="menuitem"], [role="option"]').forEach(item => {
            const label = getMenuItemLabel(item);
            const code = saMap.get(label) || atMap.get(label);
            if (code) setMenuBadge(item, code);
        });
    }

    /** Numera sequencialmente todos os itens dos dropdowns do CMS. */
    function updateCmsDropdowns(context) {
        if (location.hostname !== "cms.gired.pt") return;
        const menus = Array.from(document.querySelectorAll('.dropdown-menu, [role="menu"], [role="listbox"]')).filter(isElementVisible);

        menus.forEach(menu => {
            const items = Array.from(menu.querySelectorAll(':scope > li > a, :scope > li > button, :scope > a, :scope > button, :scope > [role="menuitem"], :scope > [role="option"]'))
                .filter(isElementVisible);
            if (items.length < 2) return;

            const labels = items.map(getMenuItemLabel);

            const containsCurrentSa = context?.saName && labels.includes(normalizeText(context.saName));
            const containsCurrentAt = context?.atName && labels.includes(normalizeText(context.atName));

            if (containsCurrentSa) {
                items.forEach((item, index) => setMenuBadge(item, `SA ${formatNumber(index + 1)}`));
            } else if (containsCurrentAt) {
                items.forEach((item, index) => setMenuBadge(item, index === 0 ? "INTROD" : `AT ${formatNumber(index)}`));
            }
        });
    }

    /** Lê JSON do localStorage como fallback. */
    function readLocalStorage(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
    }

    /** Guarda JSON no localStorage como fallback. */
    function writeLocalStorage(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    }

    /** Lê dados do armazenamento da extensão, partilhado entre tabs e domínios. */
    async function readExtensionStorage(key, fallback) {
        try {
            if (!chrome?.storage?.local) return fallback;
            const result = await chrome.storage.local.get(key);
            return result[key] ?? fallback;
        } catch (_) { return fallback; }
    }

    // O mapa de rotas cresce com o uso e era lido do storage (e o legado feito
    // JSON.parse) várias vezes por passagem; as caches vivem até o valor mudar.
    let routeMapPromise = null;
    let storedContextPromise = null;
    let legacyRoutesCache = null;

    /** Mapa de rotas partilhado, lido uma única vez até haver alterações. */
    function getRouteMap() {
        if (!routeMapPromise) routeMapPromise = readExtensionStorage(ROUTE_MAP_KEY, {});
        return routeMapPromise;
    }

    /** Último contexto guardado, lido uma única vez até haver alterações. */
    function getStoredContext() {
        if (!storedContextPromise) storedContextPromise = readExtensionStorage(STORAGE_KEY, null);
        return storedContextPromise;
    }

    /** Mapa de rotas legado do localStorage, sem repetir o JSON.parse. */
    function getLegacyRoutes() {
        if (legacyRoutesCache === null) legacyRoutesCache = readLocalStorage(LEGACY_ROUTE_MAP_KEY, {});
        return legacyRoutesCache;
    }

    /** Guarda dados no armazenamento da extensão. */
    async function writeExtensionStorage(key, value) {
        try { if (chrome?.storage?.local) await chrome.storage.local.set({ [key]: value }); } catch (_) {}
    }

    /** Normaliza um destino para reconhecer a mesma AT após navegação. */
    function normalizeUrl(value) {
        try {
            const url = new URL(value, location.href);
            url.hash = "";
            return `${url.origin}${url.pathname}${url.search}`;
        } catch (_) { return value || ""; }
    }

    /** Guarda o contexto atual e associa o destino ao respetivo SA/AT. */
    async function saveContext(context, href) {
        writeLocalStorage(LEGACY_STORAGE_KEY, context);
        storedContextPromise = Promise.resolve(context);
        await writeExtensionStorage(STORAGE_KEY, context);
        if (!href) return;
        const route = normalizeUrl(href);
        const localRoutes = getLegacyRoutes();
        localRoutes[route] = context;
        writeLocalStorage(LEGACY_ROUTE_MAP_KEY, localRoutes);
        const routes = await getRouteMap();
        routes[route] = context;
        await writeExtensionStorage(ROUTE_MAP_KEY, routes);
    }

    /** Regista os links da estrutura no mapa partilhado entre tabs. */
    async function indexStructureRoutes() {
        const routes = await getRouteMap();
        const localRoutes = getLegacyRoutes();
        let changed = false;
        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saName = normalizeText(subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent);
                getUnits(subsection).forEach((unit, atIndex) => {
                    const title = unit.querySelector(UNIT_TITLE_SELECTOR);
                    const link = title?.closest("a");
                    if (!title || !link?.href) return;
                    const context = {
                        saCode: `SA ${formatNumber(saIndex + 1)}`,
                        saName,
                        atCode: atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`,
                        atName: normalizeText(title.textContent)
                    };
                    const route = normalizeUrl(link.href);
                    // Só reescrevemos o armazenamento quando alguma entrada muda de facto;
                    // antes disso, cada passagem serializava o mapa inteiro outra vez.
                    const existing = routes[route];
                    if (existing
                        && existing.saCode === context.saCode && existing.saName === context.saName
                        && existing.atCode === context.atCode && existing.atName === context.atName) {
                        return;
                    }
                    routes[route] = context;
                    localRoutes[route] = context;
                    changed = true;
                });
            });
        });
        if (changed) {
            // Mantém o mapa dentro de um limite razoável, descartando as
            // entradas mais antigas (a ordem das chaves segue a inserção).
            const keys = Object.keys(routes);
            if (keys.length > 1500) {
                for (const key of keys.slice(0, keys.length - 1500)) {
                    delete routes[key];
                    delete localRoutes[key];
                }
            }
            writeLocalStorage(LEGACY_ROUTE_MAP_KEY, localRoutes);
            await writeExtensionStorage(ROUTE_MAP_KEY, routes);
        }
    }

    /** Obtém o contexto associado à página atual ou o último contexto capturado. */
    async function getCurrentContext() {
        const currentRoute = normalizeUrl(location.href);
        const routes = await getRouteMap();
        if (routes[currentRoute]) return routes[currentRoute];
        const localRoutes = getLegacyRoutes();
        if (localRoutes[currentRoute]) return localRoutes[currentRoute];
        return (await getStoredContext()) ?? readLocalStorage(LEGACY_STORAGE_KEY, null);
    }

    /** Indica se um elemento está realmente visível. */
    function isElementVisible(element) {
        if (!(element instanceof Element)) return false;
        // checkVisibility é uma única chamada nativa; o caminho antigo forçava
        // estilo e layout por elemento, o que pesava nos scans grandes.
        if (typeof element.checkVisibility === "function") {
            return element.checkVisibility({ checkVisibilityCSS: true });
        }
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    }

    /** Indica se a estrutura de SAs/ATs está visível. */
    function isStructurePageVisible() {
        return Array.from(document.querySelectorAll(SUBSECTIONS_SELECTOR)).some(isElementVisible);
    }

    /** Procura um elemento visível cujo texto corresponda ao nome indicado. */
    function findVisibleTextElement(name, selectors) {
        const normalizedName = normalizeText(name);
        if (!normalizedName) return null;
        for (const selector of selectors) {
            // Comparar o texto primeiro é barato; a verificação de visibilidade
            // (que força layout) fica só para os poucos candidatos que coincidem.
            for (const element of document.querySelectorAll(selector)) {
                if (normalizeText(element.textContent) !== normalizedName) continue;
                if (element.closest(`.${CMS_SA_BADGE_CLASS}, .${CMS_AT_BADGE_CLASS}`)) continue;
                if (isElementVisible(element)) return element;
            }
        }
        return null;
    }

    /** Cria uma etiqueta do editor CMS sem duplicar elementos. */
    function ensureCmsBadge(target, className, text, placement) {
        if (!target?.parentElement) return;
        let badge = target.parentElement.querySelector(`:scope > .${className}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = className;
            badge.setAttribute("aria-hidden", "true");
            placement === "before" ? target.before(badge) : target.after(badge);
        }
        if (badge.textContent !== text) badge.textContent = text;
    }

    /** Integra SA e AT diretamente no cabeçalho do editor CMS. */
    async function updateCmsHeader() {
        if (location.hostname !== "cms.gired.pt") return null;
        const context = await getCurrentContext();
        if (!context) return null;
        const saTarget = findVisibleTextElement(context.saName, ["main a", "main button", "main span", ".container a", ".container button", "body a", "body button", "body span"]);
        const atTarget = findVisibleTextElement(context.atName, ["main h1", "main h2", "main h3", ".container h1", ".container h2", ".container h3", "body h1", "body h2", "body h3"]);
        ensureCmsBadge(saTarget, CMS_SA_BADGE_CLASS, context.saCode, "after");
        ensureCmsBadge(atTarget, CMS_AT_BADGE_CLASS, context.atCode, "before");
        return context;
    }

    /** Mostra o indicador flutuante apenas fora do editor CMS. */
    async function updateContextIndicator() {
        let indicator = document.querySelector(`.${CONTEXT_CLASS}`);
        if (location.hostname === "cms.gired.pt") { indicator?.remove(); return; }
        const context = await getCurrentContext();
        if (!context || isStructurePageVisible()) { indicator?.remove(); return; }
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.className = CONTEXT_CLASS;
            document.body.appendChild(indicator);
        }
        const codesText = `${context.saCode} / ${context.atCode}`;
        const nameText = context.atName || "";
        const currentCodes = indicator.querySelector(`.${CONTEXT_CLASS}__codes`)?.textContent || "";
        const currentName = indicator.querySelector(`.${CONTEXT_CLASS}__name`)?.textContent || "";
        if (currentCodes === codesText && currentName === nameText) return;
        indicator.innerHTML = "";
        const codes = document.createElement("span");
        codes.className = `${CONTEXT_CLASS}__codes`;
        codes.textContent = `${context.saCode} / ${context.atCode}`;
        indicator.appendChild(codes);
        if (context.atName) {
            const name = document.createElement("span");
            name.className = `${CONTEXT_CLASS}__name`;
            name.textContent = context.atName;
            indicator.appendChild(name);
        }
    }

    /** Guarda imediatamente o contexto quando o utilizador entra numa AT. */
    function captureNavigation(event) {
        const link = event.target instanceof Element ? event.target.closest("a") : null;
        const unit = link?.closest(UNIT_SELECTOR);
        const subsection = link?.closest(SUBSECTION_SELECTOR);
        const container = subsection?.closest(SUBSECTIONS_SELECTOR);
        if (!link || !unit || !subsection || !container) return;
        const saIndex = getSubsections(container).indexOf(subsection);
        const atIndex = getUnits(subsection).indexOf(unit);
        if (saIndex < 0 || atIndex < 0) return;
        void saveContext({
            saCode: `SA ${formatNumber(saIndex + 1)}`,
            saName: normalizeText(subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent),
            atCode: atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`,
            atName: normalizeText(unit.querySelector(UNIT_TITLE_SELECTOR)?.textContent)
        }, link.href);
    }

    /** Numera SAs, ATs, menus e cabeçalhos. */
    async function updateStructureNumbers() {
        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                applySaBadge(subsection, saIndex);
                getUnits(subsection).forEach((unit, atIndex) => applyAtBadge(unit, atIndex));
            });
        });
        const { saMap, atMap } = buildStructureMaps();
        updateNavigationMenus(saMap, atMap);
        await indexStructureRoutes();
        const context = await updateCmsHeader();
        updateCmsDropdowns(context);
        await updateContextIndicator();
    }

    /** Agenda uma atualização para o próximo frame. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(() => { updateScheduled = false; void updateStructureNumbers(); });
    }

    /** Observa carregamentos e dropdowns dinâmicos. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation => {
                if (mutation.target instanceof Element && mutation.target.closest(`.${SA_BADGE_CLASS}, .${AT_BADGE_CLASS}, .${MENU_BADGE_CLASS}, .${CONTEXT_CLASS}, .${CMS_SA_BADGE_CLASS}, .${CMS_AT_BADGE_CLASS}`)) return false;
                return mutation.type === "childList";
            });
            if (relevant) scheduleUpdate();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /** Inicializa o mapper. */
    function initialize() {
        void updateStructureNumbers();
        startObserver();
        document.addEventListener("click", captureNavigation, true);
        document.addEventListener("click", scheduleUpdate, true);
        if (chrome?.storage?.onChanged) chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;
            // O onChanged já traz o valor novo; atualizamos as caches sem nova leitura.
            if (changes[ROUTE_MAP_KEY]) routeMapPromise = Promise.resolve(changes[ROUTE_MAP_KEY].newValue ?? {});
            if (changes[STORAGE_KEY]) storedContextPromise = Promise.resolve(changes[STORAGE_KEY].newValue ?? null);
            if (changes[STORAGE_KEY] || changes[ROUTE_MAP_KEY]) scheduleUpdate();
        });
        window.setInterval(() => {
            if (location.href !== lastUrl) { lastUrl = location.href; scheduleUpdate(); }
        }, 400);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
})();
