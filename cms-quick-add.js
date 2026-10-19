(() => {
    "use strict";

    /** Hostnames do Studio (CMS) do GiRED: cms.gired.pt e variantes como gired-uat-cms.gired.pt. */
    const CMS_HOST_PATTERN = /(^|[.-])cms[.]gired[.]pt$/;

    const FAVORITES_KEY = "giredQuickAddFavoritesV1";
    const NAMES_KEY = "giredQuickAddNamesV1";
    const DEFAULT_FAVORITES = ["sage_singlechoiceunified", "sage_multipleselectionunified"];
    const PANEL_CLASS = "gired-quick-favorites";
    const TILE_CLASS = "gired-quick-add-button";
    const STAR_CLASS = "gired-quick-fav-star";
    const STAR_ITEM_CLASS = "gired-quick-fav-item";
    const TEMPLATE_BUTTON_SELECTOR = ".new-component-templates.new-component-advanced .button-component";

    // Unit page do micro-frontend de autoria: a lista de componentes é React e o "Avançado" abre um modal.
    const MFE_UNIT_PATH_PATTERN = /\/authoring\/course\/[^/]+\/container\/([^/]+)/;
    const MFE_LIST_SELECTOR = "ul.new-component-type";
    const MFE_BUTTON_SELECTOR = "button.add-component-button";
    const MFE_RADIO_SELECTOR = ".add-component-modal-radio";
    const UNIT_IFRAME_SELECTOR = "iframe.course-unit__xblock-iframe";

    let favorites = null;
    let names = {};
    let scheduled = false;
    let lastOpenedType = "";
    let templatesPromise = null;

    /** Normaliza texto para comparar e guardar nomes apresentados. */
    function normalizeText(value) {
        return (value || "").replace(/\s+/g, " ").trim();
    }

    /** Lê os favoritos e os nomes guardados; na primeira utilização propõe os "(Unified)". */
    async function loadFavorites() {
        try {
            const result = await chrome.storage.local.get([FAVORITES_KEY, NAMES_KEY]);
            const stored = result[FAVORITES_KEY];
            favorites = Array.isArray(stored) ? stored : DEFAULT_FAVORITES.slice();
            const storedNames = result[NAMES_KEY];
            names = storedNames && typeof storedNames === "object" ? storedNames : {};
        } catch (_) {
            favorites = DEFAULT_FAVORITES.slice();
            names = {};
        }
    }

    /** Guarda os favoritos no armazenamento da extensão (partilhado entre tabs). */
    function saveFavorites() {
        try {
            void chrome.storage.local.set({ [FAVORITES_KEY]: favorites });
        } catch (_) {}
    }

    /** Guarda os nomes conhecidos das dinâmicas, para o painel não depender de o menu estar aberto. */
    function saveNames() {
        try {
            void chrome.storage.local.set({ [NAMES_KEY]: names });
        } catch (_) {}
    }

    /** Regista o nome apresentado de uma dinâmica; devolve true se mudou. */
    function rememberName(category, name) {
        const clean = normalizeText(name);
        if (!category || !clean || names[category] === clean) return false;
        names[category] = clean;
        return true;
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

    /** Cria um botão de favorito; o destino é resolvido na altura do clique, porque os menus são recriados. */
    function createQuickTile(entry, onClick) {
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

        button.addEventListener("click", event => {
            event.preventDefault();
            onClick(entry.category);
        });

        return item;
    }

    /** Studio antigo: aciona diretamente o modelo do submenu Avançado. */
    function quickAddLegacy(category) {
        document.querySelector(`${TEMPLATE_BUTTON_SELECTOR}[data-category="${category}"]`)?.click();
    }

    /** Cria uma estrela que marca/desmarca o favorito sem acionar o item onde vive. */
    function createStar(category) {
        const star = document.createElement("button");
        star.type = "button";
        star.className = STAR_CLASS;
        star.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            toggleFavorite(category);
        });
        return star;
    }

    /** Atualiza o aspeto de uma estrela conforme o estado do favorito. */
    function refreshStar(star, category) {
        const active = favorites.includes(category);
        star.classList.toggle("is-active", active);
        const glyph = active ? "★" : "☆";
        if (star.textContent !== glyph) star.textContent = glyph;
        const title = active ? "Remover dos favoritos" : "Adicionar aos favoritos";
        if (star.getAttribute("title") !== title) star.setAttribute("title", title);
        const pressed = String(active);
        if (star.getAttribute("aria-pressed") !== pressed) star.setAttribute("aria-pressed", pressed);
    }

    /** Injeta uma estrela de favorito em cada item do submenu Avançado do Studio antigo. */
    function ensureStars(container) {
        container.querySelectorAll(TEMPLATE_BUTTON_SELECTOR).forEach(template => {
            const item = template.closest("li");
            const category = template.dataset.category || "";
            if (!item || !category) return;

            let star = item.querySelector(`.${STAR_CLASS}`);
            if (!star) {
                // A estrela vive ao lado do botão nativo (não dentro dele).
                star = createStar(category);
                item.classList.add(STAR_ITEM_CLASS);
                item.appendChild(star);
            }
            refreshStar(star, category);
        });
    }

    /** Cria o painel "Favoritos" imediatamente antes do contentor indicado. */
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

    /** Reconstrói a lista de favoritos só quando o conjunto (ou os nomes) muda de facto. */
    function renderPanel(panel, entries, onClick) {
        const signature = entries.map(entry => `${entry.category}=${entry.name}`).join("|");
        if (panel.dataset.signature === signature) return;
        panel.dataset.signature = signature;

        const list = panel.querySelector(`.${PANEL_CLASS}__list`);
        list.textContent = "";
        entries.forEach(entry => list.appendChild(createQuickTile(entry, onClick)));
    }

    /** Painel existente imediatamente antes de um contentor, se houver. */
    function panelBefore(container) {
        const sibling = container.previousElementSibling;
        return sibling?.classList?.contains(PANEL_CLASS) ? sibling : null;
    }

    /** Studio antigo: mantém o painel de favoritos por cima do menu nativo (só quando há favoritos). */
    function ensureFavoritesPanel(container) {
        let panel = panelBefore(container);

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
        renderPanel(panel, entries, quickAddLegacy);
    }

    // ---------- Unit page do micro-frontend ----------

    /** Indica se esta é a unit page do micro-frontend (frame principal). */
    function isMfeUnitPage() {
        return window === window.top && MFE_UNIT_PATH_PATTERN.test(location.pathname);
    }

    /** Tipo de um botão nativo "Adicionar um novo componente" (advanced, html, problem, ...). */
    function componentTypeOf(button) {
        return Array.from(button.querySelectorAll(".sr-only"))
            .map(element => normalizeText(element.textContent))
            .find(text => /^[a-z0-9_-]+$/i.test(text)) || "";
    }

    /** Botão nativo "Avançado" da unit page. */
    function getAdvancedButton() {
        return Array.from(document.querySelectorAll(MFE_BUTTON_SELECTOR))
            .find(button => componentTypeOf(button) === "advanced") || null;
    }

    /** Espera, com sondagens curtas, até a função devolver um elemento (ou até ao limite). */
    function waitFor(resolveElement, timeoutMs) {
        return new Promise(resolve => {
            const startedAt = Date.now();
            const tick = () => {
                const element = resolveElement();
                if (element) { resolve(element); return; }
                if (Date.now() - startedAt >= timeoutMs) { resolve(null); return; }
                window.setTimeout(tick, 60);
            };
            tick();
        });
    }

    /**
     * Unit page: abre o modal "Avançado", escolhe a dinâmica e confirma, sem intervenção.
     * O modal é React, por isso cada passo espera pelo DOM em vez de assumir tempos fixos.
     */
    async function quickAddMfe(category) {
        const advanced = getAdvancedButton();
        if (!advanced) return;
        lastOpenedType = "advanced";
        advanced.click();

        const radio = await waitFor(
            () => document.querySelector(`${MFE_RADIO_SELECTOR} input[type="radio"][value="${CSS.escape(category)}"]`),
            4000
        );
        if (!radio) return;
        radio.click();

        const dialog = radio.closest('[role="dialog"]') || document;
        const submit = await waitFor(() => {
            const footer = dialog.querySelector(".pgn__modal-footer") || dialog;
            const buttons = Array.from(footer.querySelectorAll("button"))
                .filter(button => !button.classList.contains("btn-tertiary"));
            const candidate = buttons[buttons.length - 1];
            return candidate && !candidate.disabled ? candidate : null;
        }, 3000);
        submit?.click();
    }

    /** Unit page: painel de favoritos por cima da lista "Adicionar um novo componente". */
    function ensureMfePanel() {
        const list = document.querySelector(MFE_LIST_SELECTOR);
        const advanced = getAdvancedButton();
        if (!list || !advanced) return;

        let panel = panelBefore(list);
        const entries = favorites.map(category => ({ category, name: names[category] || category }));
        if (!entries.length) {
            panel?.remove();
            return;
        }

        if (!panel) {
            panel = buildPanel(list);
            panel.classList.add("is-mfe");
        }
        renderPanel(panel, entries, category => void quickAddMfe(category));

        if (favorites.some(category => !names[category])) void loadTemplateNames();
    }

    /** Unit page: estrelas nos itens do modal "Avançado" e memorização dos nomes apresentados. */
    function ensureMfeModalStars() {
        if (lastOpenedType !== "advanced") return;
        const radios = Array.from(document.querySelectorAll(MFE_RADIO_SELECTOR));
        if (!radios.length) return;

        let changed = false;
        radios.forEach(radio => {
            const category = radio.querySelector('input[type="radio"]')?.value || "";
            if (!category) return;
            changed = rememberName(category, radio.querySelector("label")?.textContent) || changed;

            const row = radio.parentElement;
            if (!row) return;
            let star = row.querySelector(`:scope > .${STAR_CLASS}`);
            if (!star) {
                star = createStar(category);
                star.classList.add("is-mfe");
                row.appendChild(star);
            }
            refreshStar(star, category);
        });
        if (changed) saveNames();
    }

    /** Nomes das dinâmicas pela API do Studio, para o painel aparecer antes de o modal ser aberto. */
    function loadTemplateNames() {
        if (templatesPromise) return templatesPromise;
        templatesPromise = (async () => {
            try {
                let vertical = location.pathname.match(MFE_UNIT_PATH_PATTERN)?.[1] || "";
                try { vertical = decodeURIComponent(vertical); } catch (_) {}
                const frame = document.querySelector(`${UNIT_IFRAME_SELECTOR}[src]`);
                const origin = frame ? new URL(frame.getAttribute("src"), location.href).origin : "";
                if (!vertical || !origin) return;

                const response = await fetch(`${origin}/xblock/container/${vertical}`, {
                    credentials: "include",
                    headers: { Accept: "application/json" }
                });
                if (!response.ok) return;
                const data = await response.json();
                const groups = Array.isArray(data?.component_templates) ? data.component_templates : [];
                const advanced = groups.find(group => group?.type === "advanced");
                let changed = false;
                (Array.isArray(advanced?.templates) ? advanced.templates : []).forEach(template => {
                    changed = rememberName(template?.category, template?.display_name) || changed;
                });
                if (changed) {
                    saveNames();
                    scheduleEnsure();
                }
            } catch (_) {
                // Sem API, o painel mostra o identificador até o modal "Avançado" ser aberto uma vez.
            }
        })();
        return templatesPromise;
    }

    /** Garante estrelas e painel em todos os menus de componentes da página. */
    function ensureQuickFavorites() {
        scheduled = false;
        if (!favorites) return;

        if (!CMS_HOST_PATTERN.test(location.hostname)) {
            if (isMfeUnitPage()) {
                ensureMfePanel();
                ensureMfeModalStars();
            }
            return;
        }

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

    /** O Studio recria o menu depois de criar/colar componentes; o micro-frontend monta o modal no body. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation =>
                !(mutation.target instanceof Element)
                || !mutation.target.closest(`.${PANEL_CLASS}, .${STAR_CLASS}`));
            if (relevant) scheduleEnsure();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /** Outra tab pode alterar os favoritos ou os nomes; refletimos a mudança de imediato. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;
            if (changes[FAVORITES_KEY]) {
                const value = changes[FAVORITES_KEY].newValue;
                favorites = Array.isArray(value) ? value : [];
            }
            if (changes[NAMES_KEY]) {
                const value = changes[NAMES_KEY].newValue;
                names = value && typeof value === "object" ? value : {};
            }
            if (changes[FAVORITES_KEY] || changes[NAMES_KEY]) scheduleEnsure();
        });
    }

    async function initialize() {
        await loadFavorites();
        // Só os itens do modal aberto a partir do "Avançado" recebem estrelas.
        document.addEventListener("click", event => {
            const button = event.target instanceof Element ? event.target.closest(MFE_BUTTON_SELECTOR) : null;
            if (button) lastOpenedType = componentTypeOf(button);
        }, true);
        ensureQuickFavorites();
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => void initialize(), { once: true });
    } else {
        void initialize();
    }
})();
