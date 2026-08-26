(() => {
    "use strict";

    const BADGE_CLASS = "gired-structure-mapper-menu-badge";
    const STORAGE_KEY = "giredStructureMapperContextV2";
    let scheduled = false;

    /** Normaliza texto para comparar os nomes apresentados pelo CMS. */
    function normalizeText(value) {
        return (value || "").replace(/\s+/g, " ").trim();
    }

    /** Formata os códigos com dois algarismos. */
    function formatNumber(value) {
        return String(value).padStart(2, "0");
    }

    /** Obtém o texto original do link, ignorando badges já inseridos. */
    function getLinkLabel(link) {
        let text = "";
        for (const node of link.childNodes) {
            if (node instanceof Element && node.classList.contains(BADGE_CLASS)) continue;
            text += node.textContent;
        }
        return normalizeText(text);
    }

    /** Adiciona ou atualiza um badge dentro do link do item. */
    function setBadge(link, code) {
        const item = link.closest("li.nav-item") || link.parentElement;
        item?.querySelectorAll(`:scope > .gired-structure-mapper-cms-sa`).forEach(badge => badge.remove());

        let badge = link.querySelector(`:scope > .${BADGE_CLASS}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = BADGE_CLASS;
            badge.setAttribute("aria-hidden", "true");
            link.appendChild(badge);
        }

        // Atribuir o mesmo texto substitui na mesma o text node e gera uma mutação,
        // o que realimentava o MutationObserver num ciclo contínuo.
        if (badge.textContent !== code) badge.textContent = code;
        badge.classList.toggle("is-at", code.startsWith("AT"));
        badge.classList.toggle("is-introd", code === "INTROD");
    }

    /** Obtém exatamente os links diretos do nav-sub real do CMS. */
    function getNavSubLinks(navSub) {
        return Array.from(navSub.querySelectorAll(":scope > ul > li.nav-item > a"));
    }

    /** Numera um nav-sub de acordo com o item atual nele contido. */
    function numberNavSub(navSub, context) {
        const links = getNavSubLinks(navSub);
        if (links.length < 2) return;

        const labels = links.map(getLinkLabel);
        const saName = normalizeText(context?.saName);
        const atName = normalizeText(context?.atName);

        if (saName && labels.includes(saName)) {
            links.forEach((link, index) => setBadge(link, `SA ${formatNumber(index + 1)}`));
            return;
        }

        if (atName && labels.includes(atName)) {
            links.forEach((link, index) => setBadge(link, index === 0 ? "INTROD" : `AT ${formatNumber(index)}`));
        }
    }

    // O contexto só muda via storage.onChanged; evita uma leitura por passagem.
    let contextPromise = null;

    /** Lê (com cache) o contexto atual guardado pelo Structure Mapper. */
    function getContext() {
        if (!contextPromise) {
            contextPromise = (async () => {
                try {
                    const result = await chrome.storage.local.get(STORAGE_KEY);
                    return result[STORAGE_KEY] || null;
                } catch (_) {
                    return null;
                }
            })();
        }
        return contextPromise;
    }

    /** Numera todos os nav-sub existentes no CMS. */
    async function updateDropdowns() {
        if (location.hostname !== "cms.gired.pt") return;
        if (!document.querySelector("div.nav-sub")) return;

        const context = await getContext();
        if (!context) return;
        document.querySelectorAll("div.nav-sub").forEach(navSub => numberNavSub(navSub, context));
    }

    /** Agrupa alterações rápidas do DOM numa única atualização. */
    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            void updateDropdowns();
        });
    }

    /** Inicializa a deteção dos dropdowns dinâmicos do CMS. */
    function initialize() {
        scheduleUpdate();
        document.addEventListener("click", scheduleUpdate, true);

        // Ignora as mutações provocadas pelos nossos próprios badges para não
        // reagendar atualizações em cadeia.
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation =>
                !(mutation.target instanceof Element) || !mutation.target.closest(`.${BADGE_CLASS}`));
            if (relevant) scheduleUpdate();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        if (chrome?.storage?.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === "local" && changes[STORAGE_KEY]) {
                    contextPromise = Promise.resolve(changes[STORAGE_KEY].newValue || null);
                    scheduleUpdate();
                }
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
