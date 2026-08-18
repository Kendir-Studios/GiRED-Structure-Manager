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

    /** Indica se o elemento está efetivamente visível. */
    function isVisible(element) {
        if (!(element instanceof Element)) return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    }

    /** Obtém o texto original do item, ignorando badges já inseridos. */
    function getItemLabel(item) {
        const clone = item.cloneNode(true);
        clone.querySelectorAll(`.${BADGE_CLASS}`).forEach(badge => badge.remove());
        return normalizeText(clone.textContent);
    }

    /** Adiciona ou atualiza o badge de um item do dropdown. */
    function setBadge(item, code) {
        let badge = item.querySelector(`:scope > .${BADGE_CLASS}`);
        if (!badge) {
            badge = document.createElement("span");
            badge.className = BADGE_CLASS;
            badge.setAttribute("aria-hidden", "true");
            item.appendChild(badge);
        }

        badge.textContent = code;
        badge.classList.toggle("is-at", code.startsWith("AT"));
        badge.classList.toggle("is-introd", code === "INTROD");
    }

    /** Obtém todos os itens clicáveis reais de um dropdown, independentemente da profundidade do HTML. */
    function getMenuItems(menu) {
        const candidates = Array.from(menu.querySelectorAll('a, button, [role="menuitem"], [role="option"]'));

        return candidates.filter(item => {
            if (!isVisible(item)) return false;
            if (item.closest(`.${BADGE_CLASS}`)) return false;
            if (!getItemLabel(item)) return false;

            // Evita contar wrappers clicáveis que contêm outros itens clicáveis.
            return !candidates.some(other => other !== item && item.contains(other) && isVisible(other));
        });
    }

    /** Numera todos os itens do dropdown de SA ou AT atualmente aberto. */
    async function updateDropdowns() {
        if (location.hostname !== "cms.gired.pt") return;

        let context = null;
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            context = result[STORAGE_KEY] || null;
        } catch (_) {
            return;
        }

        if (!context) return;

        const saName = normalizeText(context.saName);
        const atName = normalizeText(context.atName);
        const menus = Array.from(document.querySelectorAll('.dropdown-menu, [role="menu"], [role="listbox"]')).filter(isVisible);

        menus.forEach(menu => {
            const items = getMenuItems(menu);
            if (items.length < 2) return;

            const labels = items.map(getItemLabel);
            const isSaMenu = saName && labels.includes(saName);
            const isAtMenu = atName && labels.includes(atName);

            if (isSaMenu) {
                items.forEach((item, index) => setBadge(item, `SA ${formatNumber(index + 1)}`));
                return;
            }

            if (isAtMenu) {
                items.forEach((item, index) => setBadge(item, index === 0 ? "INTROD" : `AT ${formatNumber(index)}`));
            }
        });
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

        const observer = new MutationObserver(scheduleUpdate);
        observer.observe(document.body, { childList: true, subtree: true });

        if (chrome?.storage?.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === "local" && changes[STORAGE_KEY]) scheduleUpdate();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
