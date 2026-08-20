(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const COMMENT_SELECTOR = ".course-vc-comment-item";
    const NATIVE_EXPORT_SELECTOR = "#vc-export-comments";
    const EXPORT_BUTTON_ID = "gired-vc-export-mapper";
    const SEARCH_HIDDEN_CLASS = "gired-vc-search-hidden";

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

    /** Converte um comentário visível numa linha com a estrutura definida para o Excel. */
    function commentToRow(comment) {
        const issueLink = comment.querySelector(".course-vc-issue-link");
        const unitLink = comment.querySelector(".course-vc-comment-unit-link a");
        const suggestion = comment.querySelector(".course-vc-comment-suggestion");
        const quote = comment.querySelector(".course-vc-comment-quote");

        const location = String(unitLink?.getAttribute("title") || getText(unitLink) || "")
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

    /** Obtém apenas os comentários atualmente apresentados ao utilizador. */
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
            window.alert("Não existem comentários visíveis para exportar.");
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

    /** Recolhe os comentários atualmente visíveis e inicia a exportação. */
    function exportVisibleComments() {
        const rows = getVisibleComments().map(commentToRow);
        exportRows(rows);
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
        button.title = "Exportar comentários visíveis com a estrutura do GiRED Structure Mapper";
        button.setAttribute("aria-label", button.title);
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Excel Mapper';
        button.addEventListener("click", exportVisibleComments);

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
