(() => {
    "use strict";

    const REVIEW_LEFT_KEY = "giredReviewSidebarLeft";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const LEFT_CLASS = "gired-review-sidebar-left";
    const COMMENTS_ONLY_CLASS = "gired-review-comments-only";
    const SIDEBAR_SELECTOR = "#vc-review-sidebar";
    const REVIEW_TOGGLE_SELECTOR = "#vc-review-toggle";
    const REVIEW_CLOSE_SELECTOR = "#vc-review-close";
    const WIDTH_VARIABLE = "--gired-review-sidebar-width";

    let updateScheduled = false;

    /** Indica se o painel nativo de Revisão está atualmente aberto. */
    function isReviewOpen() {
        return document.body?.classList.contains("vc-review-open") === true;
    }

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

    /** Aplica o lado escolhido ao documento atual sem abrir o painel automaticamente. */
    function applyReviewSide(useLeftSide) {
        document.documentElement.classList.toggle(LEFT_CLASS, useLeftSide);

        if (useLeftSide && isReviewOpen()) {
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

    /** Aplica o modo compacto sem abrir o painel de Revisão automaticamente. */
    function applyCommentsOnly(commentsOnly) {
        document.documentElement.classList.toggle(COMMENTS_ONLY_CLASS, commentsOnly);

        if (commentsOnly && isReviewOpen()) {
            window.requestAnimationFrame(ensureCorrectionsTabActive);
        }
    }

    /**
     * Sincroniza as preferências quando o utilizador abre o painel através do botão nativo.
     */
    function syncOpenPanel() {
        if (!isReviewOpen()) return;

        if (document.documentElement.classList.contains(LEFT_CLASS)) {
            scheduleWidthUpdate();
        }

        if (document.documentElement.classList.contains(COMMENTS_ONLY_CLASS)) {
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
     * O painel pode ser inserido dinamicamente. Este observer trata apenas alterações
     * estruturais; a abertura/fecho por botão é tratada separadamente pela classe do body.
     */
    const domObserver = new MutationObserver(() => {
        syncOpenPanel();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /**
     * O GiRED abre e fecha a Revisão alterando a classe `vc-review-open` no body.
     * Observar essa classe permite aplicar as preferências mesmo quando o painel já estava no DOM.
     */
    if (document.body) {
        const bodyObserver = new MutationObserver(() => {
            syncOpenPanel();
        });

        bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    /**
     * Depois de clicar no botão nativo de Revisão, sincroniza novamente no frame seguinte.
     * O botão continua a ser controlado pelo GiRED e permanece no seu lado original.
     */
    document.addEventListener("click", event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (!target.closest(`${REVIEW_TOGGLE_SELECTOR}, ${REVIEW_CLOSE_SELECTOR}`)) return;

        window.requestAnimationFrame(syncOpenPanel);
    }, true);

    window.addEventListener("resize", () => {
        if (isReviewOpen() && document.documentElement.classList.contains(LEFT_CLASS)) {
            scheduleWidthUpdate();
        }
    }, { passive: true });

    void loadReviewPreferences();
})();
