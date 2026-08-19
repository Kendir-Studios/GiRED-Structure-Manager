(() => {
    "use strict";

    const NATIVE_HOST = "pt.kendir.gired_updater";
    const ALARM_NAME = "giredStructureMapperAutoUpdate";
    const CHECK_INTERVAL_MINUTES = 60;
    let updateInProgress = false;

    /** Cria o ícone da extensão diretamente em memória para evitar ficheiros binários externos. */
    function createToolbarIcon(size) {
        const canvas = new OffscreenCanvas(size, size);
        const context = canvas.getContext("2d");
        const scale = size / 48;

        context.scale(scale, scale);
        context.lineJoin = "round";

        context.fillStyle = "#0e1820";
        context.strokeStyle = "#12b8aa";
        context.lineWidth = 2.4;
        context.beginPath();
        context.moveTo(24, 3);
        context.lineTo(42, 13.5);
        context.lineTo(42, 34.5);
        context.lineTo(24, 45);
        context.lineTo(6, 34.5);
        context.lineTo(6, 13.5);
        context.closePath();
        context.fill();
        context.stroke();

        context.fillStyle = "#f7fbfc";
        context.beginPath();
        context.moveTo(24, 11);
        context.lineTo(35, 17.5);
        context.lineTo(24, 24);
        context.lineTo(13, 17.5);
        context.closePath();
        context.fill();

        context.fillStyle = "#bcd8e0";
        context.beginPath();
        context.moveTo(13, 23);
        context.lineTo(24, 29.5);
        context.lineTo(35, 23);
        context.lineTo(35, 28);
        context.lineTo(24, 34.5);
        context.lineTo(13, 28);
        context.closePath();
        context.fill();

        context.fillStyle = "#496d7d";
        context.beginPath();
        context.moveTo(13, 31);
        context.lineTo(24, 37.5);
        context.lineTo(35, 31);
        context.lineTo(35, 35);
        context.lineTo(24, 41.5);
        context.lineTo(13, 35);
        context.closePath();
        context.fill();

        return context.getImageData(0, 0, size, size);
    }

    /** Aplica o ícone visual da extensão na barra do browser. */
    async function applyToolbarIcon() {
        try {
            await chrome.action.setIcon({
                imageData: {
                    16: createToolbarIcon(16),
                    32: createToolbarIcon(32)
                }
            });
        } catch (_) {
            // Mantém o ícone padrão caso o browser não suporte OffscreenCanvas neste contexto.
        }
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
        void applyToolbarIcon();
        void ensureUpdateAlarm();
        void checkAndInstallUpdate();
    });

    chrome.runtime.onStartup.addListener(() => {
        void applyToolbarIcon();
        void ensureUpdateAlarm();
        void checkAndInstallUpdate();
    });

    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name !== ALARM_NAME) return;
        void checkAndInstallUpdate();
    });

    void applyToolbarIcon();
    void ensureUpdateAlarm();
})();
