(() => {
    "use strict";

    const FAVORITES_KEY = "giredQuickAddFavoritesV1";
    const DEFAULT_FAVORITES = ["sage_singlechoiceunified", "sage_multipleselectionunified"];
    const PANEL_CLASS = "gired-quick-favorites";
    const TILE_CLASS = "gired-quick-add-button";
    const STAR_CLASS = "gired-quick-fav-star";
    const STAR_ITEM_CLASS = "gired-quick-fav-item";
    const TEMPLATE_BUTTON_SELECTOR = ".new-component-templates.new-component-advanced .button-component";

    let favorites = null;
    let scheduled = false;

    /** Lê os favoritos guardados; na primeira utilização propõe os "(Unified)". */
    async function loadFavorites() {
        try {
            const result = await chrome.storage.local.get(FAVORITES_KEY);
            const stored = result[FAVORITES_KEY];
            favorites = Array.isArray(stored) ? stored : DEFAULT_FAVORITES.slice();
        } catch (_) {
            favorites = DEFAULT_FAVORITES.slice();
        }
    }

    /** Guarda os favoritos no armazenamento da extensão (partilhado entre tabs). */
    function saveFavorites() {
        try {
            void chrome.storage.local.set({ [FAVORITES_KEY]: favorites });
        } catch (_) {}
    }

    /** Adiciona ou remove uma dinâmica dos favoritos. */
    function toggleFavorite(category) {
        if (!favorites) return;
        const index = favorites.indexOf(category);
        if (index >= 0) favorites.splice(index, 1);
        else favorites.push(category);
        saveFavorites();
        scheduleEnsure();
    }

    /** Cria um botão de favorito que aciona diretamente o modelo indicado. */
    function createQuickTile(entry) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = TILE_CLASS;
        button.title = `Adicionar diretamente: ${entry.name}`;
        button.dataset.category = entry.category;

        const icon = document.createElement("span");
        icon.className = `${TILE_CLASS}__plus`;
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "+";

        const label = document.createElement("span");
        label.className = `${TILE_CLASS}__name`;
        label.textContent = entry.name;

        button.append(icon, label);
        item.appendChild(button);

        // O clique é reencaminhado para o botão nativo do submenu Avançado,
        // resolvido na altura do clique porque o Studio recria estes menus.
        button.addEventListener("click", event => {
            event.preventDefault();
            document.querySelector(`${TEMPLATE_BUTTON_SELECTOR}[data-category="${entry.category}"]`)?.click();
        });

        return item;
    }

    /** Injeta uma estrela de favorito em cada item do submenu Avançado. */
    function ensureStars(container) {
        container.querySelectorAll(TEMPLATE_BUTTON_SELECTOR).forEach(template => {
            const item = template.closest("li");
            const category = template.dataset.category || "";
            if (!item || !category) return;

            let star = item.querySelector(`.${STAR_CLASS}`);
            if (!star) {
                star = document.createElement("button");
                star.type = "button";
                star.className = STAR_CLASS;
                // A estrela vive ao lado do botão nativo (não dentro dele) e trava
                // a propagação, para marcar favoritos sem criar o componente.
                star.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavorite(category);
                });
                item.classList.add(STAR_ITEM_CLASS);
                item.appendChild(star);
            }

            const active = favorites.includes(category);
            star.classList.toggle("is-active", active);
            const glyph = active ? "★" : "☆";
            if (star.textContent !== glyph) star.textContent = glyph;
            const title = active ? "Remover dos favoritos" : "Adicionar aos favoritos";
            if (star.getAttribute("title") !== title) star.setAttribute("title", title);
            const pressed = String(active);
            if (star.getAttribute("aria-pressed") !== pressed) star.setAttribute("aria-pressed", pressed);
        });
    }

    /** Cria o painel "Favoritos", alinhado com o menu nativo de componentes. */
    function buildPanel(container) {
        const panel = document.createElement("div");
        panel.className = PANEL_CLASS;

        const header = document.createElement("div");
        header.className = `${PANEL_CLASS}__header`;
        header.title = "Gere esta lista com as estrelas do menu Avançado";

        const badge = document.createElement("span");
        badge.className = `${PANEL_CLASS}__icon`;
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "★";

        const title = document.createElement("span");
        title.className = `${PANEL_CLASS}__title`;
        title.textContent = "Favoritos";

        header.append(badge, title);

        const list = document.createElement("ul");
        list.className = `${PANEL_CLASS}__list`;

        panel.append(header, list);
        container.before(panel);
        return panel;
    }

    /** Mantém o painel de favoritos por cima do menu nativo (só quando há favoritos). */
    function ensureFavoritesPanel(container) {
        const sibling = container.previousElementSibling;
        let panel = sibling?.classList?.contains(PANEL_CLASS) ? sibling : null;

        const entries = favorites
            .map(category => {
                const template = container.querySelector(`${TEMPLATE_BUTTON_SELECTOR}[data-category="${category}"]`);
                const name = (template?.querySelector(".name")?.textContent || "").trim();
                return name ? { category, name } : null;
            })
            .filter(Boolean);

        if (!entries.length) {
            panel?.remove();
            return;
        }

        if (!panel) panel = buildPanel(container);

        // Só reconstruímos a lista quando o conjunto de favoritos muda de facto.
        const signature = entries.map(entry => entry.category).join("|");
        if (panel.dataset.signature === signature) return;
        panel.dataset.signature = signature;

        const list = panel.querySelector(`.${PANEL_CLASS}__list`);
        list.textContent = "";
        entries.forEach(entry => list.appendChild(createQuickTile(entry)));
    }

    /** Garante estrelas e painel em todos os menus de componentes da página. */
    function ensureQuickFavorites() {
        scheduled = false;
        if (location.hostname !== "cms.gired.pt" || !favorites) return;

        document.querySelectorAll(`.add-xblock-component:not(.${PANEL_CLASS})`).forEach(container => {
            if (!container.querySelector(TEMPLATE_BUTTON_SELECTOR)) return;
            ensureStars(container);
            ensureFavoritesPanel(container);
        });
    }

    /** Agrupa alterações rápidas do DOM numa única passagem. */
    function scheduleEnsure() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(ensureQuickFavorites);
    }

    /** O Studio recria o menu depois de criar/colar componentes. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation =>
                !(mutation.target instanceof Element)
                || !mutation.target.closest(`.${PANEL_CLASS}, .${STAR_CLASS}`));
            if (relevant) scheduleEnsure();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /** Outra tab pode alterar os favoritos; refletimos a mudança de imediato. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[FAVORITES_KEY]) return;
            const value = changes[FAVORITES_KEY].newValue;
            favorites = Array.isArray(value) ? value : [];
            scheduleEnsure();
        });
    }

    async function initialize() {
        await loadFavorites();
        ensureQuickFavorites();
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => void initialize(), { once: true });
    } else {
        void initialize();
    }
})();
