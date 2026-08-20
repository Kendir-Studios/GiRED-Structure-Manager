(() => {
    "use strict";

    const VERSION_RIGHT_KEY = "giredVersionSidebarRight";
    const RIGHT_CLASS = "gired-version-sidebar-right";
    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const OPEN_BODY_CLASS = "course-vc-open";
    const WIDTH_VARIABLE = "--gired-version-sidebar-width";

    let updateScheduled = false;

    /** Indica se o painel nativo de Controlo de Versões está aberto. */
    function isVersionSidebarOpen() {
        return document.body?.classList.contains(OPEN_BODY_CLASS) === true;
    }

    /** Atualiza a largura reservada para o painel quando este é apresentado à direita. */
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

    /** Agenda a leitura da largura para evitar cálculos repetidos durante alterações do DOM. */
    function scheduleWidthUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;

        window.requestAnimationFrame(() => {
            updateScheduled = false;
            updateSidebarWidth();
        });
    }

    /** Aplica o lado escolhido sem abrir nem fechar o painel nativo. */
    function applyVersionSide(useRightSide) {
        document.documentElement.classList.toggle(RIGHT_CLASS, useRightSide);

        if (useRightSide && isVersionSidebarOpen()) {
            scheduleWidthUpdate();
        }
    }

    /** Carrega a preferência guardada. Por omissão, o painel fica do lado direito. */
    async function loadVersionPreference() {
        try {
            const result = await chrome.storage.local.get(VERSION_RIGHT_KEY);
            applyVersionSide(result[VERSION_RIGHT_KEY] !== false);
        } catch (_) {
            applyVersionSide(true);
        }
    }

    /** Atualiza imediatamente a página quando a preferência é alterada no popup. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[VERSION_RIGHT_KEY]) return;
            applyVersionSide(changes[VERSION_RIGHT_KEY].newValue !== false);
        });
    }

    /**
     * O painel é inserido dinamicamente pelo GiRED. O observer permite obter a largura
     * correta assim que o Controlo de Versões estiver disponível e aberto.
     */
    const domObserver = new MutationObserver(() => {
        if (!document.documentElement.classList.contains(RIGHT_CLASS)) return;
        if (!isVersionSidebarOpen()) return;
        scheduleWidthUpdate();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /** A abertura/fecho é sinalizada pelo próprio GiRED através de `course-vc-open`. */
    if (document.body) {
        const bodyObserver = new MutationObserver(() => {
            if (!document.documentElement.classList.contains(RIGHT_CLASS)) return;
            if (!isVersionSidebarOpen()) return;
            scheduleWidthUpdate();
        });

        bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    /** Recalcula a largura se o viewport mudar enquanto o painel estiver aberto. */
    window.addEventListener("resize", () => {
        if (document.documentElement.classList.contains(RIGHT_CLASS) && isVersionSidebarOpen()) {
            scheduleWidthUpdate();
        }
    }, { passive: true });

    void loadVersionPreference();
})();
