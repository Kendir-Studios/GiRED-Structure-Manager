(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENTS_LIST_SELECTOR = "#vc-comments-list";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const LOAD_MORE_SELECTOR = ".course-vc-comments-load-more button";
    const NATIVE_EXPORT_SELECTOR = "#vc-export-comments";
    const EXPORT_BUTTON_ID = "gired-vc-export-mapper";
    const OVERLAY_ID = "gired-vc-export-overlay";
    const OVERLAY_STATUS_ID = "gired-vc-export-overlay-status";
    const SEARCH_HIDDEN_CLASS = "gired-vc-search-hidden";
    const SEARCH_INPUT_SELECTOR = "#gired-vc-comments-search";
    const NATIVE_FILTER_SELECTOR = "#vc-filter-severity, #vc-filter-status, #vc-filter-team";
    const LOAD_WAIT_MS = 1600;
    const REQUIRED_IDLE_ROUNDS = 4;
    const MAX_LOAD_ROUNDS = 220;

    const EXPORT_HEADERS = [
        "Issue",
        "Estado",
        "Severidade",
        "Link",
        "Localização",
        "Descrição",
        "Sugestão",
        "Citação",
        "Autor"
    ];

    let exportInProgress = false;

    /** Indica se a extensão está ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains("gired-structure-mapper-disabled");
    }

    /** Normaliza o texto extraído do DOM sem alterar o conteúdo relevante. */
    function getText(element) {
        return String(element?.textContent || "")
            .replace(/\u00a0/g, " ")
            .replace(/[ \t]+/g, " ")
            .replace(/\s*\n\s*/g, " ")
            .trim();
    }

    /** Remove um prefixo visual conhecido sem modificar o restante texto. */
    function removeLabel(value, labels) {
        let result = String(value || "").trim();

        for (const label of labels) {
            const regex = new RegExp(`^${label}\\s*:?\\s*`, "i");
            result = result.replace(regex, "");
        }

        return result.trim();
    }

    /** Devolve a descrição do erro, evitando incluir sugestão, citação, motivo ou ações. */
    function getDescription(comment) {
        const directDescription = comment.querySelector(
            ".course-vc-comment-description, .course-vc-comment-text"
        );

        if (directDescription) {
            return getText(directDescription);
        }

        const content = comment.querySelector(".course-vc-comment-content");
        if (!content) return "";

        const clone = content.cloneNode(true);
        clone.querySelectorAll(
            ".course-vc-comment-suggestion, .course-vc-comment-quote, .course-vc-comment-reason, .course-vc-comment-actions"
        ).forEach(element => element.remove());

        return getText(clone);
    }

    /** Converte um comentário numa linha com a estrutura definida para o Excel. */
    function commentToRow(comment) {
        const issueLink = comment.querySelector(".course-vc-issue-link");
        const unitLink = comment.querySelector(".course-vc-comment-unit-link a");
        const suggestion = comment.querySelector(".course-vc-comment-suggestion");
        const quote = comment.querySelector(".course-vc-comment-quote");

        const location = String(
            comment.querySelector(".course-vc-comment-location")?.textContent ||
            unitLink?.getAttribute("title") ||
            getText(unitLink) ||
            ""
        )
            .replace(/\s*>\s*/g, " > ")
            .trim();

        return {
            Issue: getText(issueLink),
            Estado: getText(comment.querySelector(".course-vc-status-badge")),
            Severidade: getText(comment.querySelector(".course-vc-severity-badge")),
            Link: unitLink?.href || "",
            "Localização": location,
            "Descrição": getDescription(comment),
            "Sugestão": removeLabel(getText(suggestion), ["Sugestão", "Suggestion"]),
            "Citação": getText(quote),
            Autor: getText(comment.querySelector(".course-vc-comment-author"))
        };
    }

    /** Obtém os comentários atualmente apresentados ao utilizador após filtros e pesquisa. */
    function getVisibleComments() {
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return [];

        return Array.from(sidebar.querySelectorAll(COMMENT_SELECTOR)).filter(comment => {
            if (comment.classList.contains(SEARCH_HIDDEN_CLASS)) return false;
            if (comment.hidden) return false;

            const style = window.getComputedStyle(comment);
            return style.display !== "none" && style.visibility !== "hidden";
        });
    }

    /** Devolve a quantidade de comentários já materializados no DOM. */
    function getLoadedCommentCount() {
        return document.querySelectorAll(`${SIDEBAR_SELECTOR} ${COMMENT_SELECTOR}`).length;
    }

    /** Indica se existem filtros nativos ou pesquisa da extensão ativos. */
    function hasActiveFilters() {
        const nativeFilterActive = Array.from(document.querySelectorAll(NATIVE_FILTER_SELECTOR))
            .some(filter => String(filter.value || "").trim() !== "");
        const searchActive = String(document.querySelector(SEARCH_INPUT_SELECTOR)?.value || "").trim() !== "";
        return nativeFilterActive || searchActive;
    }

    /** Obtém o total global apresentado nas estatísticas, quando os filtros estão todos limpos. */
    function getExpectedGlobalTotal() {
        if (hasActiveFilters()) return null;

        const statusBadges = Array.from(document.querySelectorAll(
            "#vc-comment-stats .course-vc-status-badge"
        ));

        if (!statusBadges.length) return null;

        const values = statusBadges
            .map(badge => {
                const match = getText(badge).match(/(\d[\d\s.]*)\s*$/);
                if (!match) return 0;
                return Number(match[1].replace(/[\s.]/g, "")) || 0;
            })
            .filter(value => value > 0);

        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0);
    }

    /** Procura o elemento que efetivamente controla o scroll da lista de comentários. */
    function findScrollContainer() {
        const list = document.querySelector(COMMENTS_LIST_SELECTOR);
        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!list || !sidebar) return null;

        let current = list.parentElement;
        let fallback = null;

        while (current && sidebar.contains(current)) {
            const style = window.getComputedStyle(current);
            const overflowY = style.overflowY;
            const canScroll = current.scrollHeight > current.clientHeight + 4;

            if (!fallback && current.matches(".course-vc-content")) {
                fallback = current;
            }

            if (canScroll && (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")) {
                return current;
            }

            if (current === sidebar) break;
            current = current.parentElement;
        }

        return fallback || sidebar;
    }

    /** Cria um overlay modal que bloqueia a interface durante o processamento. */
    function showProcessingOverlay() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", `${OVERLAY_ID}-title`);

        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            zIndex: "2147483647",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(15, 23, 42, 0.54)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            cursor: "wait"
        });

        const card = document.createElement("div");
        Object.assign(card.style, {
            width: "min(420px, calc(100vw - 48px))",
            boxSizing: "border-box",
            padding: "24px",
            border: "1px solid rgba(15, 23, 42, 0.12)",
            borderRadius: "12px",
            background: "#ffffff",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.24)",
            color: "#1f2933",
            textAlign: "center",
            fontFamily: "inherit"
        });

        const spinner = document.createElement("div");
        Object.assign(spinner.style, {
            width: "34px",
            height: "34px",
            margin: "0 auto 16px",
            border: "4px solid #dbe4e8",
            borderTopColor: "#0a7f40",
            borderRadius: "50%",
            animation: "gired-vc-export-spin 0.85s linear infinite"
        });

        const style = document.createElement("style");
        style.textContent = "@keyframes gired-vc-export-spin { to { transform: rotate(360deg); } }";
        overlay.appendChild(style);

        const title = document.createElement("div");
        title.id = `${OVERLAY_ID}-title`;
        title.textContent = "A preparar exportação";
        Object.assign(title.style, {
            marginBottom: "8px",
            fontSize: "18px",
            fontWeight: "700"
        });

        const status = document.createElement("div");
        status.id = OVERLAY_STATUS_ID;
        status.textContent = "A carregar todos os erros. Não feches esta página.";
        Object.assign(status.style, {
            fontSize: "13px",
            lineHeight: "1.5",
            color: "#5f6b76"
        });

        card.append(spinner, title, status);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        return overlay;
    }

    /** Atualiza a mensagem apresentada no overlay de processamento. */
    function updateProcessingOverlay(message) {
        const status = document.getElementById(OVERLAY_STATUS_ID);
        if (status) status.textContent = message;
    }

    /** Remove o overlay e devolve o controlo da interface ao utilizador. */
    function hideProcessingOverlay() {
        document.getElementById(OVERLAY_ID)?.remove();
    }

    /** Aguarda que uma nova página de comentários seja acrescentada ao DOM ou que o tempo expire. */
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

            observer.observe(list, {
                childList: true,
                subtree: true
            });

            const timeoutId = window.setTimeout(() => {
                finish(getLoadedCommentCount() > previousCount);
            }, LOAD_WAIT_MS);
        });
    }

    /** Devolve o botão nativo "Carregar Mais" quando ainda está disponível e clicável. */
    function getLoadMoreButton() {
        const button = document.querySelector(`${SIDEBAR_SELECTOR} ${LOAD_MORE_SELECTOR}`);
        if (!(button instanceof HTMLButtonElement)) return null;
        if (button.disabled) return null;

        const style = window.getComputedStyle(button);
        if (style.display === "none" || style.visibility === "hidden") return null;
        return button;
    }

    /**
     * Força o GiRED a carregar todas as páginas de comentários.
     * Dá prioridade ao botão nativo "Carregar Mais" e mantém o scroll como fallback.
     */
    async function loadAllComments(button) {
        const scroller = findScrollContainer();
        const originalScrollTop = scroller?.scrollTop ?? 0;
        const expectedTotal = getExpectedGlobalTotal();
        let previousCount = getLoadedCommentCount();
        let idleRounds = 0;

        if (expectedTotal && previousCount >= expectedTotal) {
            return previousCount;
        }

        for (let round = 0; round < MAX_LOAD_ROUNDS; round += 1) {
            const progress = expectedTotal
                ? `${previousCount}/${expectedTotal}`
                : `${previousCount}`;

            button.textContent = `A carregar... ${progress}`;
            updateProcessingOverlay(`A carregar todos os erros: ${progress}`);

            const loadMoreButton = getLoadMoreButton();
            if (loadMoreButton) {
                loadMoreButton.click();
            } else if (scroller) {
                scroller.scrollTop = scroller.scrollHeight;
                scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
            }

            const grew = await waitForCommentGrowth(previousCount);
            const currentCount = getLoadedCommentCount();

            if (expectedTotal && currentCount >= expectedTotal) {
                previousCount = currentCount;
                break;
            }

            if (grew || currentCount > previousCount) {
                previousCount = currentCount;
                idleRounds = 0;
                continue;
            }

            // Alguns lotes recriam o botão sem acrescentar imediatamente os itens.
            // Se o botão continuar disponível, volta a tentar antes de considerar o processo concluído.
            if (getLoadMoreButton()) {
                idleRounds = 0;
                await new Promise(resolve => window.setTimeout(resolve, 180));
                continue;
            }

            idleRounds += 1;
            if (idleRounds >= REQUIRED_IDLE_ROUNDS) break;
        }

        if (scroller) {
            scroller.scrollTop = Math.min(originalScrollTop, scroller.scrollHeight);
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        }

        // Dá tempo aos observers da pesquisa/filtros para processarem a última página carregada.
        await new Promise(resolve => window.requestAnimationFrame(() => {
            window.requestAnimationFrame(resolve);
        }));
        await new Promise(resolve => window.setTimeout(resolve, 100));

        return getLoadedCommentCount();
    }

    /** Cria um nome de ficheiro previsível e seguro para o sistema operativo. */
    function createFileName(extension) {
        const now = new Date();
        const pad = value => String(value).padStart(2, "0");
        const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
        return `gired-comentarios-${stamp}.${extension}`;
    }

    /** Exporta os dados como CSV quando a biblioteca XLSX nativa não está disponível. */
    function exportCsv(rows) {
        const escapeCell = value => {
            const text = String(value ?? "").replace(/"/g, '""');
            return `"${text}"`;
        };

        const csv = [
            EXPORT_HEADERS.map(escapeCell).join(";"),
            ...rows.map(row => EXPORT_HEADERS.map(header => escapeCell(row[header])).join(";"))
        ].join("\r\n");

        const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = createFileName("csv");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Exporta os comentários para XLSX usando a biblioteca já carregada pelo GiRED. */
    function exportRows(rows) {
        if (!rows.length) {
            window.alert("Não existem comentários para exportar com os filtros atuais.");
            return;
        }

        if (!window.XLSX?.utils?.json_to_sheet || !window.XLSX?.writeFile) {
            exportCsv(rows);
            return;
        }

        const worksheet = window.XLSX.utils.json_to_sheet(rows, {
            header: EXPORT_HEADERS
        });

        worksheet["!cols"] = [
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 55 },
            { wch: 70 },
            { wch: 70 },
            { wch: 70 },
            { wch: 70 },
            { wch: 32 }
        ];

        worksheet["!autofilter"] = {
            ref: `A1:I${rows.length + 1}`
        };

        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Comentários");
        window.XLSX.writeFile(workbook, createFileName("xlsx"));
    }

    /** Carrega todas as páginas e só depois gera o ficheiro integral. */
    async function exportAllComments() {
        if (exportInProgress) return;

        const button = document.getElementById(EXPORT_BUTTON_ID);
        if (!button) return;

        exportInProgress = true;
        const originalHtml = button.innerHTML;
        const originalTitle = button.title;
        button.disabled = true;
        button.title = "A carregar todos os comentários antes de exportar";
        showProcessingOverlay();

        try {
            const loadedCount = await loadAllComments(button);
            const expectedTotal = getExpectedGlobalTotal();

            if (expectedTotal && loadedCount < expectedTotal) {
                hideProcessingOverlay();
                const proceed = window.confirm(
                    `O GiRED indica ${expectedTotal} comentários, mas só foi possível carregar ${loadedCount}. ` +
                    "Queres exportar mesmo assim?"
                );
                if (!proceed) return;
                showProcessingOverlay();
            }

            button.textContent = "A gerar Excel...";
            updateProcessingOverlay(`A gerar o Excel com ${getVisibleComments().length} erro(s)...`);
            const rows = getVisibleComments().map(commentToRow);
            exportRows(rows);
        } finally {
            hideProcessingOverlay();
            button.innerHTML = originalHtml;
            button.title = originalTitle;
            button.disabled = false;
            exportInProgress = false;
        }
    }

    /** Cria o botão imediatamente antes do botão Excel nativo do GiRED. */
    function ensureExportButton() {
        if (!isExtensionEnabled()) {
            document.getElementById(EXPORT_BUTTON_ID)?.remove();
            return;
        }

        const nativeButton = document.querySelector(NATIVE_EXPORT_SELECTOR);
        if (!nativeButton || document.getElementById(EXPORT_BUTTON_ID)) return;

        const button = document.createElement("button");
        button.id = EXPORT_BUTTON_ID;
        button.type = "button";
        button.className = nativeButton.className;
        button.title = "Carregar todos os comentários e exportar com o GiRED Structure Mapper";
        button.setAttribute("aria-label", button.title);
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Excel Mapper';
        button.addEventListener("click", exportAllComments);

        nativeButton.parentNode?.insertBefore(button, nativeButton);
    }

    /** Mantém o botão disponível quando o GiRED reconstrói dinamicamente a aba de comentários. */
    const observer = new MutationObserver(ensureExportButton);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
    });

    ensureExportButton();
})();
