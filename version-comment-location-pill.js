(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOCATION_SELECTOR = ".course-vc-comment-location";
    const PILL_CLASS = "gired-structure-mapper-vc-location-pill";
    const ROUTE_MAP_KEY = "giredStructureMapperRoutesV2";
    const OUTLINE_SELECTOR = "#outline-sidebar-outline";

    const SUBSECTIONS_SELECTOR = '[data-testid="section-card__subsections"]';
    const SUBSECTION_SELECTOR = '[data-testid="subsection-card"]';
    const SUBSECTION_TITLE_SELECTOR = ".subsection-card-title";
    const UNITS_SELECTOR = '[data-testid="subsection-card__units"]';
    const UNIT_SELECTOR = '[data-testid="unit-card"]';
    const UNIT_TITLE_SELECTOR = ".unit-card-title";

    let updateScheduled = false;

    /** Formata um número com dois algarismos. */
    function formatNumber(value) {
        return String(value).padStart(2, "0");
    }

    /** Normaliza texto para comparar nomes da estrutura de forma estável. */
    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase("pt-PT");
    }

    /** Cria uma chave única baseada no nome da SA e no nome da AT. */
    function createNameKey(saName, atName) {
        return `${normalizeText(saName)}|||${normalizeText(atName)}`;
    }

    /** Remove espaços dos códigos para apresentar o formato compacto pedido. */
    function compactCode(code) {
        return String(code || "").replace(/\s+/g, "");
    }

    /** Obtém a assinatura do curso atual para não misturar mapas de recursos diferentes. */
    function getCurrentCourseSignature() {
        const match = location.href.match(/course-v1:([^/]+)/i);
        return match?.[1] || "";
    }

    /** Obtém apenas as SAs diretamente pertencentes ao contentor indicado. */
    function getSubsections(container) {
        return Array.from(container.querySelectorAll(SUBSECTION_SELECTOR))
            .filter(subsection => subsection.closest(SUBSECTIONS_SELECTOR) === container);
    }

    /** Obtém apenas as ATs diretamente pertencentes à SA indicada. */
    function getUnits(subsection) {
        const unitsContainer = subsection.querySelector(UNITS_SELECTOR);
        if (!unitsContainer) return [];

        return Array.from(unitsContainer.querySelectorAll(UNIT_SELECTOR))
            .filter(unit => unit.closest(SUBSECTION_SELECTOR) === subsection);
    }

    /**
     * Extrai os nomes da SA e da AT da localização apresentada pelo GiRED.
     * A estrutura esperada é: ignorar > ignorar > SA > AT.
     */
    function getNamesFromLocation(locationText) {
        const parts = String(locationText || "")
            .split(">")
            .map(part => part.trim())
            .filter(Boolean);

        if (parts.length < 4) return null;

        const saName = parts[2];
        const atName = parts[3];
        if (!saName || !atName) return null;

        return { saName, atName };
    }

    /**
     * Constrói o mapa diretamente a partir da Estrutura do recurso.
     * Esta é a fonte principal no ecrã de authoring porque contém todas as SAs e ATs
     * e usa exatamente a mesma numeração do Structure Mapper.
     */
    function buildAuthoringStructureCodeMap() {
        const map = new Map();

        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saName = subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent?.trim();
                if (!saName) return;

                getUnits(subsection).forEach((unit, atIndex) => {
                    const atName = unit.querySelector(UNIT_TITLE_SELECTOR)?.textContent?.trim();
                    if (!atName) return;

                    const saCode = `SA${formatNumber(saIndex + 1)}`;
                    const atCode = atIndex === 0 ? "INTROD" : `AT${formatNumber(atIndex)}`;
                    map.set(createNameKey(saName, atName), `${saCode}/${atCode}`);
                });
            });
        });

        return map;
    }

    /**
     * Constrói códigos diretamente a partir do outline da página do aluno.
     * Serve de fallback quando a Estrutura do recurso não está presente no DOM.
     */
    function buildOutlineCodeMap() {
        const map = new Map();
        const outline = document.querySelector(OUTLINE_SELECTOR);
        if (!outline) return map;

        const saItems = Array.from(outline.children).filter(element => element instanceof HTMLElement);

        saItems.forEach((saItem, saIndex) => {
            const saTitle = saItem.querySelector(":scope > .pgn_collapsible > .collapsible-trigger .align-middle");
            const saName = saTitle?.textContent?.trim();
            if (!saName) return;

            const unitLinks = Array.from(saItem.querySelectorAll(":scope > .pgn_collapsible .collapsible-body ol > li > a"));

            unitLinks.forEach((unitLink, atIndex) => {
                const atTitle = unitLink.querySelector(".align-middle");
                const atName = atTitle?.textContent?.trim();
                if (!atName) return;

                const saCode = `SA${formatNumber(saIndex + 1)}`;
                const atCode = atIndex === 0 ? "INTROD" : `AT${formatNumber(atIndex)}`;
                map.set(createNameKey(saName, atName), `${saCode}/${atCode}`);
            });
        });

        return map;
    }

    /**
     * Lê o mapa já criado pelo Structure Mapper quando a estrutura do curso foi indexada.
     * A assinatura do curso é comparada também com URLs CMS `block-v1:...`, que não
     * contêm literalmente o prefixo `course-v1:`.
     */
    async function buildStoredCodeMap() {
        const map = new Map();

        try {
            if (!chrome?.storage?.local) return map;

            const result = await chrome.storage.local.get(ROUTE_MAP_KEY);
            const routes = result[ROUTE_MAP_KEY] || {};
            const courseSignature = getCurrentCourseSignature();

            Object.entries(routes).forEach(([route, context]) => {
                if (!context?.saName || !context?.atName || !context?.saCode || !context?.atCode) return;
                if (courseSignature && !String(route).includes(courseSignature)) return;

                const label = `${compactCode(context.saCode)}/${compactCode(context.atCode)}`;
                map.set(createNameKey(context.saName, context.atName), label);
            });
        } catch (_) {
            return map;
        }

        return map;
    }

    /**
     * Junta todas as fontes disponíveis. A estrutura visível tem prioridade sobre dados
     * persistidos porque representa sempre o estado atual do recurso.
     */
    async function buildCodeMap() {
        const map = await buildStoredCodeMap();
        const outlineMap = buildOutlineCodeMap();
        const authoringMap = buildAuthoringStructureCodeMap();

        outlineMap.forEach((value, key) => map.set(key, value));
        authoringMap.forEach((value, key) => map.set(key, value));
        return map;
    }

    /** Cria ou atualiza a pill numérica de localização de um comentário. */
    function updateCommentPill(comment, codeMap) {
        const location = comment.querySelector(LOCATION_SELECTOR);
        const existingPill = comment.querySelector(`.${PILL_CLASS}`);

        if (!location) {
            existingPill?.remove();
            return;
        }

        const names = getNamesFromLocation(location.textContent);
        if (!names) {
            existingPill?.remove();
            return;
        }

        const label = codeMap.get(createNameKey(names.saName, names.atName));
        if (!label) {
            existingPill?.remove();
            return;
        }

        let pill = existingPill;

        if (!pill) {
            pill = document.createElement("div");
            pill.className = PILL_CLASS;
            location.before(pill);
        }

        if (pill.textContent !== label) {
            pill.textContent = label;
        }

        pill.title = `${label}\n${names.saName} > ${names.atName}`;
        pill.dataset.sa = label.split("/")[0] || "";
        pill.dataset.at = label.split("/")[1] || "";

        if (pill.nextElementSibling !== location) {
            location.before(pill);
        }
    }

    /** Atualiza todas as pills atualmente presentes no painel. */
    async function updateAllPills() {
        updateScheduled = false;
        const codeMap = await buildCodeMap();

        document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}`)
            .forEach(comment => updateCommentPill(comment, codeMap));
    }

    /** Agenda uma atualização para evitar várias passagens no mesmo ciclo do DOM. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        window.requestAnimationFrame(() => void updateAllPills());
    }

    /**
     * O GiRED recria a lista de comentários e a estrutura dinamicamente.
     * Observamos essas alterações para recalcular os códigos assim que os elementos existirem.
     */
    const observer = new MutationObserver(scheduleUpdate);

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
    });

    /** Recalcula também quando o Structure Mapper atualiza o mapa partilhado. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === "local" && changes[ROUTE_MAP_KEY]) scheduleUpdate();
        });
    }

    scheduleUpdate();
})();
