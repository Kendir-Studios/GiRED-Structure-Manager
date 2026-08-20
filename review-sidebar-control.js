(() => {
    "use strict";

    const LEGACY_REVIEW_LEFT_KEY = "giredReviewSidebarLeft";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const COMMENTS_ONLY_CLASS = "gired-review-comments-only";
    const LEGACY_LEFT_CLASS = "gired-review-sidebar-left";
    const REVIEW_TOGGLE_SELECTOR = "#vc-review-toggle";
    const REVIEW_CLOSE_SELECTOR = "#vc-review-close";
    const SIDEBAR_SELECTOR = "#vc-review-sidebar";
    const WIDTH_VARIABLE = "--gired-review-sidebar-width";

    let widthUpdateScheduled = false;

    /** Indica se o painel nativo de Revisão está atualmente aberto. */
    function isReviewOpen() {
        return document.body?.classList.contains("vc-review-open") === true;
    }

    /**
     * Mede a largura real do painel nativo e guarda-a numa variável CSS.
     * A página usa esta largura para reservar espaço à direita enquanto a Revisão está aberta.
     */
    function updateReviewSidebarWidth() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const rectWidth = sidebar.getBoundingClientRect().width;
        const computedWidth = Number.parseFloat(window.getComputedStyle(sidebar).width) || 0;
        const width = rectWidth || computedWidth;

        if (width > 0) {
            document.documentElement.style.setProperty(WIDTH_VARIABLE, `${Math.round(width)}px`);
        }
    }

    /** Agenda a medição para o próximo frame, evitando cálculos repetidos. */
    function scheduleWidthUpdate() {
        if (widthUpdateScheduled) return;
        widthUpdateScheduled = true;

        window.requestAnimationFrame(() => {
            widthUpdateScheduled = false;
            updateReviewSidebarWidth();
        });
    }

    /**
     * Garante que a aba de Correções está ativa quando o modo de apenas comentários é usado.
     */
    function ensureCorrectionsTabActive() {
        const correctionsTab = document.querySelector('.vc-review-tab[data-tab="corrections"]');
        if (!correctionsTab || correctionsTab.classList.contains("active")) return;

        correctionsTab.click();
    }

    /** Aplica o modo compacto sem alterar a posição nativa do painel de Revisão. */
    function applyCommentsOnly(commentsOnly) {
        document.documentElement.classList.toggle(COMMENTS_ONLY_CLASS, commentsOnly);

        if (commentsOnly && isReviewOpen()) {
            window.requestAnimationFrame(ensureCorrectionsTabActive);
        }
    }

    /** Sincroniza a largura e o modo compacto sempre que o painel nativo está aberto. */
    function syncOpenPanel() {
        if (!isReviewOpen()) return;

        scheduleWidthUpdate();

        if (document.documentElement.classList.contains(COMMENTS_ONLY_CLASS)) {
            window.requestAnimationFrame(ensureCorrectionsTabActive);
        }
    }

    /**
     * Remove apenas a antiga preferência/classe de mover a Revisão para a esquerda.
     * A variável de largura deixa de ser removida porque agora é usada para adaptar a página à direita.
     */
    async function removeLegacyLeftPreference() {
        document.documentElement.classList.remove(LEGACY_LEFT_CLASS);

        try {
            await chrome.storage.local.remove(LEGACY_REVIEW_LEFT_KEY);
        } catch (_) {
            // A limpeza da preferência antiga não deve impedir o funcionamento do painel.
        }
    }

    /** Carrega a preferência guardada para o modo de apenas comentários. */
    async function loadReviewPreferences() {
        await removeLegacyLeftPreference();

        try {
            const result = await chrome.storage.local.get(REVIEW_COMMENTS_ONLY_KEY);
            applyCommentsOnly(result[REVIEW_COMMENTS_ONLY_KEY] === true);
        } catch (_) {
            applyCommentsOnly(false);
        }

        syncOpenPanel();
    }

    /** Atualiza imediatamente a página quando a preferência é alterada no popup. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[REVIEW_COMMENTS_ONLY_KEY]) return;
            applyCommentsOnly(changes[REVIEW_COMMENTS_ONLY_KEY].newValue === true);
        });
    }

    /**
     * O painel pode ser inserido dinamicamente. O observer recalcula a largura e mantém
     * a aba Correções ativa quando necessário.
     */
    const domObserver = new MutationObserver(() => {
        syncOpenPanel();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /**
     * O GiRED abre e fecha a Revisão através da classe `vc-review-open` no body.
     * Quando abre, medimos o painel e a página passa automaticamente a reservar esse espaço.
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

    /** Sincroniza novamente após utilizar os controlos nativos de abrir/fechar. */
    document.addEventListener("click", event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (!target.closest(`${REVIEW_TOGGLE_SELECTOR}, ${REVIEW_CLOSE_SELECTOR}`)) return;

        window.requestAnimationFrame(syncOpenPanel);
    }, true);

    /** Mantém a reserva de espaço correta se a janela ou o painel mudarem de largura. */
    window.addEventListener("resize", () => {
        if (isReviewOpen()) {
            scheduleWidthUpdate();
        }
    }, { passive: true });

    void loadReviewPreferences();
})();
