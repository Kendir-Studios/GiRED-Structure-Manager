(() => {
    "use strict";

    const LEGACY_VERSION_RIGHT_KEY = "giredVersionSidebarRight";
    const LEGACY_RIGHT_CLASS = "gired-version-sidebar-right";
    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const OPEN_BODY_CLASS = "course-vc-open";
    const WIDTH_VARIABLE = "--gired-version-sidebar-width";

    let updateScheduled = false;

    /** Indica se o painel nativo de Controlo de Versões está aberto. */
    function isVersionSidebarOpen() {
        return document.body?.classList.contains(OPEN_BODY_CLASS) === true;
    }

    /**
     * Mede a largura real do painel nativo e guarda-a numa variável CSS.
     * A página usa esta largura para reservar espaço à esquerda enquanto o painel está aberto.
     */
    function updateSidebarWidth() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const rectWidth = sidebar.getBoundingClientRect().width;
        const computedWidth = Number.parseFloat(window.getComputedStyle(sidebar).width) || 0;
        const width = rectWidth || computedWidth;

        if (width > 0) {
            const nextValue = `${Math.round(width)}px`;
            if (document.documentElement.style.getPropertyValue(WIDTH_VARIABLE) !== nextValue) {
                document.documentElement.style.setProperty(WIDTH_VARIABLE, nextValue);
            }
        }
    }

    /** Agenda a medição para o próximo frame, evitando cálculos repetidos. */
    function scheduleWidthUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;

        window.requestAnimationFrame(() => {
            updateScheduled = false;
            updateSidebarWidth();
        });
    }

    /**
     * Remove a preferência antiga que permitia mover o painel para a direita.
     * A partir desta versão, o Controlo de Versões mantém sempre o lado esquerdo nativo do GiRED.
     */
    async function removeLegacyRightPreference() {
        document.documentElement.classList.remove(LEGACY_RIGHT_CLASS);

        try {
            await chrome.storage.local.remove(LEGACY_VERSION_RIGHT_KEY);
        } catch (_) {
            // A limpeza da preferência antiga não deve impedir o funcionamento do painel.
        }
    }

    /** Sincroniza a largura sempre que o painel nativo está aberto. */
    function syncOpenPanel() {
        if (!isVersionSidebarOpen()) return;
        scheduleWidthUpdate();
    }

    /**
     * O painel pode ser inserido dinamicamente pelo GiRED.
     * O observer garante que a largura é medida assim que o painel estiver disponível.
     */
    const domObserver = new MutationObserver(() => {
        syncOpenPanel();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /**
     * O GiRED abre e fecha o Controlo de Versões através da classe `course-vc-open` no body.
     * Quando abre, medimos o painel e a página passa automaticamente a reservar esse espaço.
     */
    if (document.body) {
        const bodyObserver = new MutationObserver(() => {
            syncOpenPanel();
        });

        bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    /** Mantém a reserva correta caso a janela ou o painel mudem de largura. */
    window.addEventListener("resize", () => {
        if (isVersionSidebarOpen()) {
            scheduleWidthUpdate();
        }
    }, { passive: true });

    void removeLegacyRightPreference().then(syncOpenPanel);
})();
