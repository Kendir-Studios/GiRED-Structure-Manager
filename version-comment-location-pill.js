(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOCATION_SELECTOR = ".course-vc-comment-location";
    const PILL_CLASS = "gired-structure-mapper-vc-location-pill";

    let updateScheduled = false;

    /**
     * Extrai a SA e a AT da localização apresentada pelo Controlo de Versões.
     * A estrutura esperada é: ignorar > ignorar > SA > AT.
     */
    function getSaAtFromLocation(locationText) {
        const parts = String(locationText || "")
            .split(">")
            .map(part => part.trim())
            .filter(Boolean);

        if (parts.length < 4) return null;

        const sa = parts[2];
        const at = parts[3];

        if (!sa || !at) return null;
        return { sa, at };
    }

    /** Cria ou atualiza a pill de localização de um comentário. */
    function updateCommentPill(comment) {
        const location = comment.querySelector(LOCATION_SELECTOR);
        const existingPill = comment.querySelector(`.${PILL_CLASS}`);

        if (!location) {
            existingPill?.remove();
            return;
        }

        const saAt = getSaAtFromLocation(location.textContent);
        if (!saAt) {
            existingPill?.remove();
            return;
        }

        const label = `${saAt.sa} / ${saAt.at}`;
        let pill = existingPill;

        if (!pill) {
            pill = document.createElement("div");
            pill.className = PILL_CLASS;
            location.before(pill);
        }

        if (pill.textContent !== label) {
            pill.textContent = label;
        }

        pill.title = `SA: ${saAt.sa}\nAT: ${saAt.at}`;
        pill.dataset.sa = saAt.sa;
        pill.dataset.at = saAt.at;

        if (pill.nextElementSibling !== location) {
            location.before(pill);
        }
    }

    /** Atualiza todas as pills atualmente presentes no painel. */
    function updateAllPills() {
        updateScheduled = false;

        document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}`)
            .forEach(updateCommentPill);
    }

    /** Agenda uma atualização para evitar várias passagens no mesmo ciclo do DOM. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        window.requestAnimationFrame(updateAllPills);
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

    scheduleUpdate();
})();
