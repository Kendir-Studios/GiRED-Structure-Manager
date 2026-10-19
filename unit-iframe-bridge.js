(() => {
    "use strict";

    /**
     * Ponte entre a unit page do micro-frontend de autoria (apps.gired.pt/authoring/...) e o
     * Studio incorporado no seu iframe (cms.gired.pt/container_embed/...).
     *
     * Os modais antigos do Studio ("Editando: ...", "Gerir o Acesso", "Mover") abrem dentro do
     * iframe, e aí `position: fixed` e `100vh` referem-se ao iframe e não ao ecrã. Enquanto um
     * modal está aberto, o iframe avisa a página e esta põe-no em ecrã inteiro, para o modal
     * continuar a ocupar quase todo o ecrã como no Studio antigo.
     *
     * Este ficheiro corre em todos os frames: no iframe do Studio comporta-se como emissor,
     * na página principal como recetor.
     */

    const CMS_HOST_PATTERN = /(^|[.-])cms[.]gired[.]pt$/;
    const SOURCE = "gired-fixer";
    const IFRAME_SELECTOR = "iframe.course-unit__xblock-iframe";
    const MODAL_WINDOW_SELECTOR = ".wrapper-modal-window .modal-window";
    const ENABLED_KEY = "giredStructureMapperEnabled";
    const DISABLED_CLASS = "gired-structure-mapper-disabled";
    const EMBEDDED_CLASS = "gired-embedded";
    const MANAGED_CLASS = "gired-embed-managed";
    const IFRAME_OPEN_CLASS = "gired-unit-iframe-modal-open";
    const PAGE_OPEN_CLASS = "gired-unit-modal-open";
    const PLACEHOLDER_CLASS = "gired-unit-iframe-placeholder";

    /** Indica se a extensão está atualmente ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains(DISABLED_CLASS);
    }

    /** Indica se um elemento está realmente visível. */
    function isVisible(element) {
        if (typeof element.checkVisibility === "function") return element.checkVisibility();
        return element.getClientRects().length > 0;
    }

    /** Hostname de uma origem, ou vazio se não for um URL válido. */
    function hostnameOf(origin) {
        try { return new URL(origin).hostname; } catch (_) { return ""; }
    }

    /** Lado do Studio incorporado: anuncia-se à página e reporta a abertura dos modais antigos. */
    function startEmbedSide() {
        document.documentElement.classList.add(EMBEDDED_CLASS);

        // O Studio usa o referrer para falar com a página; fazemos o mesmo, com "*" como recurso.
        let parentOrigin = "*";
        try { if (document.referrer) parentOrigin = new URL(document.referrer).origin; } catch (_) {}

        const post = message => {
            try { window.parent.postMessage({ source: SOURCE, ...message }, parentOrigin); } catch (_) {}
        };

        let lastOpen = null;
        const report = () => {
            const open = Array.from(document.querySelectorAll(MODAL_WINDOW_SELECTOR)).some(isVisible);
            if (open === lastOpen) return;
            lastOpen = open;
            post({ type: "modal", open });
        };

        let scheduled = false;
        const observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; report(); });
        });
        observer.observe(document.documentElement, {
            childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"]
        });

        window.addEventListener("message", event => {
            if (event.source !== window.parent) return;
            const data = event.data;
            if (!data || data.source !== SOURCE || data.type !== "hello-ack") return;
            // Só com a confirmação da página é que o CSS do modal pode assumir o ecrã inteiro.
            document.documentElement.classList.toggle(MANAGED_CLASS, data.managed !== false);
        });

        post({ type: "hello" });
        report();
    }

    /** Lado da página: põe o iframe da unidade em ecrã inteiro enquanto um modal está aberto. */
    function startPageSide() {
        let activeFrame = null;
        let placeholder = null;
        let modalOpen = false;

        const unitFrame = () => document.querySelector(IFRAME_SELECTOR);

        const close = () => {
            if (activeFrame) activeFrame.classList.remove(IFRAME_OPEN_CLASS);
            placeholder?.remove();
            placeholder = null;
            document.documentElement.classList.remove(PAGE_OPEN_CLASS);
            modalOpen = false;
        };

        const open = frame => {
            if (modalOpen && frame === activeFrame) return;
            close();
            if (!isExtensionEnabled()) return;
            activeFrame = frame;
            modalOpen = true;
            // Um marcador com a altura atual mantém o lugar do iframe, para a página não saltar.
            placeholder = document.createElement("div");
            placeholder.className = PLACEHOLDER_CLASS;
            placeholder.style.height = `${Math.round(frame.getBoundingClientRect().height)}px`;
            frame.after(placeholder);
            frame.classList.add(IFRAME_OPEN_CLASS);
            document.documentElement.classList.add(PAGE_OPEN_CLASS);
        };

        window.addEventListener("message", event => {
            const data = event.data;
            if (!data || data.source !== SOURCE) return;
            if (!CMS_HOST_PATTERN.test(hostnameOf(event.origin))) return;
            const frame = unitFrame();
            if (!frame || event.source !== frame.contentWindow) return;

            if (data.type === "hello") {
                close();
                activeFrame = frame;
                event.source.postMessage({ source: SOURCE, type: "hello-ack", managed: true }, event.origin);
                return;
            }
            if (data.type === "modal") {
                if (data.open) open(frame);
                else close();
            }
        });

        // Se o iframe recarregar, desaparecer ou a extensão for desligada, tudo volta ao normal.
        document.addEventListener("load", event => {
            if (event.target instanceof HTMLIFrameElement && event.target === activeFrame) close();
        }, true);

        const observer = new MutationObserver(() => {
            if (modalOpen && (!activeFrame || !activeFrame.isConnected)) close();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        if (chrome?.storage?.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === "local" && changes[ENABLED_KEY]?.newValue === false) close();
            });
        }
    }

    if (window !== window.top) {
        if (CMS_HOST_PATTERN.test(location.hostname)) startEmbedSide();
    } else {
        startPageSide();
    }
})();
