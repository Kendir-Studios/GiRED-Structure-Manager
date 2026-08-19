(() => {
    "use strict";

    const ENABLED_KEY = "giredStructureMapperEnabled";
    const NATIVE_HOST = "pt.kendir.gired_updater";

    const toggle = document.getElementById("enabledToggle");
    const statusText = document.getElementById("statusText");
    const version = document.getElementById("version");
    const updateStatus = document.getElementById("updateStatus");
    const latestVersion = document.getElementById("latestVersion");
    const updateButton = document.getElementById("updateButton");
    const updaterSetup = document.getElementById("updaterSetup");

    let updateAction = "check";

    /** Atualiza os textos do popup de acordo com o estado atual. */
    function updateUi(enabled) {
        toggle.checked = enabled;
        statusText.textContent = enabled ? "Ativa" : "Desativada";
    }

    /** Envia uma mensagem ao helper nativo responsável pelas atualizações. */
    function sendNativeMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendNativeMessage(NATIVE_HOST, message, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                resolve(response);
            });
        });
    }

    /** Mostra o estado em que o updater local ainda não foi configurado. */
    function showUpdaterSetup() {
        updateStatus.textContent = "Updater local não configurado";
        latestVersion.hidden = true;
        updaterSetup.hidden = false;
        updateButton.disabled = false;
        updateButton.textContent = "Verificar novamente";
        updateAction = "check";
    }

    /** Mostra uma mensagem de erro devolvida pelo updater. */
    function showUpdateError(message) {
        updateStatus.textContent = message || "Não foi possível verificar atualizações";
        latestVersion.hidden = true;
        updaterSetup.hidden = true;
        updateButton.disabled = false;
        updateButton.textContent = "Tentar novamente";
        updateAction = "check";
    }

    /** Verifica automaticamente se existe uma versão mais recente no GitHub. */
    async function checkUpdates() {
        updateStatus.textContent = "A verificar...";
        latestVersion.hidden = true;
        updaterSetup.hidden = true;
        updateButton.disabled = true;
        updateButton.textContent = "A verificar...";

        try {
            const response = await sendNativeMessage({ action: "check" });

            if (!response?.ok) {
                showUpdateError(response?.message);
                return;
            }

            if (response.updateAvailable) {
                updateStatus.textContent = "Nova versão disponível";
                latestVersion.textContent = response.latestVersion ? `v${response.latestVersion}` : "Update";
                latestVersion.hidden = false;
                updateButton.disabled = false;
                updateButton.textContent = "Atualizar agora";
                updateAction = "update";
                return;
            }

            updateStatus.textContent = "Estás na versão mais recente";
            latestVersion.hidden = true;
            updateButton.disabled = false;
            updateButton.textContent = "Verificar novamente";
            updateAction = "check";
        } catch (_) {
            showUpdaterSetup();
        }
    }

    /** Faz Pull da versão mais recente e recarrega a extensão quando termina. */
    async function installUpdate() {
        updateStatus.textContent = "A atualizar...";
        latestVersion.hidden = true;
        updaterSetup.hidden = true;
        updateButton.disabled = true;
        updateButton.textContent = "A atualizar...";

        try {
            const response = await sendNativeMessage({ action: "update" });

            if (!response?.ok) {
                showUpdateError(response?.message);
                return;
            }

            const newVersion = response.version ? ` v${response.version}` : "";
            updateStatus.textContent = `Atualizado${newVersion}. A recarregar...`;
            updateButton.textContent = "Concluído";

            window.setTimeout(() => chrome.runtime.reload(), 650);
        } catch (_) {
            showUpdaterSetup();
        }
    }

    /** Carrega o estado atual, a versão e verifica atualizações. */
    async function initialize() {
        version.textContent = `v${chrome.runtime.getManifest().version}`;

        try {
            const result = await chrome.storage.local.get(ENABLED_KEY);
            updateUi(result[ENABLED_KEY] !== false);
        } catch (_) {
            updateUi(true);
        }

        await checkUpdates();
    }

    /** Guarda o novo estado quando o utilizador usa o interruptor. */
    toggle.addEventListener("change", async () => {
        const enabled = toggle.checked;
        updateUi(enabled);
        await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    });

    /** Verifica ou instala a atualização conforme o estado atual do botão. */
    updateButton.addEventListener("click", () => {
        if (updateAction === "update") {
            void installUpdate();
            return;
        }

        void checkUpdates();
    });

    void initialize();
})();
