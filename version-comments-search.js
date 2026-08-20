(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENTS_LIST_SELECTOR = "#vc-comments-list";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOAD_MORE_SELECTOR = ".course-vc-comments-load-more button";
    const SEARCH_ID = "gired-vc-comments-search";
    const SEARCH_WRAPPER_CLASS = "gired-structure-mapper-vc-search";
    const HIDDEN_CLASS = "gired-vc-search-hidden";
    const NATIVE_FILTER_SELECTOR = "#vc-filter-severity, #vc-filter-status, #vc-filter-team";
    const LOAD_WAIT_MS = 1400;
    const MAX_LOAD_ROUNDS = 220;
    const MAX_IDLE_ROUNDS = 3;

    let currentQuery = "";
    let applyScheduled = false;
    let loadPromise = null;
    let allCommentsLoaded = false;
    let lastListElement = null;

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

    /** Devolve a quantidade de comentários já carregados no DOM. */
    function getLoadedCommentCount() {
        return document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}`).length;
    }

    /** Indica se existe algum filtro nativo ativo no Controlo de Versões. */
    function hasNativeFilters() {
        return Array.from(document.querySelectorAll(NATIVE_FILTER_SELECTOR))
            .some(filter => String(filter.value || "").trim() !== "");
    }

    /** Obtém o total global apresentado pelo GiRED quando não existem filtros nativos ativos. */
    function getExpectedGlobalTotal() {
        if (hasNativeFilters()) return null;

        const statusBadges = Array.from(document.querySelectorAll(
            "#vc-comment-stats .course-vc-status-badge"
        ));

        if (!statusBadges.length) return null;

        const values = statusBadges
            .map(badge => {
                const text = String(badge.textContent || "").trim();
                const match = text.match(/(\d[\d\s.]*)\s*$/);
                if (!match) return 0;
                return Number(match[1].replace(/[\s.]/g, "")) || 0;
            })
            .filter(value => value > 0);

        return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
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

    /** Mostra o progresso do carregamento integral antes da pesquisa. */
    function updateLoadingState(loaded, expectedTotal = null) {
        const wrapper = document.querySelector(`.${SEARCH_WRAPPER_CLASS}`);
        const count = document.querySelector(`#${SEARCH_ID}-count`);

        wrapper?.classList.add("is-loading");

        if (count) {
            count.hidden = false;
            count.textContent = expectedTotal
                ? `A carregar ${loaded}/${expectedTotal}`
                : `A carregar ${loaded}`;
        }
    }

    /** Remove o estado visual de carregamento da barra. */
    function clearLoadingState() {
        document.querySelector(`.${SEARCH_WRAPPER_CLASS}`)?.classList.remove("is-loading");
    }

    /** Mostra claramente quando o GiRED não permitiu carregar a totalidade dos erros. */
    function showIncompleteCoverage(loaded, expectedTotal) {
        const wrapper = document.querySelector(`.${SEARCH_WRAPPER_CLASS}`);
        const count = document.querySelector(`#${SEARCH_ID}-count`);

        wrapper?.classList.add("has-warning");
        if (wrapper) {
            wrapper.title = `Pesquisa incompleta: foram carregados ${loaded} de ${expectedTotal} erros.`;
        }

        if (count && currentQuery.trim()) {
            count.hidden = false;
            count.textContent = `⚠ ${loaded}/${expectedTotal}`;
        }
    }

    /** Limpa um eventual aviso de cobertura incompleta. */
    function clearCoverageWarning() {
        const wrapper = document.querySelector(`.${SEARCH_WRAPPER_CLASS}`);
        wrapper?.classList.remove("has-warning");
        if (wrapper) wrapper.removeAttribute("title");
    }

    /** Filtra os comentários carregados usando todo o texto de cada comentário. */
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

        if (!loadPromise) {
            updateResultCount(matches, comments.length);
        }
    }

    /** Agenda o filtro para o próximo frame, evitando múltiplas passagens no mesmo ciclo do DOM. */
    function scheduleApplySearch() {
        if (applyScheduled) return;
        applyScheduled = true;
        window.requestAnimationFrame(applySearch);
    }

    /** Devolve o botão nativo "Carregar Mais" enquanto ainda estiver utilizável. */
    function getLoadMoreButton() {
        const button = document.querySelector(`${SIDEBAR_SELECTOR} ${LOAD_MORE_SELECTOR}`);
        if (!(button instanceof HTMLButtonElement) || button.disabled) return null;

        const style = window.getComputedStyle(button);
        if (style.display === "none" || style.visibility === "hidden") return null;
        return button;
    }

    /** Aguarda pelo crescimento da lista depois de clicar em "Carregar Mais". */
    function waitForCommentGrowth(previousCount) {
        const list = document.querySelector(COMMENTS_LIST_SELECTOR);
        if (!list) return Promise.resolve(false);

        return new Promise(resolve => {
            let finished = false;

            const finish = grew => {
                if (finished) return;
                finished = true;
                observer.disconnect();
                window.clearTimeout(timeoutId);
                resolve(grew);
            };

            const observer = new MutationObserver(() => {
                if (getLoadedCommentCount() > previousCount) {
                    finish(true);
                }
            });

            observer.observe(list, { childList: true, subtree: true });

            const timeoutId = window.setTimeout(() => {
                finish(getLoadedCommentCount() > previousCount);
            }, LOAD_WAIT_MS);
        });
    }

    /**
     * Carrega automaticamente todos os erros antes de considerar a pesquisa completa.
     * Assim, uma pesquisa nunca aparenta ter zero resultados apenas porque os erros ainda não estavam no DOM.
     */
    async function loadAllCommentsForSearch() {
        if (allCommentsLoaded || !currentQuery.trim() || !isExtensionEnabled()) return;
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            clearCoverageWarning();

            const expectedTotal = getExpectedGlobalTotal();
            let previousCount = getLoadedCommentCount();
            let idleRounds = 0;

            if (expectedTotal && previousCount >= expectedTotal) {
                allCommentsLoaded = true;
                return;
            }

            for (let round = 0; round < MAX_LOAD_ROUNDS; round += 1) {
                updateLoadingState(previousCount, expectedTotal);

                const loadMoreButton = getLoadMoreButton();
                if (!loadMoreButton) {
                    allCommentsLoaded = expectedTotal ? previousCount >= expectedTotal : true;
                    break;
                }

                loadMoreButton.click();

                const grew = await waitForCommentGrowth(previousCount);
                const currentCount = getLoadedCommentCount();

                if (currentCount > previousCount || grew) {
                    previousCount = currentCount;
                    idleRounds = 0;

                    if (expectedTotal && currentCount >= expectedTotal) {
                        allCommentsLoaded = true;
                        break;
                    }

                    continue;
                }

                idleRounds += 1;
                if (idleRounds >= MAX_IDLE_ROUNDS) {
                    allCommentsLoaded = expectedTotal ? currentCount >= expectedTotal : true;
                    break;
                }

                await new Promise(resolve => window.setTimeout(resolve, 180));
            }

            const loaded = getLoadedCommentCount();
            if (expectedTotal && loaded < expectedTotal) {
                showIncompleteCoverage(loaded, expectedTotal);
            } else {
                clearCoverageWarning();
            }
        })().finally(() => {
            loadPromise = null;
            clearLoadingState();
            scheduleApplySearch();
        });

        return loadPromise;
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

        clearCoverageWarning();
        updateClearButton();
        scheduleApplySearch();
    }

    /** Inicia uma pesquisa e garante primeiro que a lista integral está carregada. */
    function handleSearchInput(input) {
        currentQuery = input.value;
        updateClearButton();
        scheduleApplySearch();

        if (currentQuery.trim()) {
            void loadAllCommentsForSearch();
        } else {
            clearCoverageWarning();
        }
    }

    /** Cria a barra de pesquisa no espaço imediatamente antes da lista de comentários. */
    function ensureSearchUi() {
        const list = document.querySelector(COMMENTS_LIST_SELECTOR);
        if (!list) return;

        if (lastListElement !== list) {
            lastListElement = list;
            allCommentsLoaded = false;
        }

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
        input.placeholder = "Pesquisar em todos os comentários...";
        input.setAttribute("aria-label", "Pesquisar em todos os comentários do Controlo de Versões");
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

        input.addEventListener("input", () => handleSearchInput(input));

        input.addEventListener("keydown", event => {
            if (event.key !== "Escape" || !currentQuery) return;
            event.preventDefault();
            clearSearch();
        });

        clearButton.addEventListener("click", clearSearch);

        wrapper.append(icon, input, count, clearButton);
        list.before(wrapper);

        scheduleApplySearch();

        if (currentQuery.trim()) {
            void loadAllCommentsForSearch();
        }
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

    /** Recarrega integralmente os resultados depois de alterar um filtro nativo. */
    document.addEventListener("change", event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || !target.matches(NATIVE_FILTER_SELECTOR)) return;

        allCommentsLoaded = false;
        clearCoverageWarning();

        window.setTimeout(() => {
            ensureSearchUi();
            scheduleApplySearch();
            if (currentQuery.trim()) void loadAllCommentsForSearch();
        }, 0);
    }, true);

    /**
     * Se a extensão for desligada, remove imediatamente o filtro visual dos comentários.
     * Ao voltar a ligar, restaura a pesquisa anterior e volta a garantir cobertura integral.
     */
    const extensionStateObserver = new MutationObserver(() => {
        if (isExtensionEnabled()) {
            ensureSearchUi();
            scheduleApplySearch();
            if (currentQuery.trim()) void loadAllCommentsForSearch();
            return;
        }

        clearSearchFilter();
        clearLoadingState();
        clearCoverageWarning();
    });

    extensionStateObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
    });

    ensureSearchUi();
})();
