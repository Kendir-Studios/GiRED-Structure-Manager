(() => {
    "use strict";

    const ENABLED_KEY = "giredStructureMapperEnabled";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const VC_COUNTERS_KEY = "giredVcCountersEnabled";
    const NATIVE_HOST = "pt.kendir.gired_updater";

    // O ZIP da Chrome Web Store é publicado sem a "key" do manifest, por isso a sua
    // presença distingue a instalação por clone Git da instalação pela store.
    const IS_GIT_CLONE_INSTALL = Boolean(chrome.runtime.getManifest().key);

    const toggle = document.getElementById("enabledToggle");
    const statusText = document.getElementById("statusText");
    const reviewCommentsToggle = document.getElementById("reviewCommentsToggle");
    const reviewCommentsStatus = document.getElementById("reviewCommentsStatus");
    const vcCountersToggle = document.getElementById("vcCountersToggle");
    const vcCountersStatus = document.getElementById("vcCountersStatus");
    const version = document.getElementById("version");
    const updateStatus = document.getElementById("updateStatus");
    const latestVersion = document.getElementById("latestVersion");
    const updateButton = document.getElementById("updateButton");
    const updaterSetup = document.getElementById("updaterSetup");

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

    /** Pede ao Chrome que procure já uma atualização na Chrome Web Store. */
    function requestStoreUpdateCheck() {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.requestUpdateCheck((status, details) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    resolve({ status, version: details?.version });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /** Coloca a secção de atualizações num estado visual coerente. */
    function setUpdateUi({ status, badge = "", busy = false, buttonLabel = "Verificar atualizações", setup = false }) {
        updateStatus.textContent = status;
        latestVersion.textContent = badge;
        latestVersion.hidden = !badge;
        updaterSetup.hidden = !setup;
        updateButton.disabled = busy;
        updateButton.textContent = buttonLabel;
    }

    /** Mostra o estado em que o updater local ainda não foi configurado. */
    function showUpdaterSetup() {
        setUpdateUi({
            status: "Updater local não configurado",
            buttonLabel: "Verificar novamente",
            setup: true
        });
    }

    /** Mostra uma mensagem de erro devolvida pelo updater. */
    function showUpdateError(message) {
        setUpdateUi({
            status: message || "Não foi possível verificar atualizações",
            buttonLabel: "Tentar novamente"
        });
    }

    /** Faz Pull da versão mais recente e recarrega a extensão quando termina. */
    async function installNativeUpdate(newVersionLabel) {
        setUpdateUi({
            status: "Nova versão disponível. A atualizar...",
            badge: newVersionLabel,
            busy: true,
            buttonLabel: "A atualizar..."
        });

        try {
            const response = await sendNativeMessage({ action: "update" });

            if (!response?.ok) {
                showUpdateError(response?.message);
                return;
            }

            const newVersion = response.version ? ` v${response.version}` : "";
            setUpdateUi({
                status: `Atualizado${newVersion}. A recarregar...`,
                busy: true,
                buttonLabel: "Concluído"
            });

            window.setTimeout(() => chrome.runtime.reload(), 650);
        } catch (_) {
            showUpdaterSetup();
        }
    }

    /** Verifica se há uma versão mais recente e instala-a de imediato quando existe. */
    async function checkUpdates() {
        setUpdateUi({ status: "A verificar...", busy: true, buttonLabel: "A verificar..." });

        if (IS_GIT_CLONE_INSTALL) {
            try {
                const response = await sendNativeMessage({ action: "check" });

                if (!response?.ok) {
                    showUpdateError(response?.message);
                    return;
                }

                if (response.updateAvailable) {
                    await installNativeUpdate(response.latestVersion ? `v${response.latestVersion}` : "Update");
                    return;
                }

                setUpdateUi({ status: "Estás na versão mais recente" });
            } catch (_) {
                showUpdaterSetup();
            }

            return;
        }

        try {
            const result = await requestStoreUpdateCheck();

            if (result.status === "update_available") {
                // O Chrome descarrega a nova versão e o background recarrega a
                // extensão assim que o download terminar.
                setUpdateUi({
                    status: "Nova versão disponível. A instalar...",
                    badge: result.version ? `v${result.version}` : "Update",
                    busy: true,
                    buttonLabel: "A atualizar..."
                });
                return;
            }

            if (result.status === "throttled") {
                setUpdateUi({
                    status: "O Chrome limitou a verificação. Tenta daqui a uns minutos.",
                    buttonLabel: "Tentar novamente"
                });
                return;
            }

            setUpdateUi({ status: "Estás na versão mais recente" });
        } catch (_) {
            showUpdateError();
        }
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

        if (IS_GIT_CLONE_INSTALL) {
            await checkUpdates();
        } else {
            setUpdateUi({ status: "Atualiza automaticamente pela Chrome Web Store" });
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

    updateButton.addEventListener("click", () => {
        void checkUpdates();
    });

    // Rede de segurança para a instalação pela store: se o download terminar com o
    // popup ainda aberto, aplica a atualização de imediato.
    if (chrome.runtime.onUpdateAvailable) {
        chrome.runtime.onUpdateAvailable.addListener(() => chrome.runtime.reload());
    }

    void initialize();
})();
