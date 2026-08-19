(() => {
    "use strict";

    const REVIEW_LEFT_KEY = "giredReviewSidebarLeft";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const LEFT_CLASS = "gired-review-sidebar-left";
    const COMMENTS_ONLY_CLASS = "gired-review-comments-only";
    const SIDEBAR_SELECTOR = "#vc-review-sidebar";
    const WIDTH_VARIABLE = "--gired-review-sidebar-width";

    let updateScheduled = false;

    /**
     * Atualiza a largura usada para reservar espaço para o painel quando este fica à esquerda.
     */
    function updateSidebarWidth() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const rectWidth = sidebar.getBoundingClientRect().width;
        const computedWidth = Number.parseFloat(window.getComputedStyle(sidebar).width) || 0;
        const width = rectWidth || computedWidth;

        if (width > 0) {
            document.documentElement.style.setProperty(WIDTH_VARIABLE, `${Math.round(width)}px`);
        }
    }

    /** Agenda a leitura da largura para evitar trabalho repetido durante alterações do DOM. */
    function scheduleWidthUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;

        window.requestAnimationFrame(() => {
            updateScheduled = false;
            updateSidebarWidth();
        });
    }

    /** Aplica o lado escolhido ao documento atual. */
    function applyReviewSide(useLeftSide) {
        document.documentElement.classList.toggle(LEFT_CLASS, useLeftSide);

        if (useLeftSide) {
            scheduleWidthUpdate();
        }
    }

    /**
     * Garante que a aba de Correções está ativa quando o modo de apenas comentários é usado.
     */
    function ensureCorrectionsTabActive() {
        const correctionsTab = document.querySelector('.vc-review-tab[data-tab="corrections"]');
        if (!correctionsTab || correctionsTab.classList.contains("active")) return;

        correctionsTab.click();
    }

    /** Aplica o modo compacto que mantém visível apenas a lista de correções existentes. */
    function applyCommentsOnly(commentsOnly) {
        document.documentElement.classList.toggle(COMMENTS_ONLY_CLASS, commentsOnly);

        if (commentsOnly) {
            window.requestAnimationFrame(ensureCorrectionsTabActive);
        }
    }

    /** Carrega as preferências guardadas para o painel de Revisão. */
    async function loadReviewPreferences() {
        try {
            const result = await chrome.storage.local.get([
                REVIEW_LEFT_KEY,
                REVIEW_COMMENTS_ONLY_KEY
            ]);

            applyReviewSide(result[REVIEW_LEFT_KEY] !== false);
            applyCommentsOnly(result[REVIEW_COMMENTS_ONLY_KEY] === true);
        } catch (_) {
            applyReviewSide(true);
            applyCommentsOnly(false);
        }
    }

    /** Atualiza imediatamente a página quando uma preferência é alterada no popup. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            if (changes[REVIEW_LEFT_KEY]) {
                applyReviewSide(changes[REVIEW_LEFT_KEY].newValue !== false);
            }

            if (changes[REVIEW_COMMENTS_ONLY_KEY]) {
                applyCommentsOnly(changes[REVIEW_COMMENTS_ONLY_KEY].newValue === true);
            }
        });
    }

    /**
     * O painel de revisão é inserido dinamicamente pelo GiRED, por isso observamos o DOM
     * para obter a largura correta e reaplicar o modo compacto assim que o painel existir.
     */
    const observer = new MutationObserver(() => {
        if (document.documentElement.classList.contains(LEFT_CLASS)) {
            scheduleWidthUpdate();
        }

        if (document.documentElement.classList.contains(COMMENTS_ONLY_CLASS)) {
            ensureCorrectionsTabActive();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.addEventListener("resize", scheduleWidthUpdate, { passive: true });

    void loadReviewPreferences();
})();
