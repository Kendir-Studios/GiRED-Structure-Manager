(() => {
    "use strict";

    /** Hostnames do Studio (CMS) do GiRED: cms.gired.pt e variantes como gired-uat-cms.gired.pt. */
    const CMS_HOST_PATTERN = /(^|[.-])cms[.]gired[.]pt$/;

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

    // A mesma unidade aparece com URLs diferentes: Studio antigo (`/container/<vertical>`),
    // unit page do micro-frontend (`/authoring/course/<curso>/container/<vertical>/<sequential>`)
    // e o Studio incorporado nessa página (`/container_embed/<vertical>`).
    const VERTICAL_LOCATOR_PATTERN = /block-v1:[^/?#&\s"']*\+type@vertical\+block@[^/?#&\s"']+/;
    const BLOCK_LOCATOR_PATTERN = /block-v1:[^/?#&\s"']+/;
    const MFE_UNIT_PATH_PATTERN = /\/authoring\/course\/[^/]+\/container\/([^/]+)(?:\/([^/]+))?/;
    const UNIT_IFRAME_SELECTOR = "iframe.course-unit__xblock-iframe";
    const APPS_HOST_PATTERN = /(^|[.-])apps(?=[.]gired[.]pt$)/;

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
        if (!CMS_HOST_PATTERN.test(location.hostname)) return;
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

    /** Descodifica um URL sem rebentar com percentagens soltas. */
    function safeDecode(value) {
        try { return decodeURIComponent(value); } catch (_) { return value; }
    }

    /** Locator da unidade (vertical) presente num URL ou identificador, se existir. */
    function verticalLocatorOf(value) {
        return safeDecode(value || "").match(VERTICAL_LOCATOR_PATTERN)?.[0] || "";
    }

    /** Qualquer locator de bloco presente num URL (ex.: `?show=block-v1:...`). */
    function blockLocatorOf(value) {
        return safeDecode(value || "").match(BLOCK_LOCATOR_PATTERN)?.[0] || "";
    }

    /** Locator de um filho devolvido pela API do Studio, venha ele no `url` ou num identificador. */
    function childVerticalLocator(child) {
        return verticalLocatorOf([child?.url, child?.usage_key, child?.id].filter(Boolean).join(" "));
    }

    /**
     * Chave de rota de um destino. Quando o URL identifica uma unidade, a chave é o próprio
     * locator, para a mesma AT ser reconhecida no Studio antigo, na unit page e no iframe.
     */
    function routeKey(value) {
        const vertical = verticalLocatorOf(value);
        if (vertical) return `vertical:${vertical}`;
        try {
            const url = new URL(value, location.href);
            url.hash = "";
            return `${url.origin}${url.pathname.replace(/\/+$/, "")}${url.search}`;
        } catch (_) { return value || ""; }
    }

    /** Guarda o contexto atual e associa o destino ao respetivo SA/AT. */
    async function saveContext(context, href) {
        writeLocalStorage(LEGACY_STORAGE_KEY, context);
        storedContextPromise = Promise.resolve(context);
        await writeExtensionStorage(STORAGE_KEY, context);
        if (!href) return;
        const route = routeKey(href);
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
                    const route = routeKey(link.href);
                    // Só reescrevemos o armazenamento quando alguma entrada muda de facto;
                    // antes disso, cada passagem serializava o mapa inteiro outra vez.
                    if (sameContext(routes[route], context)) return;
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

    /** Compara dois contextos campo a campo. */
    function sameContext(a, b) {
        return Boolean(a && b)
            && a.saCode === b.saCode && a.saName === b.saName
            && a.atCode === b.atCode && a.atName === b.atName;
    }

    /** Locator da unidade aberta nesta página (unit page do MFE, iframe ou Studio antigo). */
    function getPageVerticalLocator() {
        return verticalLocatorOf(location.href)
            || verticalLocatorOf(document.querySelector(".wrapper-xblock.level-page[data-locator]")?.getAttribute("data-locator"));
    }

    /** Indica se esta é a unit page do micro-frontend de autoria (frame principal). */
    function isMfeUnitPage() {
        return window === window.top && MFE_UNIT_PATH_PATTERN.test(location.pathname);
    }

    /** Indica se este documento é um iframe escondido nosso (ex.: a exportação da SA carrega unidades assim). */
    function isHiddenHelperFrame() {
        try { return Boolean(window.frameElement?.hidden); } catch (_) { return false; }
    }

    /** Origem do Studio: a própria no CMS; na unit page, a do iframe da unidade ou derivada do hostname. */
    function getStudioOrigin() {
        if (CMS_HOST_PATTERN.test(location.hostname)) return location.origin;
        const frame = document.querySelector(`${UNIT_IFRAME_SELECTOR}[src]`);
        try { if (frame) return new URL(frame.getAttribute("src"), location.href).origin; } catch (_) {}
        if (APPS_HOST_PATTERN.test(location.hostname)) {
            return `${location.protocol}//${location.hostname.replace(APPS_HOST_PATTERN, "$1cms")}`;
        }
        return "";
    }

    // Uma chamada por unidade e por página; o resultado fica no mapa de rotas partilhado.
    const studioContextPromises = new Map();

    /**
     * Deriva SA/AT da própria estrutura do Studio (`GET /xblock/container/<vertical>`, o mesmo
     * pedido que a unit page faz), para os códigos aparecerem mesmo sem a página de estrutura
     * ter sido visitada. Regista também as unidades irmãs, para Anterior/Seguinte não repetirem o pedido.
     */
    function deriveContextFromStudio(vertical) {
        if (!vertical || isHiddenHelperFrame()) return Promise.resolve(null);
        if (!studioContextPromises.has(vertical)) {
            studioContextPromises.set(vertical, loadContextFromStudio(vertical).catch(() => null));
        }
        return studioContextPromises.get(vertical);
    }

    async function loadContextFromStudio(vertical) {
        const origin = getStudioOrigin();
        if (!origin) return null;
        const response = await fetch(`${origin}/xblock/container/${vertical}`, {
            credentials: "include",
            headers: { Accept: "application/json" }
        });
        if (!response.ok) return null;
        const data = await response.json();

        // `ancestor_xblocks` vem da raiz para a unidade: [secção, subsecção], cada uma com os filhos.
        const [section, subsection] = Array.isArray(data?.ancestor_xblocks) ? data.ancestor_xblocks : [];
        const subsections = Array.isArray(section?.children) ? section.children : [];
        const units = Array.isArray(subsection?.children) ? subsection.children : [];
        if (!units.some(child => childVerticalLocator(child) === vertical)) return null;

        const sequential = blockLocatorOf(location.pathname.match(MFE_UNIT_PATH_PATTERN)?.[2]);
        let saIndex = sequential ? subsections.findIndex(child => blockLocatorOf(child?.url) === sequential) : -1;
        if (saIndex < 0) {
            saIndex = subsections.findIndex(child => normalizeText(child?.display_name) === normalizeText(subsection.title));
        }
        if (saIndex < 0) return null;

        const saCode = `SA ${formatNumber(saIndex + 1)}`;
        const saName = normalizeText(subsection.title);
        const routes = await getRouteMap();
        const localRoutes = getLegacyRoutes();
        let changed = false;
        let current = null;
        units.forEach((child, index) => {
            const locator = childVerticalLocator(child);
            if (!locator) return;
            const context = {
                saCode,
                saName,
                atCode: index === 0 ? "INTROD" : `AT ${formatNumber(index)}`,
                atName: normalizeText(child.display_name)
            };
            if (locator === vertical) current = context;
            const key = `vertical:${locator}`;
            if (sameContext(routes[key], context)) return;
            routes[key] = context;
            localRoutes[key] = context;
            changed = true;
        });
        if (changed) {
            writeLocalStorage(LEGACY_ROUTE_MAP_KEY, localRoutes);
            await writeExtensionStorage(ROUTE_MAP_KEY, routes);
        }
        return current;
    }

    /** Obtém o contexto associado à página atual ou o último contexto capturado. */
    async function getCurrentContext() {
        const currentRoute = routeKey(location.href);
        const routes = await getRouteMap();
        if (routes[currentRoute]) return routes[currentRoute];
        const localRoutes = getLegacyRoutes();
        if (localRoutes[currentRoute]) return localRoutes[currentRoute];
        const derived = await deriveContextFromStudio(getPageVerticalLocator());
        if (derived) return derived;
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
        if (!CMS_HOST_PATTERN.test(location.hostname)) return null;
        const context = await getCurrentContext();
        if (!context) return null;
        // No Studio incorporado na unit page só existe o nome da unidade; os dois códigos ficam à frente dele.
        const embedName = window !== window.top
            ? document.querySelector(".xblock-header-vertical .xblock-display-name")
            : null;
        if (embedName) {
            ensureCmsBadge(embedName, CMS_SA_BADGE_CLASS, context.saCode, "before");
            ensureCmsBadge(embedName, CMS_AT_BADGE_CLASS, context.atCode, "before");
            return context;
        }
        const saTarget = findVisibleTextElement(context.saName, ["main a", "main button", "main span", ".container a", ".container button", "body a", "body button", "body span"]);
        const atTarget = findVisibleTextElement(context.atName, ["main h1", "main h2", "main h3", ".container h1", ".container h2", ".container h3", "body h1", "body h2", "body h3"]);
        ensureCmsBadge(saTarget, CMS_SA_BADGE_CLASS, context.saCode, "after");
        ensureCmsBadge(atTarget, CMS_AT_BADGE_CLASS, context.atCode, "before");
        return context;
    }

    /** Códigos SA/AT na unit page do micro-frontend: migalhas, título e separadores das unidades. */
    async function updateMfeUnitPage() {
        if (!isMfeUnitPage()) return;
        const context = await getCurrentContext();
        if (context) {
            // A SA é a subsecção das migalhas; a AT é o título da unidade.
            ensureCmsBadge(document.querySelector("#breadcrumbs-dropdown-subsection > span.small"), CMS_SA_BADGE_CLASS, context.saCode, "after");
            const title = document.querySelector('[data-testid="unit-header-title"]');
            if (title) {
                let badge = title.querySelector(`:scope > .${CMS_AT_BADGE_CLASS}`);
                if (!badge) {
                    badge = document.createElement("span");
                    badge.className = CMS_AT_BADGE_CLASS;
                    badge.setAttribute("aria-hidden", "true");
                    title.prepend(badge);
                }
                if (badge.textContent !== context.atCode) badge.textContent = context.atCode;
            }
        }
        // Os separadores seguem a ordem das unidades da SA; o dropdown da subsecção, a ordem das SAs.
        const atCode = index => (index === 0 ? "INTROD" : `AT ${formatNumber(index)}`);
        document.querySelectorAll('.sequence-navigation a[data-testid="course-unit-btn"]')
            .forEach((tab, index) => setMenuBadge(tab, atCode(index)));
        document.querySelectorAll(".sequence-navigation-dropdown .dropdown-menu .btn")
            .forEach((tab, index) => setMenuBadge(tab, atCode(index)));
        document.querySelectorAll('[data-testid="breadcrumbs-subsection-dropdown-item"]')
            .forEach((item, index) => setMenuBadge(item, `SA ${formatNumber(index + 1)}`));
    }

    /** Mostra o indicador flutuante apenas fora do editor CMS. */
    async function updateContextIndicator() {
        let indicator = document.querySelector(`.${CONTEXT_CLASS}`);
        if (window !== window.top || CMS_HOST_PATTERN.test(location.hostname)) { indicator?.remove(); return; }
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
        await updateMfeUnitPage();
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
