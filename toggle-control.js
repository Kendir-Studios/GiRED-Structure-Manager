(() => {
    "use strict";

    const ENABLED_KEY = "giredStructureMapperEnabled";
    const LOADING_CLASS = "gired-structure-mapper-loading";
    const DISABLED_CLASS = "gired-structure-mapper-disabled";

    /** Aplica visualmente o estado ativo/inativo da extensão à página atual. */
    function applyEnabledState(enabled) {
        const root = document.documentElement;
        root.classList.toggle(DISABLED_CLASS, !enabled);
        root.classList.remove(LOADING_CLASS);
    }

    /** Lê o estado guardado da extensão. Por omissão, a extensão está ativa. */
    async function loadEnabledState() {
        document.documentElement.classList.add(LOADING_CLASS);

        try {
            const result = await chrome.storage.local.get(ENABLED_KEY);
            applyEnabledState(result[ENABLED_KEY] !== false);
        } catch (_) {
            applyEnabledState(true);
        }
    }

    /** Atualiza imediatamente a página quando o utilizador altera o toggle no popup. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[ENABLED_KEY]) return;
            applyEnabledState(changes[ENABLED_KEY].newValue !== false);
        });
    }

    void loadEnabledState();
})();
