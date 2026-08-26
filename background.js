(() => {
    "use strict";

    const NATIVE_HOST = "pt.kendir.gired_updater";
    const ALARM_NAME = "giredStructureMapperAutoUpdate";
    // Cada verificação por clone Git lança powershell + git (pesado para o sistema);
    // 4 em 4 horas chega perfeitamente para a equipa ficar atualizada.
    const CHECK_INTERVAL_MINUTES = 240;
    let updateInProgress = false;

    /** Instala imediatamente qualquer atualização que o Chrome já tenha descarregado da store. */
    chrome.runtime.onUpdateAvailable.addListener(() => {
        chrome.runtime.reload();
    });

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
        return new Promise(resolve => {
            try {
                chrome.runtime.requestUpdateCheck(status => {
                    if (chrome.runtime.lastError) {
                        resolve("no_update");
                        return;
                    }

                    resolve(status);
                });
            } catch (_) {
                resolve("no_update");
            }
        });
    }

    /** Verifica se existe uma atualização e instala-a automaticamente quando possível. */
    async function checkAndInstallUpdate() {
        if (updateInProgress) return;
        updateInProgress = true;

        try {
            // Instalação por clone Git (o manifest carregado sem compactação mantém a "key"):
            // o helper nativo faz fetch/pull do repositório e a extensão recarrega já.
            if (chrome.runtime.getManifest().key && chrome.runtime.sendNativeMessage) {
                const checkResponse = await sendNativeMessage({ action: "check" });
                if (!checkResponse?.ok || !checkResponse.updateAvailable) return;

                const updateResponse = await sendNativeMessage({ action: "update" });
                if (!updateResponse?.ok) return;

                chrome.runtime.reload();
                return;
            }

            // Instalação pela Chrome Web Store: o download fica a cargo do Chrome e o
            // onUpdateAvailable acima recarrega a extensão assim que estiver pronto.
            await requestStoreUpdateCheck();
        } catch (_) {
            // O updater pode ainda não estar configurado; o popup continua disponível como fallback.
        } finally {
            updateInProgress = false;
        }
    }

    /** Garante que existe uma verificação periódica de atualizações. */
    async function ensureUpdateAlarm() {
        if (!chrome.alarms) return;

        const alarm = await chrome.alarms.get(ALARM_NAME);
        if (alarm && alarm.periodInMinutes === CHECK_INTERVAL_MINUTES) return;

        chrome.alarms.create(ALARM_NAME, {
            delayInMinutes: 1,
            periodInMinutes: CHECK_INTERVAL_MINUTES
        });
    }

    chrome.runtime.onInstalled.addListener(() => {
        void ensureUpdateAlarm();
        void checkAndInstallUpdate();
    });

    chrome.runtime.onStartup.addListener(() => {
        void ensureUpdateAlarm();
        void checkAndInstallUpdate();
    });

    if (chrome.alarms) {
        chrome.alarms.onAlarm.addListener(alarm => {
            if (alarm.name !== ALARM_NAME) return;
            void checkAndInstallUpdate();
        });
    }

    void ensureUpdateAlarm();
})();
