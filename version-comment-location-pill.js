(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOCATION_SELECTOR = ".course-vc-comment-location";
    const PILL_CLASS = "gired-structure-mapper-vc-location-pill";
    const ROUTE_MAP_KEY = "giredStructureMapperRoutesV2";
    const OUTLINE_SELECTOR = "#outline-sidebar-outline";

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

    /** Obtém o identificador do curso atual para evitar misturar mapas de outros recursos. */
    function getCurrentCourseId() {
        const match = location.href.match(/course-v1:[^/]+/i);
        return match ? match[0] : "";
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
     * Constrói códigos diretamente a partir do outline da página do aluno.
     * É especialmente útil para a SA atualmente expandida, cujas unidades estão no DOM.
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
     * O par SA+AT é usado para evitar ambiguidades entre atividades com o mesmo nome.
     */
    async function buildStoredCodeMap() {
        const map = new Map();

        try {
            if (!chrome?.storage?.local) return map;

            const result = await chrome.storage.local.get(ROUTE_MAP_KEY);
            const routes = result[ROUTE_MAP_KEY] || {};
            const currentCourseId = getCurrentCourseId();

            Object.entries(routes).forEach(([route, context]) => {
                if (!context?.saName || !context?.atName || !context?.saCode || !context?.atCode) return;
                if (currentCourseId && !String(route).includes(currentCourseId)) return;

                const label = `${compactCode(context.saCode)}/${compactCode(context.atCode)}`;
                map.set(createNameKey(context.saName, context.atName), label);
            });
        } catch (_) {
            return map;
        }

        return map;
    }

    /** Junta o mapa persistente ao que pode ser inferido diretamente da página atual. */
    async function buildCodeMap() {
        const storedMap = await buildStoredCodeMap();
        const outlineMap = buildOutlineCodeMap();

        outlineMap.forEach((value, key) => storedMap.set(key, value));
        return storedMap;
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
     * O GiRED recria a lista de comentários ao trocar filtros, estado ou separador.
     * Observamos essas alterações para voltar a aplicar as pills automaticamente.
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
