(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENTS_LIST_SELECTOR = "#vc-comments-list";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOAD_MORE_SELECTOR = ".course-vc-comments-load-more button";
    const NATIVE_FILTER_SELECTOR = "#vc-filter-severity, #vc-filter-status, #vc-filter-team";
    const BASE_CLASS = "gired-structure-mapper-vc-counter";
    const WRAPPER_CLASS = "gired-structure-mapper-vc-counters";
    const NATIVE_HIDDEN_ATTR = "data-gired-native-counter-hidden";
    const COUNTERS_KEY = "giredVcCountersEnabled";
    const BLOCKING_PATTERN = /problema\(?s?\)?\s+bloqueante/i;
    const LOAD_WAIT_MS = 1400;
    const MAX_LOAD_ROUNDS = 220;
    const MAX_IDLE_ROUNDS = 3;
    const RELOAD_COOLDOWN_MS = 5000;

    let updateScheduled = false;
    let loadPromise = null;
    let lastLoadFinishedAt = 0;
    let cachedCounts = null;
    let cachedIsPartial = false;
    let countersEnabled = true;

    /** Indica se a extensão está atualmente ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains("gired-structure-mapper-disabled");
    }

    /** Indica se os cartões de contagem estão ativos (extensão ligada + preferência do popup). */
    function isFeatureActive() {
        return isExtensionEnabled() && countersEnabled;
    }

    /** Indica se existe algum filtro nativo ativo (a lista deixa de representar o total global). */
    function hasNativeFilters() {
        return Array.from(document.querySelectorAll(NATIVE_FILTER_SELECTOR))
            .some(filter => String(filter.value || "").trim() !== "");
    }

    /** Total global esperado, somando as estatísticas nativas de estado. */
    function getExpectedGlobalTotal() {
        const values = Array.from(document.querySelectorAll("#vc-comment-stats .course-vc-status-badge"))
            .map(badge => {
                const match = String(badge.textContent || "").match(/(\d[\d\s.]*)\s*$/);
                return match ? Number(match[1].replace(/[\s.]/g, "")) || 0 : 0;
            })
            .filter(value => value > 0);
        return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    }

    /** Quantidade de comentários já presentes no DOM. */
    function getLoadedCommentCount() {
        return document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}`).length;
    }

    /** Devolve o botão nativo "Carregar Mais" enquanto estiver utilizável. */
    function getLoadMoreButton() {
        const button = document.querySelector(`${SIDEBAR_SELECTOR} ${LOAD_MORE_SELECTOR}`);
        if (!(button instanceof HTMLButtonElement) || button.disabled) return null;
        const style = window.getComputedStyle(button);
        if (style.display === "none" || style.visibility === "hidden") return null;
        return button;
    }

    /** Aguarda pelo crescimento da lista depois de um clique em "Carregar Mais". */
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
                if (getLoadedCommentCount() > previousCount) finish(true);
            });
            observer.observe(list, { childList: true, subtree: true });
            const timeoutId = window.setTimeout(() => {
                finish(getLoadedCommentCount() > previousCount);
            }, LOAD_WAIT_MS);
        });
    }

    /** Carrega a lista integral de comentários para as contagens serem exatas. */
    function loadAllComments() {
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            let previousCount = getLoadedCommentCount();
            let idleRounds = 0;

            for (let round = 0; round < MAX_LOAD_ROUNDS; round += 1) {
                if (!isFeatureActive() || hasNativeFilters()) break;
                const button = getLoadMoreButton();
                if (!button) break;

                button.click();
                const grew = await waitForCommentGrowth(previousCount);
                const count = getLoadedCommentCount();

                if (grew || count > previousCount) {
                    idleRounds = 0;
                } else {
                    idleRounds += 1;
                    if (idleRounds >= MAX_IDLE_ROUNDS) break;
                }
                previousCount = count;
            }
        })().finally(() => {
            loadPromise = null;
            lastLoadFinishedAt = Date.now();
            scheduleUpdate();
        });

        return loadPromise;
    }

    /**
     * Conta problemas em aberto por severidade a partir dos próprios comentários.
     * Estados que contam: qualquer um contendo "aberto" (inclui "Aberto" e "Reaberto");
     * "Resolvido" e "Não Corrigir" ficam de fora.
     */
    function countFromComments() {
        const comments = document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENTS_LIST_SELECTOR} ${COMMENT_SELECTOR}`);
        const counts = { ab: 0, cd: 0 };

        comments.forEach(comment => {
            const status = String(comment.querySelector(".course-vc-status-badge")?.textContent || "");
            if (!/aberto/i.test(status)) return;

            const severity = String(comment.querySelector(".course-vc-severity-badge")?.textContent || "")
                .trim().charAt(0).toUpperCase();
            if (severity === "A" || severity === "B") counts.ab += 1;
            else if (severity === "C" || severity === "D") counts.cd += 1;
        });

        return counts;
    }

    /** Encontra o contador nativo de bloqueantes (o elemento mais interior com esse texto). */
    function findNativeBlockingCounter(sidebar) {
        const candidates = Array.from(sidebar.querySelectorAll("div, span, p, button"))
            .filter(el => !el.closest(`.${WRAPPER_CLASS}`) && BLOCKING_PATTERN.test(el.textContent || ""));
        return candidates.find(el => !candidates.some(other => other !== el && el.contains(other))) || null;
    }

    /** Cria um dos cartões de contagem. */
    function createCounter(variant) {
        const counter = document.createElement("div");
        counter.className = `${BASE_CLASS} ${variant}`;
        counter.setAttribute("role", "status");

        const icon = document.createElement("span");
        icon.className = `${BASE_CLASS}-icon`;
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = `${BASE_CLASS}-label`;

        counter.append(icon, label);
        return counter;
    }

    /** Atualiza texto e estado visual de um cartão. */
    function renderCounter(counter, value, text, partial) {
        counter.querySelector(`.${BASE_CLASS}-icon`).textContent = value === 0 ? "✓" : "!";
        const label = counter.querySelector(`.${BASE_CLASS}-label`);
        if (label.textContent !== text) label.textContent = text;
        counter.classList.toggle("is-clear", value === 0);
        if (partial) {
            counter.setAttribute("title", "Contagem parcial: o GiRED não permitiu carregar a lista completa de erros.");
        } else {
            counter.removeAttribute("title");
        }
    }

    /** Esconde o contador nativo, guardando o estado para o podermos repor. */
    function hideNativeCounter(native) {
        if (native.getAttribute(NATIVE_HIDDEN_ATTR) === "true") return;
        native.setAttribute(NATIVE_HIDDEN_ATTR, "true");
        native.style.setProperty("display", "none", "important");
    }

    /** Repõe o contador nativo (usado ao desligar a extensão). */
    function restoreNativeCounter() {
        document.querySelectorAll(`[${NATIVE_HIDDEN_ATTR}="true"]`).forEach(el => {
            el.style.removeProperty("display");
            el.removeAttribute(NATIVE_HIDDEN_ATTR);
        });
    }

    /** Sincroniza os dois cartões com o estado atual da lista. */
    function updateCounters() {
        updateScheduled = false;
        if (!isFeatureActive()) {
            restoreNativeCounter();
            document.querySelector(`.${WRAPPER_CLASS}`)?.remove();
            return;
        }

        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const native = findNativeBlockingCounter(sidebar);
        const list = sidebar.querySelector(COMMENTS_LIST_SELECTOR);
        let wrapper = sidebar.querySelector(`.${WRAPPER_CLASS}`);

        if (!native && !wrapper) return;
        if (!native && wrapper) {
            wrapper.remove();
            return;
        }

        // A lista completa e sem filtros é a única fonte que inclui os erros reabertos.
        const fullyLoaded = !getLoadMoreButton();
        if (!hasNativeFilters() && list) {
            if (fullyLoaded) {
                const counts = countFromComments();
                const expected = getExpectedGlobalTotal();
                cachedCounts = counts;
                cachedIsPartial = expected !== null && getLoadedCommentCount() < expected;
            } else if (!loadPromise && Date.now() - lastLoadFinishedAt > RELOAD_COOLDOWN_MS) {
                void loadAllComments();
            }
        }

        if (!cachedCounts) {
            // Ainda sem dados fiáveis: mantemos o contador nativo visível e não mostramos nada.
            return;
        }

        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.className = WRAPPER_CLASS;
            wrapper.append(createCounter("is-ab"), createCounter("is-cd"));
        }

        renderCounter(
            wrapper.querySelector(".is-ab"),
            cachedCounts.ab,
            `${cachedCounts.ab} problema(s) bloqueante(s) em aberto (Sev A/B)`,
            cachedIsPartial
        );
        renderCounter(
            wrapper.querySelector(".is-cd"),
            cachedCounts.cd,
            `${cachedCounts.cd} problema(s) em aberto (Sev C/D)`,
            cachedIsPartial
        );

        if (wrapper.previousElementSibling !== native || wrapper.parentElement !== native.parentElement) {
            native.after(wrapper);
        }
        hideNativeCounter(native);
    }

    /** Agenda uma única atualização por frame. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(updateCounters);
    }

    /** O painel é montado e alterado dinamicamente; reagimos a qualquer mutação relevante. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(m =>
                !(m.target instanceof Element) || !m.target.closest(`.${WRAPPER_CLASS}`));
            if (relevant) scheduleUpdate();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }

    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;
            if (changes[COUNTERS_KEY]) {
                countersEnabled = changes[COUNTERS_KEY].newValue !== false;
            }
            if (changes.giredStructureMapperEnabled || changes[COUNTERS_KEY]) {
                scheduleUpdate();
            }
        });
    }

    /** Lê a preferência guardada antes da primeira renderização. */
    async function initialize() {
        try {
            const result = await chrome.storage.local.get(COUNTERS_KEY);
            countersEnabled = result[COUNTERS_KEY] !== false;
        } catch (_) {
            countersEnabled = true;
        }
        scheduleUpdate();
    }

    void initialize();
    startObserver();
})();
