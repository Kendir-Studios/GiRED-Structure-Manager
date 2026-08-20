(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOCATION_SELECTOR = ".course-vc-comment-location";
    const UNIT_LINK_SELECTOR = ".course-vc-comment-unit-link a[href]";
    const PILL_CLASS = "gired-structure-mapper-vc-location-pill";
    const ROUTE_MAP_KEY = "giredStructureMapperRoutesV2";
    const OUTLINE_SELECTOR = "#outline-sidebar-outline";

    const SUBSECTIONS_SELECTOR = '[data-testid="section-card__subsections"]';
    const SUBSECTION_SELECTOR = '[data-testid="subsection-card"]';
    const SUBSECTION_TITLE_SELECTOR = ".subsection-card-title";

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
     * Mapeia o nome de cada SA para o respetivo número usando diretamente a Estrutura do recurso.
     * Funciona mesmo com as SAs fechadas, porque os títulos continuam presentes no DOM.
     */
    function buildAuthoringSaMap() {
        const map = new Map();

        document.querySelectorAll(SUBSECTIONS_SELECTOR).forEach(container => {
            getSubsections(container).forEach((subsection, saIndex) => {
                const saName = subsection.querySelector(SUBSECTION_TITLE_SELECTOR)?.textContent?.trim();
                if (!saName) return;
                map.set(normalizeText(saName), `SA${formatNumber(saIndex + 1)}`);
            });
        });

        return map;
    }

    /**
     * Lê o próprio block ID do link do erro.
     * O GiRED codifica a posição da atividade no href:
     * - `...block@vertical16` -> INTROD da SA de índice 16
     * - `...block@vert_0_6_1_...` -> SA de índice 6, AT de índice 1 (AT02)
     */
    function getCodesFromCommentLink(comment, names, saMap) {
        const link = comment.querySelector(UNIT_LINK_SELECTOR);
        const href = link?.href || link?.getAttribute("href") || "";
        if (!href) return null;

        const introMatch = href.match(/type@vertical\+block@vertical(\d+)(?:$|[/?#])/i);
        const atMatch = href.match(/type@vertical\+block@vert_0_(\d+)_(\d+)(?:_|$|[/?#])/i);

        let saIndex = null;
        let atCode = "";

        if (introMatch) {
            saIndex = Number.parseInt(introMatch[1], 10);
            atCode = "INTROD";
        } else if (atMatch) {
            saIndex = Number.parseInt(atMatch[1], 10);
            const atIndex = Number.parseInt(atMatch[2], 10);
            if (Number.isFinite(atIndex)) atCode = `AT${formatNumber(atIndex + 1)}`;
        }

        if (!atCode) return null;

        let saCode = saMap.get(normalizeText(names.saName)) || "";
        if (!saCode && Number.isFinite(saIndex)) {
            saCode = `SA${formatNumber(saIndex + 1)}`;
        }

        return saCode ? `${saCode}/${atCode}` : null;
    }

    /**
     * Constrói códigos diretamente a partir do outline da página do aluno.
     * Serve de fallback fora da Estrutura do recurso.
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

    /** Lê o mapa persistente já criado pelo Structure Mapper. */
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

    /** Junta os fallbacks por nome disponíveis. */
    async function buildFallbackCodeMap() {
        const map = await buildStoredCodeMap();
        const outlineMap = buildOutlineCodeMap();
        outlineMap.forEach((value, key) => map.set(key, value));
        return map;
    }

    /** Cria ou atualiza a pill numérica de localização de um comentário. */
    function updateCommentPill(comment, saMap, fallbackCodeMap) {
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

        const directLabel = getCodesFromCommentLink(comment, names, saMap);
        const fallbackLabel = fallbackCodeMap.get(createNameKey(names.saName, names.atName));
        const label = directLabel || fallbackLabel;

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

        const saMap = buildAuthoringSaMap();
        const fallbackCodeMap = await buildFallbackCodeMap();

        document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}`)
            .forEach(comment => updateCommentPill(comment, saMap, fallbackCodeMap));
    }

    /** Agenda uma atualização para evitar várias passagens no mesmo ciclo do DOM. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        window.requestAnimationFrame(() => void updateAllPills());
    }

    /** O GiRED recria comentários e estrutura dinamicamente; reaplicamos quando isso acontece. */
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
