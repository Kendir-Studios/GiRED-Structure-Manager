(() => {
    "use strict";

    const SA_BADGE_CLASS = "gired-structure-mapper-sa";
    const AT_BADGE_CLASS = "gired-structure-mapper-at";
    const MENU_BADGE_CLASS = "gired-structure-mapper-menu-badge";
    const SUBSECTIONS_SELECTOR = '[data-testid="section-card__subsections"]';
    const SUBSECTION_SELECTOR = '[data-testid="subsection-card"]';
    const SUBSECTION_HEADER_SELECTOR = '[data-testid="subsection-card-header"]';
    const SUBSECTION_TITLE_SELECTOR = ".subsection-card-title";
    const UNITS_SELECTOR = '[data-testid="subsection-card__units"]';
    const UNIT_SELECTOR = '[data-testid="unit-card"]';
    const UNIT_HEADER_SELECTOR = '[data-testid="unit-card-header"]';
    const UNIT_TITLE_SELECTOR = ".unit-card-title";
    const CONTEXT_CLASS = "gired-structure-mapper-context";
    const STORAGE_KEY = "giredStructureMapperContextV1";
    const ROUTE_MAP_KEY = "giredStructureMapperRoutesV1";

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

    /** Lê JSON do armazenamento local sem interromper o GiRED em caso de erro. */
    function readStorage(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    /** Guarda JSON no armazenamento local do browser. */
    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            // O mapper continua funcional mesmo que o armazenamento esteja indisponível.
        }
    }

    /** Normaliza um destino para permitir reconhecer a mesma AT após navegação. */
    function normalizeUrl(value) {
        try {
            const url = new URL(value, location.href);
            return `${url.origin}${url.pathname}${url.search}`;
        } catch (_) {
            return value || "";
        }
    }

    /** Guarda o contexto atual e associa o destino da AT ao respetivo SA/AT. */
    function saveContext(context, href) {
        writeStorage(STORAGE_KEY, context);
        if (!href) return;

        const routes = readStorage(ROUTE_MAP_KEY, {});
        routes[normalizeUrl(href)] = context;
        writeStorage(ROUTE_MAP_KEY, routes);
    }

    /** Regista os links existentes na estrutura, preservando o SA e AT de cada destino. */
    function indexStructureRoutes() {
        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saTitle = normalizeText(subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent);
                const saCode = `SA ${formatNumber(saIndex + 1)}`;

                getUnits(subsection).forEach((unit, atIndex) => {
                    const title = unit.querySelector(UNIT_TITLE_SELECTOR);
                    const link = title?.closest("a");
                    if (!title || !link?.href) return;

                    const atCode = atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`;
                    const context = {
                        saCode,
                        saName: saTitle,
                        atCode,
                        atName: normalizeText(title.textContent)
                    };

                    const routes = readStorage(ROUTE_MAP_KEY, {});
                    routes[normalizeUrl(link.href)] = context;
                    writeStorage(ROUTE_MAP_KEY, routes);
                });
            });
        });
    }

    /** Obtém o contexto associado à página atual ou, como fallback, ao último clique. */
    function getCurrentContext() {
        const routes = readStorage(ROUTE_MAP_KEY, {});
        return routes[normalizeUrl(location.href)] || readStorage(STORAGE_KEY, null);
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

    /** Mostra no topo um breadcrumb discreto com o SA/AT atualmente aberto. */
    function updateContextIndicator() {
        const context = getCurrentContext();
        let indicator = document.querySelector(`.${CONTEXT_CLASS}`);

        // O GiRED é uma SPA e pode manter a estrutura antiga escondida no DOM.
        // Só ocultamos o indicador quando a estrutura está realmente visível.
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

    /** Guarda imediatamente o contexto quando o utilizador entra numa AT. */
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

        saveContext({
            saCode: `SA ${formatNumber(saIndex + 1)}`,
            saName: normalizeText(subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent),
            atCode: atIndex === 0 ? "INTROD" : `AT ${formatNumber(atIndex)}`,
            atName: normalizeText(unit.querySelector(UNIT_TITLE_SELECTOR)?.textContent)
        }, link.href);
    }

    /** Numera SAs, ATs e os respetivos itens nos menus. */
    function updateStructureNumbers() {
        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                applySaBadge(subsection, saIndex);
                getUnits(subsection).forEach((unit, atIndex) => applyAtBadge(unit, atIndex));
            });
        });

        const { saMap, atMap } = buildStructureMaps();
        updateNavigationMenus(saMap, atMap);
        indexStructureRoutes();
        updateContextIndicator();
    }

    /** Agenda uma atualização para o próximo frame. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(() => {
            updateScheduled = false;
            updateStructureNumbers();
        });
    }

    /** Observa carregamentos, dropdowns e reorganizações dinâmicas do GiRED. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevantChange = mutations.some(mutation => {
                if (mutation.target instanceof Element &&
                    mutation.target.closest(`.${SA_BADGE_CLASS}, .${AT_BADGE_CLASS}, .${MENU_BADGE_CLASS}`)) {
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
        updateStructureNumbers();
        startObserver();
        document.addEventListener("click", captureNavigation, true);
        document.addEventListener("click", scheduleUpdate, true);

        // Deteta também navegação interna de aplicações SPA.
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
