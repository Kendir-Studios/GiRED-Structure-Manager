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
    function formatNumber(value) {
        return String(value).padStart(2, "0");
    }

    /** Normaliza texto para permitir correspondência segura entre estrutura e menus. */
    function normalizeText(value) {
        return (value || "").replace(/\s+/g, " ").trim();
    }

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

        badge.textContent = `SA ${formatNumber(index + 1)}`;
        badge.dataset.saIndex = String(index + 1);
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

        badge.textContent = index === 0 ? "INTROD" : `AT ${formatNumber(index)}`;
        badge.dataset.atIndex = String(index);
    }

    /** Constrói os mapas de nomes -> códigos a partir da própria estrutura do GiRED. */
    function buildStructureMaps() {
        const saMap = new Map();
        const atMap = new Map();

        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saTitle = subsection.querySelector(SUBSECTION_TITLE_SELECTOR);
                const saName = normalizeText(saTitle?.textContent);
                if (saName) saMap.set(saName, `SA ${formatNumber(saIndex + 1)}`);

                getUnits(subsection).forEach((unit, atIndex) => {
                    const atTitle = unit.querySelector(UNIT_TITLE_SELECTOR);
                    const atName = normalizeText(atTitle?.textContent);
                    if (atName) atMap.set(atName, atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`);
                });
            });
        });

        return { saMap, atMap };
    }

    /** Adiciona códigos aos itens dos dropdowns/menus de navegação do GiRED. */
    function updateNavigationMenus(saMap, atMap) {
        const candidates = document.querySelectorAll(
            '.dropdown-menu a, .dropdown-menu button, [role="menu"] a, [role="menu"] button, [role="menuitem"], [role="option"]'
        );

        candidates.forEach(item => {
            const existingBadge = item.querySelector(`.${MENU_BADGE_CLASS}`);
            const clone = item.cloneNode(true);
            clone.querySelectorAll(`.${MENU_BADGE_CLASS}`).forEach(el => el.remove());
            const label = normalizeText(clone.textContent);
            const code = saMap.get(label) || atMap.get(label);

            if (!code) {
                existingBadge?.remove();
                return;
            }

            let badge = existingBadge;
            if (!badge) {
                badge = document.createElement("span");
                badge.className = MENU_BADGE_CLASS;
                badge.setAttribute("aria-hidden", "true");
                item.prepend(badge);
            }

            badge.textContent = code;
            badge.classList.toggle("is-at", code.startsWith("AT"));
            badge.classList.toggle("is-introd", code === "INTROD");
        });
    }

    /** Lê JSON do localStorage como fallback de compatibilidade. */
    function readLocalStorage(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    /** Guarda JSON no localStorage como fallback de compatibilidade. */
    function writeLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            // O mapper continua funcional mesmo que o armazenamento esteja indisponível.
        }
    }

    /** Lê dados do armazenamento da extensão, partilhado entre tabs e domínios GiRED. */
    async function readExtensionStorage(key, fallback) {
        try {
            if (!chrome?.storage?.local) return fallback;
            const result = await chrome.storage.local.get(key);
            return result[key] ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    /** Guarda dados no armazenamento da extensão, partilhado entre tabs e domínios GiRED. */
    async function writeExtensionStorage(key, value) {
        try {
            if (!chrome?.storage?.local) return;
            await chrome.storage.local.set({ [key]: value });
        } catch (_) {
            // O fallback local continua disponível.
        }
    }

    /** Normaliza um destino para reconhecer a mesma AT após navegação ou numa nova tab. */
    function normalizeUrl(value) {
        try {
            const url = new URL(value, location.href);
            url.hash = "";
            return `${url.origin}${url.pathname}${url.search}`;
        } catch (_) {
            return value || "";
        }
    }

    /** Guarda o contexto atual e associa o destino da AT ao respetivo SA/AT. */
    async function saveContext(context, href) {
        writeLocalStorage(LEGACY_STORAGE_KEY, context);
        await writeExtensionStorage(STORAGE_KEY, context);
        if (!href) return;

        const route = normalizeUrl(href);
        const localRoutes = readLocalStorage(LEGACY_ROUTE_MAP_KEY, {});
        localRoutes[route] = context;
        writeLocalStorage(LEGACY_ROUTE_MAP_KEY, localRoutes);

        const routes = await readExtensionStorage(ROUTE_MAP_KEY, {});
        routes[route] = context;
        await writeExtensionStorage(ROUTE_MAP_KEY, routes);
    }

    /** Regista os links da estrutura no mapa partilhado entre tabs. */
    async function indexStructureRoutes() {
        const routes = await readExtensionStorage(ROUTE_MAP_KEY, {});
        const localRoutes = readLocalStorage(LEGACY_ROUTE_MAP_KEY, {});
        let changed = false;

        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saTitle = normalizeText(subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent);
                const saCode = `SA ${formatNumber(saIndex + 1)}`;

                getUnits(subsection).forEach((unit, atIndex) => {
                    const title = unit.querySelector(UNIT_TITLE_SELECTOR);
                    const link = title?.closest("a");
                    if (!title || !link?.href) return;

                    const context = {
                        saCode,
                        saName: saTitle,
                        atCode: atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`,
                        atName: normalizeText(title.textContent)
                    };
                    const route = normalizeUrl(link.href);
                    routes[route] = context;
                    localRoutes[route] = context;
                    changed = true;
                });
            });
        });

        if (changed) {
            writeLocalStorage(LEGACY_ROUTE_MAP_KEY, localRoutes);
            await writeExtensionStorage(ROUTE_MAP_KEY, routes);
        }
    }

    /** Obtém o contexto associado à página atual ou o último contexto capturado. */
    async function getCurrentContext() {
        const currentRoute = normalizeUrl(location.href);
        const routes = await readExtensionStorage(ROUTE_MAP_KEY, {});
        if (routes[currentRoute]) return routes[currentRoute];

        const localRoutes = readLocalStorage(LEGACY_ROUTE_MAP_KEY, {});
        if (localRoutes[currentRoute]) return localRoutes[currentRoute];

        return await readExtensionStorage(STORAGE_KEY, readLocalStorage(LEGACY_STORAGE_KEY, null));
    }

    /** Indica se um elemento está realmente visível no ecrã. */
    function isElementVisible(element) {
        if (!(element instanceof Element)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return element.getClientRects().length > 0;
    }

    /** Indica se a estrutura de SAs/ATs está efetivamente visível na página atual. */
    function isStructurePageVisible() {
        return Array.from(document.querySelectorAll(SUBSECTIONS_SELECTOR)).some(isElementVisible);
    }

    /** Procura um elemento visível cujo texto corresponda ao nome indicado. */
    function findVisibleTextElement(name, selectors) {
        const normalizedName = normalizeText(name);
        if (!normalizedName) return null;

        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            const exact = elements.find(element =>
                isElementVisible(element) &&
                !element.closest(`.${CMS_SA_BADGE_CLASS}, .${CMS_AT_BADGE_CLASS}`) &&
                normalizeText(element.textContent) === normalizedName
            );
            if (exact) return exact;
        }

        return null;
    }

    /** Cria uma etiqueta do editor CMS sem duplicar elementos. */
    function ensureCmsBadge(target, className, text, placement) {
        if (!target) return;
        const parent = target.parentElement;
        if (!parent) return;

        let badge = parent.querySelector(`:scope > .${className}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = className;
            badge.setAttribute("aria-hidden", "true");
            if (placement === "before") target.before(badge);
            else target.after(badge);
        }
        badge.textContent = text;
    }

    /** Integra SA e AT diretamente no cabeçalho do editor cms.gired.pt. */
    async function updateCmsHeader() {
        if (location.hostname !== "cms.gired.pt") return;

        const context = await getCurrentContext();
        if (!context) return;

        const saTarget = findVisibleTextElement(context.saName, [
            "main a", "main button", "main span", "main div",
            ".container a", ".container button", ".container span", ".container div",
            "body a", "body button", "body span"
        ]);

        const atTarget = findVisibleTextElement(context.atName, [
            "main h1", "main h2", "main h3", "main a", "main span", "main div",
            ".container h1", ".container h2", ".container h3",
            "body h1", "body h2", "body h3"
        ]);

        ensureCmsBadge(saTarget, CMS_SA_BADGE_CLASS, context.saCode, "after");
        ensureCmsBadge(atTarget, CMS_AT_BADGE_CLASS, context.atCode, "before");
    }

    /** Mostra o indicador flutuante apenas fora do editor CMS. */
    async function updateContextIndicator() {
        let indicator = document.querySelector(`.${CONTEXT_CLASS}`);

        if (location.hostname === "cms.gired.pt") {
            indicator?.remove();
            return;
        }

        const context = await getCurrentContext();
        if (!context || isStructurePageVisible()) {
            indicator?.remove();
            return;
        }

        if (!indicator) {
            indicator = document.createElement("div");
            indicator.className = CONTEXT_CLASS;
            indicator.setAttribute("aria-label", "Contexto RED");
            document.body.appendChild(indicator);
        }

        indicator.replaceChildren();
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

    /** Guarda imediatamente o contexto quando o utilizador entra numa AT, incluindo nova tab. */
    function captureNavigation(event) {
        const link = event.target instanceof Element ? event.target.closest("a") : null;
        if (!link) return;

        const unit = link.closest(UNIT_SELECTOR);
        const subsection = link.closest(SUBSECTION_SELECTOR);
        if (!unit || !subsection) return;

        const container = subsection.closest(SUBSECTIONS_SELECTOR);
        if (!container) return;

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

    /** Numera SAs, ATs e atualiza os cabeçalhos dos editores. */
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
        await updateCmsHeader();
        await updateContextIndicator();
    }

    /** Agenda uma atualização para o próximo frame. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(() => {
            updateScheduled = false;
            void updateStructureNumbers();
        });
    }

    /** Observa carregamentos, dropdowns e reorganizações dinâmicas do GiRED. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevantChange = mutations.some(mutation => {
                if (mutation.target instanceof Element &&
                    mutation.target.closest(`.${SA_BADGE_CLASS}, .${AT_BADGE_CLASS}, .${MENU_BADGE_CLASS}, .${CONTEXT_CLASS}, .${CMS_SA_BADGE_CLASS}, .${CMS_AT_BADGE_CLASS}`)) {
                    return false;
                }
                return mutation.type === "childList";
            });
            if (relevantChange) scheduleUpdate();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /** Inicializa o mapper quando o DOM está disponível. */
    function initialize() {
        void updateStructureNumbers();
        startObserver();
        document.addEventListener("click", captureNavigation, true);
        document.addEventListener("click", scheduleUpdate, true);

        if (chrome?.storage?.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === "local" && (changes[STORAGE_KEY] || changes[ROUTE_MAP_KEY])) {
                    scheduleUpdate();
                }
            });
        }

        window.setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                scheduleUpdate();
            }
        }, 400);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
