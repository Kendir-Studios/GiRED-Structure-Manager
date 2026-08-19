(() => {
    "use strict";

    const NATIVE_HOST = "pt.kendir.gired_updater";
    const ALARM_NAME = "giredStructureMapperAutoUpdate";
    const CHECK_INTERVAL_MINUTES = 60;
    let updateInProgress = false;

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

    /** Verifica se existe uma atualização e instala-a automaticamente quando possível. */
    async function checkAndInstallUpdate() {
        if (updateInProgress) return;
        updateInProgress = true;

        try {
            const checkResponse = await sendNativeMessage({ action: "check" });
            if (!checkResponse?.ok || !checkResponse.updateAvailable) return;

            const updateResponse = await sendNativeMessage({ action: "update" });
            if (!updateResponse?.ok) return;

            chrome.runtime.reload();
        } catch (_) {
            // O updater pode ainda não estar configurado; o popup continua disponível como fallback.
        } finally {
            updateInProgress = false;
        }
    }

    /** Garante que existe uma verificação periódica de atualizações. */
    async function ensureUpdateAlarm() {
        const alarm = await chrome.alarms.get(ALARM_NAME);
        if (alarm) return;

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

    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name !== ALARM_NAME) return;
        void checkAndInstallUpdate();
    });

    void ensureUpdateAlarm();
})();
