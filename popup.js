(() => {
    "use strict";

    const ENABLED_KEY = "giredStructureMapperEnabled";

    const toggle = document.getElementById("enabledToggle");
    const statusText = document.getElementById("statusText");
    const version = document.getElementById("version");

    /** Atualiza os textos do popup de acordo com o estado atual. */
    function updateUi(enabled) {
        toggle.checked = enabled;
        statusText.textContent = enabled ? "Ativa" : "Desativada";
    }

    /** Carrega o estado atual e a versão da extensão. */
    async function initialize() {
        version.textContent = `v${chrome.runtime.getManifest().version}`;

        try {
            const result = await chrome.storage.local.get(ENABLED_KEY);
            updateUi(result[ENABLED_KEY] !== false);
        } catch (_) {
            updateUi(true);
        }
    }

    /** Guarda o novo estado quando o utilizador usa o interruptor. */
    toggle.addEventListener("change", async () => {
        const enabled = toggle.checked;
        updateUi(enabled);
        await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    });

    void initialize();
})();
