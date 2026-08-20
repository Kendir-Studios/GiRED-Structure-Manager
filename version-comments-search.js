(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENTS_LIST_SELECTOR = "#vc-comments-list";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const SEARCH_ID = "gired-vc-comments-search";
    const SEARCH_WRAPPER_CLASS = "gired-structure-mapper-vc-search";
    const HIDDEN_CLASS = "gired-vc-search-hidden";
    const NATIVE_FILTER_SELECTOR = "#vc-filter-severity, #vc-filter-status, #vc-filter-team";

    let currentQuery = "";
    let applyScheduled = false;

    /** Indica se a extensão está atualmente ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains("gired-structure-mapper-disabled");
    }

    /** Normaliza texto para permitir pesquisa sem distinguir maiúsculas, acentos ou espaços repetidos. */
    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-PT")
            .replace(/\s+/g, " ")
            .trim();
    }

    /** Devolve os termos da pesquisa atual, ignorando espaços vazios. */
    function getSearchTerms() {
        return normalizeText(currentQuery).split(" ").filter(Boolean);
    }

    /** Remove apenas o filtro de pesquisa aplicado pela extensão. */
    function clearSearchFilter() {
        document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}.${HIDDEN_CLASS}`)
            .forEach(comment => comment.classList.remove(HIDDEN_CLASS));
    }

    /** Atualiza o contador apresentado dentro da barra de pesquisa. */
    function updateResultCount(matches, total) {
        const count = document.querySelector(`#${SEARCH_ID}-count`);
        if (!count) return;

        if (!currentQuery.trim()) {
            count.textContent = "";
            count.hidden = true;
            return;
        }

        count.textContent = `${matches}/${total}`;
        count.hidden = false;
    }

    /** Filtra os comentários visíveis no DOM usando todo o texto de cada comentário. */
    function applySearch() {
        applyScheduled = false;

        const list = document.querySelector(COMMENTS_LIST_SELECTOR);
        if (!list) return;

        const comments = Array.from(list.querySelectorAll(COMMENT_SELECTOR));

        if (!isExtensionEnabled()) {
            clearSearchFilter();
            updateResultCount(comments.length, comments.length);
            return;
        }

        const terms = getSearchTerms();
        let matches = 0;

        comments.forEach(comment => {
            const haystack = normalizeText(comment.textContent);
            const isMatch = terms.length === 0 || terms.every(term => haystack.includes(term));

            comment.classList.toggle(HIDDEN_CLASS, !isMatch);
            if (isMatch) matches += 1;
        });

        updateResultCount(matches, comments.length);
    }

    /** Agenda o filtro para o próximo frame, evitando múltiplas passagens no mesmo ciclo do DOM. */
    function scheduleApplySearch() {
        if (applyScheduled) return;
        applyScheduled = true;
        window.requestAnimationFrame(applySearch);
    }

    /** Atualiza o estado visual do botão para limpar a pesquisa. */
    function updateClearButton() {
        const button = document.querySelector(`#${SEARCH_ID}-clear`);
        if (!button) return;
        button.hidden = currentQuery.length === 0;
    }

    /** Limpa a pesquisa mantendo os restantes filtros nativos do GiRED inalterados. */
    function clearSearch() {
        currentQuery = "";

        const input = document.getElementById(SEARCH_ID);
        if (input) {
            input.value = "";
            input.focus();
        }

        updateClearButton();
        scheduleApplySearch();
    }

    /** Cria a barra de pesquisa no espaço imediatamente antes da lista de comentários. */
    function ensureSearchUi() {
        const list = document.querySelector(COMMENTS_LIST_SELECTOR);
        if (!list) return;

        const existing = document.getElementById(SEARCH_ID);
        if (existing) {
            if (existing.value !== currentQuery) existing.value = currentQuery;
            updateClearButton();
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = SEARCH_WRAPPER_CLASS;
        wrapper.setAttribute("role", "search");

        const icon = document.createElement("span");
        icon.className = "gired-vc-search-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><line x1="20" y1="20" x2="16.65" y2="16.65"></line></svg>';

        const input = document.createElement("input");
        input.id = SEARCH_ID;
        input.className = "gired-vc-search-input";
        input.type = "search";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.placeholder = "Pesquisar nos comentários...";
        input.setAttribute("aria-label", "Pesquisar nos comentários do Controlo de Versões");
        input.value = currentQuery;

        const count = document.createElement("span");
        count.id = `${SEARCH_ID}-count`;
        count.className = "gired-vc-search-count";
        count.hidden = true;

        const clearButton = document.createElement("button");
        clearButton.id = `${SEARCH_ID}-clear`;
        clearButton.className = "gired-vc-search-clear";
        clearButton.type = "button";
        clearButton.title = "Limpar pesquisa";
        clearButton.setAttribute("aria-label", "Limpar pesquisa");
        clearButton.textContent = "×";
        clearButton.hidden = currentQuery.length === 0;

        input.addEventListener("input", () => {
            currentQuery = input.value;
            updateClearButton();
            scheduleApplySearch();
        });

        input.addEventListener("keydown", event => {
            if (event.key !== "Escape" || !currentQuery) return;
            event.preventDefault();
            clearSearch();
        });

        clearButton.addEventListener("click", clearSearch);

        wrapper.append(icon, input, count, clearButton);
        list.before(wrapper);

        scheduleApplySearch();
    }

    /** Mantém a barra disponível quando o GiRED recria a aba ou a lista de comentários. */
    const domObserver = new MutationObserver(() => {
        ensureSearchUi();
        scheduleApplySearch();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /** Reaplica a pesquisa depois de usar os filtros nativos do Controlo de Versões. */
    document.addEventListener("change", event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || !target.matches(NATIVE_FILTER_SELECTOR)) return;

        window.setTimeout(() => {
            ensureSearchUi();
            scheduleApplySearch();
        }, 0);
    }, true);

    /**
     * Se a extensão for desligada, remove imediatamente o filtro visual dos comentários.
     * Ao voltar a ligar, restaura a pesquisa anterior.
     */
    const extensionStateObserver = new MutationObserver(() => {
        if (isExtensionEnabled()) {
            ensureSearchUi();
            scheduleApplySearch();
            return;
        }

        clearSearchFilter();
    });

    extensionStateObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
    });

    ensureSearchUi();
})();
