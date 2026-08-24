(() => {
    "use strict";

    const ENABLED_KEY = "giredStructureMapperEnabled";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const VC_COUNTERS_KEY = "giredVcCountersEnabled";

    const toggle = document.getElementById("enabledToggle");
    const statusText = document.getElementById("statusText");
    const reviewCommentsToggle = document.getElementById("reviewCommentsToggle");
    const reviewCommentsStatus = document.getElementById("reviewCommentsStatus");
    const vcCountersToggle = document.getElementById("vcCountersToggle");
    const vcCountersStatus = document.getElementById("vcCountersStatus");
    const version = document.getElementById("version");

    /** Atualiza os textos do popup de acordo com o estado atual. */
    function updateUi(enabled) {
        toggle.checked = enabled;
        statusText.textContent = enabled ? "Ativa" : "Desativada";
    }

    /** Atualiza a preferência que mostra apenas a lista de correções. */
    function updateReviewCommentsUi(commentsOnly) {
        reviewCommentsToggle.checked = commentsOnly;
        reviewCommentsStatus.textContent = commentsOnly ? "Apenas comentários" : "Painel completo";
    }

    /** Atualiza a preferência dos contadores A/B e C/D do Controlo de Versões. */
    function updateVcCountersUi(countersEnabled) {
        vcCountersToggle.checked = countersEnabled;
        vcCountersStatus.textContent = countersEnabled ? "Ativados" : "Contador nativo";
    }

    /** Carrega o estado atual, as preferências e a versão instalada. */
    async function initialize() {
        version.textContent = `v${chrome.runtime.getManifest().version}`;

        try {
            const result = await chrome.storage.local.get([
                ENABLED_KEY,
                REVIEW_COMMENTS_ONLY_KEY,
                VC_COUNTERS_KEY
            ]);

            updateUi(result[ENABLED_KEY] !== false);
            updateReviewCommentsUi(result[REVIEW_COMMENTS_ONLY_KEY] === true);
            updateVcCountersUi(result[VC_COUNTERS_KEY] !== false);
        } catch (_) {
            updateUi(true);
            updateReviewCommentsUi(false);
            updateVcCountersUi(true);
        }
    }

    /** Guarda o novo estado quando o utilizador usa o interruptor. */
    toggle.addEventListener("change", async () => {
        const enabled = toggle.checked;
        updateUi(enabled);
        await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    });

    /** Guarda a preferência do modo que mostra apenas a lista de correções. */
    reviewCommentsToggle.addEventListener("change", async () => {
        const commentsOnly = reviewCommentsToggle.checked;
        updateReviewCommentsUi(commentsOnly);
        await chrome.storage.local.set({ [REVIEW_COMMENTS_ONLY_KEY]: commentsOnly });
    });

    /** Guarda a preferência dos contadores A/B e C/D. */
    vcCountersToggle.addEventListener("change", async () => {
        const countersEnabled = vcCountersToggle.checked;
        updateVcCountersUi(countersEnabled);
        await chrome.storage.local.set({ [VC_COUNTERS_KEY]: countersEnabled });
    });

    void initialize();
})();
