(() => {
    "use strict";

    const REVIEW_LEFT_KEY = "giredReviewSidebarLeft";
    const LEFT_CLASS = "gired-review-sidebar-left";
    const SIDEBAR_SELECTOR = "#vc-review-sidebar";
    const WIDTH_VARIABLE = "--gired-review-sidebar-width";

    let updateScheduled = false;

    /**
     * Atualiza a largura usada para reservar espaço para o painel quando este fica à esquerda.
     */
    function updateSidebarWidth() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const rectWidth = sidebar.getBoundingClientRect().width;
        const computedWidth = Number.parseFloat(window.getComputedStyle(sidebar).width) || 0;
        const width = rectWidth || computedWidth;

        if (width > 0) {
            document.documentElement.style.setProperty(WIDTH_VARIABLE, `${Math.round(width)}px`);
        }
    }

    /** Agenda a leitura da largura para evitar trabalho repetido durante alterações do DOM. */
    function scheduleWidthUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;

        window.requestAnimationFrame(() => {
            updateScheduled = false;
            updateSidebarWidth();
        });
    }

    /** Aplica o lado escolhido ao documento atual. */
    function applyReviewSide(useLeftSide) {
        document.documentElement.classList.toggle(LEFT_CLASS, useLeftSide);

        if (useLeftSide) {
            scheduleWidthUpdate();
        }
    }

    /** Carrega a preferência guardada. Por omissão, o painel de revisão fica à esquerda. */
    async function loadReviewSide() {
        try {
            const result = await chrome.storage.local.get(REVIEW_LEFT_KEY);
            applyReviewSide(result[REVIEW_LEFT_KEY] !== false);
        } catch (_) {
            applyReviewSide(true);
        }
    }

    /** Atualiza imediatamente a página quando a preferência é alterada no popup. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[REVIEW_LEFT_KEY]) return;
            applyReviewSide(changes[REVIEW_LEFT_KEY].newValue !== false);
        });
    }

    /**
     * O painel de revisão é inserido dinamicamente pelo GiRED, por isso observamos o DOM
     * para obter a largura correta assim que o painel existir.
     */
    const observer = new MutationObserver(() => {
        if (!document.documentElement.classList.contains(LEFT_CLASS)) return;
        scheduleWidthUpdate();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.addEventListener("resize", scheduleWidthUpdate, { passive: true });

    void loadReviewSide();
})();
