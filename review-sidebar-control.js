(() => {
    "use strict";

    const LEGACY_REVIEW_LEFT_KEY = "giredReviewSidebarLeft";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const COMMENTS_ONLY_CLASS = "gired-review-comments-only";
    const LEGACY_LEFT_CLASS = "gired-review-sidebar-left";
    const REVIEW_TOGGLE_SELECTOR = "#vc-review-toggle";
    const REVIEW_CLOSE_SELECTOR = "#vc-review-close";

    /** Indica se o painel nativo de Revisão está atualmente aberto. */
    function isReviewOpen() {
        return document.body?.classList.contains("vc-review-open") === true;
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

    /** Sincroniza o modo compacto sempre que o painel nativo é aberto. */
    function syncOpenPanel() {
        if (!isReviewOpen()) return;
        if (!document.documentElement.classList.contains(COMMENTS_ONLY_CLASS)) return;

        window.requestAnimationFrame(ensureCorrectionsTabActive);
    }

    /**
     * Remove a antiga preferência de mover a Revisão para a esquerda.
     * A partir desta versão, a Revisão fica sempre no lado direito nativo do GiRED.
     */
    async function removeLegacyLeftPreference() {
        document.documentElement.classList.remove(LEGACY_LEFT_CLASS);
        document.documentElement.style.removeProperty("--gired-review-sidebar-width");

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
    }

    /** Atualiza imediatamente a página quando a preferência é alterada no popup. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[REVIEW_COMMENTS_ONLY_KEY]) return;
            applyCommentsOnly(changes[REVIEW_COMMENTS_ONLY_KEY].newValue === true);
        });
    }

    /**
     * O painel pode ser inserido dinamicamente. O observer garante que a aba Correções
     * permanece ativa quando o modo compacto está ligado.
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
     * Observamos apenas esse estado; a posição continua totalmente controlada pelo GiRED.
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

    void loadReviewPreferences();
})();
