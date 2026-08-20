(() => {
    "use strict";

    const LEGACY_REVIEW_LEFT_KEY = "giredReviewSidebarLeft";
    const REVIEW_COMMENTS_ONLY_KEY = "giredReviewCommentsOnly";
    const REVIEW_OPEN_ONLY_KEY = "giredReviewOpenOnly";
    const COMMENTS_ONLY_CLASS = "gired-review-comments-only";
    const OPEN_ONLY_CLASS = "gired-review-open-only";
    const OPEN_ONLY_HIDDEN_CLASS = "gired-review-open-filter-hidden";
    const LEGACY_LEFT_CLASS = "gired-review-sidebar-left";
    const REVIEW_TOGGLE_SELECTOR = "#vc-review-toggle";
    const REVIEW_CLOSE_SELECTOR = "#vc-review-close";
    const SIDEBAR_SELECTOR = "#vc-review-sidebar";
    const COMMENT_SELECTOR = ".vc-review-comment-item";
    const OPEN_STATUS_SELECTOR = ".vc-review-status-open";
    const OPEN_ONLY_CONTROL_ID = "gired-structure-mapper-review-open-filter";
    const OPEN_ONLY_COUNTER_ID = "gired-structure-mapper-review-open-count";
    const WIDTH_VARIABLE = "--gired-review-sidebar-width";

    let widthUpdateScheduled = false;
    let openOnlyEnabled = false;

    /** Indica se o painel nativo de Revisão está atualmente aberto. */
    function isReviewOpen() {
        return document.body?.classList.contains("vc-review-open") === true;
    }

    /**
     * Mede a largura real do painel nativo e guarda-a numa variável CSS.
     * A página usa esta largura para reservar espaço à direita enquanto a Revisão está aberta.
     */
    function updateReviewSidebarWidth() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const rectWidth = sidebar.getBoundingClientRect().width;
        const computedWidth = Number.parseFloat(window.getComputedStyle(sidebar).width) || 0;
        const width = rectWidth || computedWidth;

        if (width > 0) {
            document.documentElement.style.setProperty(WIDTH_VARIABLE, `${Math.round(width)}px`);
        }
    }

    /** Agenda a medição para o próximo frame, evitando cálculos repetidos. */
    function scheduleWidthUpdate() {
        if (widthUpdateScheduled) return;
        widthUpdateScheduled = true;

        window.requestAnimationFrame(() => {
            widthUpdateScheduled = false;
            updateReviewSidebarWidth();
        });
    }

    /**
     * Garante que a aba de Correções está ativa quando o modo de apenas comentários é usado.
     */
    function ensureCorrectionsTabActive() {
        const correctionsTab = document.querySelector('.vc-review-tab[data-tab="corrections"]');
        if (!correctionsTab || correctionsTab.classList.contains("active")) return;

        correctionsTab.click();
    }

    /** Atualiza o contador apresentado junto ao filtro de erros abertos. */
    function updateOpenOnlyCounter() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        const counter = document.getElementById(OPEN_ONLY_COUNTER_ID);
        if (!sidebar || !counter) return;

        const comments = Array.from(sidebar.querySelectorAll(COMMENT_SELECTOR));
        const openCount = comments.filter(comment => comment.querySelector(OPEN_STATUS_SELECTOR)).length;

        counter.textContent = comments.length
            ? `${openCount} aberto${openCount === 1 ? "" : "s"}`
            : "Sem erros";
    }

    /** Filtra os comentários da Revisão sem alterar o estado nativo de cada erro. */
    function filterReviewComments() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const shouldFilter = openOnlyEnabled &&
            !document.documentElement.classList.contains("gired-structure-mapper-disabled");

        sidebar.querySelectorAll(COMMENT_SELECTOR).forEach(comment => {
            const isOpen = comment.querySelector(OPEN_STATUS_SELECTOR) !== null;
            comment.classList.toggle(OPEN_ONLY_HIDDEN_CLASS, shouldFilter && !isOpen);
        });

        updateOpenOnlyCounter();
    }

    /** Cria o toggle "Só erros abertos" no topo do painel nativo de Revisão. */
    function ensureOpenOnlyControl() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const existingControl = document.getElementById(OPEN_ONLY_CONTROL_ID);
        if (existingControl) {
            const input = existingControl.querySelector("input");
            if (input instanceof HTMLInputElement) {
                input.checked = openOnlyEnabled;
            }
            updateOpenOnlyCounter();
            return;
        }

        const control = document.createElement("div");
        control.id = OPEN_ONLY_CONTROL_ID;
        control.className = "gired-structure-mapper-review-open-filter";

        const copy = document.createElement("div");
        copy.className = "gired-structure-mapper-review-open-filter__copy";

        const labelText = document.createElement("span");
        labelText.className = "gired-structure-mapper-review-open-filter__label";
        labelText.textContent = "Só erros abertos";

        const count = document.createElement("span");
        count.id = OPEN_ONLY_COUNTER_ID;
        count.className = "gired-structure-mapper-review-open-filter__count";

        copy.append(labelText, count);

        const switchLabel = document.createElement("label");
        switchLabel.className = "gired-structure-mapper-review-open-filter__switch";
        switchLabel.setAttribute("aria-label", "Mostrar apenas erros abertos");

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = openOnlyEnabled;

        const track = document.createElement("span");
        track.className = "gired-structure-mapper-review-open-filter__track";

        const thumb = document.createElement("span");
        thumb.className = "gired-structure-mapper-review-open-filter__thumb";
        track.appendChild(thumb);

        switchLabel.append(input, track);
        control.append(copy, switchLabel);

        input.addEventListener("change", async () => {
            applyOpenOnly(input.checked);

            try {
                await chrome.storage.local.set({ [REVIEW_OPEN_ONLY_KEY]: input.checked });
            } catch (_) {
                // O filtro continua funcional na sessão mesmo que a preferência não possa ser guardada.
            }
        });

        const header = sidebar.querySelector(".vc-review-header");
        const tabs = sidebar.querySelector(".vc-review-tabs");

        if (header?.parentNode) {
            header.insertAdjacentElement("afterend", control);
        } else if (tabs?.parentNode) {
            tabs.parentNode.insertBefore(control, tabs);
        } else {
            sidebar.prepend(control);
        }

        updateOpenOnlyCounter();
    }

    /** Aplica o modo compacto sem alterar a posição nativa do painel de Revisão. */
    function applyCommentsOnly(commentsOnly) {
        document.documentElement.classList.toggle(COMMENTS_ONLY_CLASS, commentsOnly);

        if (commentsOnly && isReviewOpen()) {
            window.requestAnimationFrame(ensureCorrectionsTabActive);
        }
    }

    /** Ativa ou desativa o filtro que mantém visíveis apenas os erros abertos. */
    function applyOpenOnly(openOnly) {
        openOnlyEnabled = openOnly;
        document.documentElement.classList.toggle(OPEN_ONLY_CLASS, openOnly);

        const input = document.querySelector(`#${OPEN_ONLY_CONTROL_ID} input`);
        if (input instanceof HTMLInputElement) {
            input.checked = openOnly;
        }

        filterReviewComments();
    }

    /** Sincroniza a largura, os controlos e os filtros sempre que o painel está disponível. */
    function syncOpenPanel() {
        ensureOpenOnlyControl();
        filterReviewComments();

        if (!isReviewOpen()) return;

        scheduleWidthUpdate();

        if (document.documentElement.classList.contains(COMMENTS_ONLY_CLASS)) {
            window.requestAnimationFrame(ensureCorrectionsTabActive);
        }
    }

    /**
     * Remove apenas a antiga preferência/classe de mover a Revisão para a esquerda.
     * A variável de largura deixa de ser removida porque agora é usada para adaptar a página à direita.
     */
    async function removeLegacyLeftPreference() {
        document.documentElement.classList.remove(LEGACY_LEFT_CLASS);

        try {
            await chrome.storage.local.remove(LEGACY_REVIEW_LEFT_KEY);
        } catch (_) {
            // A limpeza da preferência antiga não deve impedir o funcionamento do painel.
        }
    }

    /** Carrega as preferências guardadas para a Revisão. */
    async function loadReviewPreferences() {
        await removeLegacyLeftPreference();

        try {
            const result = await chrome.storage.local.get([
                REVIEW_COMMENTS_ONLY_KEY,
                REVIEW_OPEN_ONLY_KEY
            ]);

            applyCommentsOnly(result[REVIEW_COMMENTS_ONLY_KEY] === true);
            applyOpenOnly(result[REVIEW_OPEN_ONLY_KEY] === true);
        } catch (_) {
            applyCommentsOnly(false);
            applyOpenOnly(false);
        }

        syncOpenPanel();
    }

    /** Atualiza imediatamente a página quando uma preferência é alterada. */
    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            if (changes[REVIEW_COMMENTS_ONLY_KEY]) {
                applyCommentsOnly(changes[REVIEW_COMMENTS_ONLY_KEY].newValue === true);
            }

            if (changes[REVIEW_OPEN_ONLY_KEY]) {
                applyOpenOnly(changes[REVIEW_OPEN_ONLY_KEY].newValue === true);
            }
        });
    }

    /**
     * O painel e os comentários podem ser inseridos dinamicamente. O observer recalcula a largura,
     * reinsere o toggle quando necessário e reaplica o filtro aos novos erros.
     */
    const domObserver = new MutationObserver(() => {
        syncOpenPanel();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /**
     * O GiRED abre e fecha a Revisão através da classe `vc-review-open` no body.
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

    /** Sincroniza novamente após utilizar os controlos nativos de abrir/fechar ou alterar um erro. */
    document.addEventListener("click", event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.closest(`${REVIEW_TOGGLE_SELECTOR}, ${REVIEW_CLOSE_SELECTOR}`)) {
            window.requestAnimationFrame(syncOpenPanel);
            return;
        }

        if (target.closest(`${SIDEBAR_SELECTOR} button`)) {
            window.setTimeout(filterReviewComments, 120);
        }
    }, true);

    /** Mantém a reserva de espaço correta se a janela ou o painel mudarem de largura. */
    window.addEventListener("resize", () => {
        if (isReviewOpen()) {
            scheduleWidthUpdate();
        }
    }, { passive: true });

    void loadReviewPreferences();
})();
