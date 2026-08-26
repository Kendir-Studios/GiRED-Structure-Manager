(() => {
    "use strict";

    const CONTAINER_SELECTOR = "#sequence-nav";
    const NATIVE_NAV_SELECTOR = ".sequence-nav";
    const RESTORED_CLASS = "gired-sequence-nav-restored";
    const STORAGE_KEY = "giredSequenceNavSnapshotsV1";
    const MAX_SNAPSHOTS = 40;
    const MISSING_GRACE_MS = 2500;

    const SAVE_THROTTLE_MS = 2000;

    let missingTimer = null;
    let saveScheduled = false;
    let selfMutationPending = false;
    let lastSavedHtml = "";
    let lastSaveAt = 0;

    /** Indica se a extensão está atualmente ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains("gired-structure-mapper-disabled");
    }

    /** Usage id da unidade (vertical) atualmente aberta no CMS. */
    function getCurrentVerticalId() {
        const holder = document.querySelector('.nav-actions[data-block-type="vertical"][data-usage-id], .xblock-header-primary[data-block-type="vertical"][data-usage-id], .wrapper-xblock.level-page[data-locator]');
        return holder?.getAttribute("data-usage-id") || holder?.getAttribute("data-locator") || "";
    }

    /** Lê as cópias guardadas da barra de sequência. */
    function readSnapshots() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    /** Guarda as cópias, mantendo apenas as mais recentes. */
    function writeSnapshots(snapshots) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)));
        } catch (_) {
            // Sem espaço ou sem localStorage; a funcionalidade degrada-se graciosamente.
        }
    }

    /** Devolve a cópia mais recente que inclua a unidade atual. */
    function findSnapshotForVertical(verticalId) {
        if (!verticalId) return null;
        return readSnapshots().find(snapshot => snapshot.verticals.includes(verticalId)) || null;
    }

    /** Guarda uma cópia da barra nativa enquanto ela existe e está completa. */
    function saveSnapshot() {
        saveScheduled = false;
        const container = document.querySelector(CONTAINER_SELECTOR);
        const nav = container?.querySelector(NATIVE_NAV_SELECTOR);
        if (!container || !nav || container.classList.contains(RESTORED_CLASS)) return;

        const sequence = container.querySelector(".sequence[data-id]");
        const tabs = Array.from(nav.querySelectorAll(".nav-item.tab[data-id]"));
        if (!sequence || !tabs.length) return;

        // Sem esta guarda, cada rajada de mutações do Studio serializava a barra e
        // reescrevia todos os snapshots no localStorage (writes síncronos pesados).
        const html = container.innerHTML;
        lastSaveAt = Date.now();
        if (html === lastSavedHtml) return;

        const snapshot = {
            sequentialId: sequence.getAttribute("data-id"),
            verticals: tabs.map(tab => tab.getAttribute("data-id")),
            html,
            savedAt: Date.now()
        };

        const others = readSnapshots().filter(item => item.sequentialId !== snapshot.sequentialId);
        writeSnapshots([snapshot, ...others]);
        lastSavedHtml = html;
    }

    /** Agenda uma gravação espaçada para não pesar durante as mutações do Studio. */
    function scheduleSave() {
        if (saveScheduled) return;
        saveScheduled = true;
        const delay = Math.max(0, SAVE_THROTTLE_MS - (Date.now() - lastSaveAt));
        window.setTimeout(saveSnapshot, delay);
    }

    /** Ajusta a cópia restaurada para refletir a unidade atual como ativa. */
    function markActiveTab(container, verticalId) {
        const tabs = Array.from(container.querySelectorAll(".nav-item.tab[data-id]"));
        const activeIndex = tabs.findIndex(tab => tab.getAttribute("data-id") === verticalId);

        tabs.forEach((tab, index) => {
            const isActive = index === activeIndex;
            tab.classList.toggle("active", isActive);
            tab.classList.toggle("inactive", !isActive);
            tab.setAttribute("aria-selected", String(isActive));
            tab.setAttribute("aria-expanded", String(isActive));
            tab.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        const sequence = container.querySelector(".sequence");
        if (sequence && activeIndex >= 0) {
            const previous = tabs[activeIndex - 1]?.getAttribute("data-href") || "";
            const next = tabs[activeIndex + 1]?.getAttribute("data-href") || "";
            sequence.setAttribute("data-position", String(activeIndex + 1));
            sequence.setAttribute("data-prev-url", previous);
            sequence.setAttribute("data-next-url", next);
            container.querySelector(".button-previous")?.toggleAttribute("disabled", !previous);
            container.querySelector(".button-next")?.toggleAttribute("disabled", !next);
        }
    }

    /** Liga a navegação da cópia restaurada, já que os handlers nativos se perderam. */
    function wireRestoredNav(container) {
        if (container.dataset.giredWired) return;
        container.dataset.giredWired = "true";

        container.addEventListener("click", event => {
            if (!container.classList.contains(RESTORED_CLASS)) return;
            const tab = event.target.closest(".nav-item.tab[data-href]");
            if (tab) {
                event.preventDefault();
                window.location.assign(tab.getAttribute("data-href"));
                return;
            }

            const sequence = container.querySelector(".sequence");
            if (event.target.closest(".button-previous")) {
                event.preventDefault();
                const url = sequence?.getAttribute("data-prev-url");
                if (url) window.location.assign(url);
                return;
            }
            if (event.target.closest(".button-next")) {
                event.preventDefault();
                const url = sequence?.getAttribute("data-next-url");
                if (url) window.location.assign(url);
                return;
            }

            if (event.target.closest("#new-unit-button, .dropdown-toggle-button, .seq_paste_unit")) {
                event.preventDefault();
                event.stopPropagation();
                window.location.reload();
            }
        });

        container.querySelectorAll("#new-unit-button, .dropdown-toggle-button").forEach(button => {
            button.setAttribute("title", "Recarrega a página para criar ou colar unidades");
        });
        container.querySelector(".dropdown-options")?.setAttribute("style", "display: none;");
    }

    /** Repõe a última cópia conhecida quando a barra nativa não aparece. */
    function restoreNav() {
        missingTimer = null;
        if (!isExtensionEnabled()) return;

        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container || container.querySelector(NATIVE_NAV_SELECTOR)) return;

        const verticalId = getCurrentVerticalId();
        const snapshot = findSnapshotForVertical(verticalId);
        if (!snapshot) return;

        selfMutationPending = true;
        container.innerHTML = snapshot.html;
        container.classList.add(RESTORED_CLASS);
        container.querySelectorAll(".xblock-initialized").forEach(el => el.classList.remove("xblock-initialized"));
        markActiveTab(container, verticalId);
        wireRestoredNav(container);
    }

    /** Verifica o estado da barra e decide entre guardar, restaurar ou ceder à versão nativa. */
    function check() {
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) return;

        const nav = container.querySelector(NATIVE_NAV_SELECTOR);
        const isRestored = container.classList.contains(RESTORED_CLASS);

        if (nav && !isRestored) {
            if (missingTimer) {
                clearTimeout(missingTimer);
                missingTimer = null;
            }
            scheduleSave();
            return;
        }

        // Enquanto a cópia restaurada estiver no lugar, não há nada a fazer: se o Studio voltar a
        // renderizar a barra nativa, substitui o nosso conteúdo e o observador limpa a marca.
        if (isRestored) return;

        if (!nav && !missingTimer && isExtensionEnabled()) {
            missingTimer = setTimeout(restoreNav, MISSING_GRACE_MS);
        }
    }

    /** Observa o contentor e o documento, já que o Studio injeta e substitui a barra dinamicamente. */
    function startObserver() {
        let scheduled = false;
        const observer = new MutationObserver(mutations => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                const container = document.querySelector(CONTAINER_SELECTOR);
                if (selfMutationPending) {
                    selfMutationPending = false;
                } else if (container?.classList.contains(RESTORED_CLASS)) {
                    // Qualquer substituição de conteúdo pelo Studio limpa o estado restaurado.
                    const nav = container.querySelector(NATIVE_NAV_SELECTOR);
                    const restoredTouched = mutations.some(m => m.target === container && m.removedNodes.length);
                    if (restoredTouched || !nav) container.classList.remove(RESTORED_CLASS);
                }
                check();
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes.giredStructureMapperEnabled) return;
            if (changes.giredStructureMapperEnabled.newValue === false && missingTimer) {
                clearTimeout(missingTimer);
                missingTimer = null;
            }
        });
    }

    check();
    startObserver();
})();
