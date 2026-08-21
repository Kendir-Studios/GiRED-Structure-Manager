(() => {
    "use strict";

    const TEXTAREA_SELECTOR = "textarea.sage-studio-code";
    const TOGGLE_SELECTOR = ".sage-studio-codetoggle";
    const WRAPPER_CLASS = "gired-code-editor";
    const INDENT = "  ";
    const BRACKET_CLASSES = ["tok-br0", "tok-br1", "tok-br2"];
    const PAIRS = { "{": "}", "[": "]", "\"": "\"" };
    const FOLD_CHAR = "\u22EF";
    const FOLD_ZERO = "\u200B";
    const FOLD_ONE = "\u200C";
    const FOLD_END = "\u200D";
    const FOLD_MARKER_PATTERN = /\u22EF[\u200B\u200C]+\u200D/g;
    let nextFoldId = 1;

    /** Cria o marcador visível "⋯" com o id codificado em caracteres de largura zero. */
    function markerFor(id) {
        const bits = id.toString(2).split("").map(bit => (bit === "1" ? FOLD_ONE : FOLD_ZERO)).join("");
        return `${FOLD_CHAR}${bits}${FOLD_END}`;
    }

    /** Recupera o id codificado num marcador. */
    function parseMarkerId(marker) {
        const bits = marker.slice(1, -1).split("").map(ch => (ch === FOLD_ONE ? "1" : "0")).join("");
        return parseInt(bits, 2);
    }

    /** Devolve todos os marcadores de colapso presentes no texto. */
    function findMarkers(value) {
        const markers = [];
        let match;
        FOLD_MARKER_PATTERN.lastIndex = 0;
        while ((match = FOLD_MARKER_PATTERN.exec(value)) !== null) {
            markers.push({ start: match.index, end: match.index + match[0].length, id: parseMarkerId(match[0]) });
        }
        return markers;
    }

    /** Reconstrói o texto completo, substituindo recursivamente os marcadores pelo conteúdo escondido. */
    function expandText(value, folds) {
        let result = value;
        for (let guard = 0; guard < 1000; guard += 1) {
            FOLD_MARKER_PATTERN.lastIndex = 0;
            if (!FOLD_MARKER_PATTERN.test(result)) break;
            FOLD_MARKER_PATTERN.lastIndex = 0;
            result = result.replace(FOLD_MARKER_PATTERN, marker => folds.get(parseMarkerId(marker)) ?? "");
        }
        return result;
    }

    /** Emparelha chavetas/parênteses retos ignorando o interior de strings. */
    function computeBrackets(value) {
        const pairs = new Map();
        const stack = [];
        let inString = false;
        for (let index = 0; index < value.length; index += 1) {
            const ch = value[index];
            if (inString) {
                if (ch === "\\") index += 1;
                else if (ch === "\"") inString = false;
                continue;
            }
            if (ch === "\"") inString = true;
            else if (ch === "{" || ch === "[") stack.push({ ch, index });
            else if (ch === "}" || ch === "]") {
                const open = stack.pop();
                if (open && PAIRS[open.ch] === ch) pairs.set(open.index, index);
            }
        }
        return pairs;
    }

    /** Devolve os índices de início de cada linha. */
    function computeLineStarts(value) {
        const starts = [0];
        for (let index = 0; index < value.length; index += 1) {
            if (value[index] === "\n") starts.push(index + 1);
        }
        return starts;
    }

    /** Linha (0-based) de um índice, por pesquisa binária nos inícios de linha. */
    function lineOf(lineStarts, index) {
        let low = 0;
        let high = lineStarts.length - 1;
        while (low < high) {
            const mid = (low + high + 1) >> 1;
            if (lineStarts[mid] <= index) low = mid;
            else high = mid - 1;
        }
        return low;
    }

    /** Indica se a extensão está atualmente ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains("gired-structure-mapper-disabled");
    }

    /** Escapa texto para ser inserido como HTML. */
    function escapeHtml(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    /**
     * Converte JSON em HTML colorido, preservando exatamente os mesmos caracteres
     * (incluindo espaços e quebras de linha) para ficar alinhado com a textarea.
     */
    function highlightJson(source, activeLine) {
        const tokenPattern = /("(?:\\.|[^"\\\n])*")([ \t]*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}\[\]])|([,:])|(\n)|(\u22EF[\u200B\u200C]+\u200D)|([^\s"{}\[\],:]+)|([ \t\r]+)|([\s\S])/g;
        let html = "";
        let depth = 0;
        let line = 0;
        let lineHtml = "";
        let match;

        const flushLine = () => {
            const cls = line === activeLine ? ' class="line-active"' : "";
            html += `<span${cls}>${lineHtml}\n</span>`;
            lineHtml = "";
            line += 1;
        };

        while ((match = tokenPattern.exec(source)) !== null) {
            const [raw, str, colon, num, bool, nul, bracket, punc, newline, marker, junk, space, other] = match;
            if (newline) {
                flushLine();
            } else if (str) {
                const cls = colon ? "tok-key" : "tok-str";
                lineHtml += `<span class="${cls}">${escapeHtml(str)}</span>`;
                if (colon) lineHtml += `<span class="tok-punc">${escapeHtml(colon)}</span>`;
            } else if (num) {
                lineHtml += `<span class="tok-num">${num}</span>`;
            } else if (bool) {
                lineHtml += `<span class="tok-bool">${bool}</span>`;
            } else if (nul) {
                lineHtml += `<span class="tok-null">${nul}</span>`;
            } else if (bracket) {
                if (bracket === "}" || bracket === "]") depth = Math.max(0, depth - 1);
                const cls = BRACKET_CLASSES[depth % BRACKET_CLASSES.length];
                if (bracket === "{" || bracket === "[") depth += 1;
                lineHtml += `<span class="${cls}">${bracket}</span>`;
            } else if (punc) {
                lineHtml += `<span class="tok-punc">${punc}</span>`;
            } else if (marker) {
                lineHtml += `<span class="tok-fold" title="Região colapsada">${marker}</span>`;
            } else if (junk) {
                lineHtml += `<span class="tok-err">${escapeHtml(junk)}</span>`;
            } else if (space) {
                lineHtml += space;
            } else {
                lineHtml += escapeHtml(other ?? raw);
            }
        }

        flushLine();
        return html;
    }

    /** Calcula a linha (0-based) onde está o cursor. */
    function getCursorLine(textarea) {
        return textarea.value.slice(0, textarea.selectionStart).split("\n").length - 1;
    }

    /** Converte a posição reportada pelo JSON.parse numa indicação legível de linha/coluna. */
    function describeJsonError(error, source) {
        const message = String(error?.message || error);
        const positionMatch = message.match(/position (\d+)/i);
        if (!positionMatch) return message;

        const position = Number(positionMatch[1]);
        const before = source.slice(0, position);
        const line = before.split("\n").length;
        const column = position - before.lastIndexOf("\n");
        return `Linha ${line}, coluna ${column}: ${message.replace(/ in JSON at position \d+.*$/i, "")}`;
    }

    /** Cria a interface do editor à volta de uma textarea nativa do Code view. */
    function enhanceTextarea(textarea) {
        if (textarea.closest(`.${WRAPPER_CLASS}`)) return;

        const wrapper = document.createElement("div");
        wrapper.className = WRAPPER_CLASS;

        const toolbar = document.createElement("div");
        toolbar.className = "gired-code-editor-toolbar";

        const title = document.createElement("span");
        title.className = "gired-code-editor-title";
        title.textContent = "JSON";

        const formatButton = document.createElement("button");
        formatButton.type = "button";
        formatButton.textContent = "Formatar";
        formatButton.title = "Reindentar o JSON (Shift+Alt+F)";

        const compactButton = document.createElement("button");
        compactButton.type = "button";
        compactButton.textContent = "Compactar";
        compactButton.title = "Remover espaços e quebras de linha";

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.textContent = "Copiar";
        copyButton.title = "Copiar todo o conteúdo";

        const foldAllButton = document.createElement("button");
        foldAllButton.type = "button";
        foldAllButton.textContent = "Colapsar tudo";
        foldAllButton.title = "Colapsar todas as regiões de primeiro nível";

        const unfoldAllButton = document.createElement("button");
        unfoldAllButton.type = "button";
        unfoldAllButton.textContent = "Expandir tudo";
        unfoldAllButton.title = "Expandir todas as regiões colapsadas";

        const status = document.createElement("span");
        status.className = "gired-code-editor-status";

        toolbar.append(title, formatButton, compactButton, copyButton, foldAllButton, unfoldAllButton, status);

        const body = document.createElement("div");
        body.className = "gired-code-editor-body";

        const gutter = document.createElement("div");
        gutter.className = "gired-code-editor-gutter";

        const scroll = document.createElement("div");
        scroll.className = "gired-code-editor-scroll";

        const highlight = document.createElement("pre");
        highlight.className = "gired-code-editor-highlight";
        highlight.setAttribute("aria-hidden", "true");

        textarea.before(wrapper);
        scroll.append(highlight, textarea);
        body.append(gutter, scroll);
        wrapper.append(toolbar, body);

        textarea.setAttribute("spellcheck", "false");
        textarea.setAttribute("autocomplete", "off");
        textarea.setAttribute("autocorrect", "off");
        textarea.setAttribute("autocapitalize", "off");
        textarea.setAttribute("wrap", "off");

        let renderScheduled = false;
        let lastRenderedValue = null;
        let lastActiveLine = -1;
        const folds = new Map();

        /** Texto completo, com todas as regiões colapsadas expandidas. */
        const fullValue = () => expandText(textarea.value, folds);

        /** Atualiza o estado de validação apresentado na barra. */
        const updateStatus = () => {
            const value = fullValue();
            if (!value.trim()) {
                status.textContent = "Vazio";
                status.classList.add("is-error");
                return;
            }
            try {
                JSON.parse(value);
                status.textContent = "JSON válido";
                status.classList.remove("is-error");
            } catch (error) {
                status.textContent = describeJsonError(error, value);
                status.classList.add("is-error");
            }
        };

        /** Mantém a camada colorida e a numeração de linhas alinhadas com o scroll da textarea. */
        const syncScroll = () => {
            highlight.scrollTop = textarea.scrollTop;
            highlight.scrollLeft = textarea.scrollLeft;
            gutter.scrollTop = textarea.scrollTop;
        };

        /** Redesenha o realce e a numeração. */
        const render = () => {
            renderScheduled = false;
            const value = textarea.value;
            const activeLine = getCursorLine(textarea);
            if (value === lastRenderedValue && activeLine === lastActiveLine) {
                syncScroll();
                return;
            }
            lastRenderedValue = value;
            lastActiveLine = activeLine;

            highlight.innerHTML = highlightJson(value, activeLine);

            const lineStarts = computeLineStarts(value);
            const lineCount = lineStarts.length;
            const foldableByLine = new Map();
            computeBrackets(value).forEach((close, open) => {
                const openLine = lineOf(lineStarts, open);
                if (lineOf(lineStarts, close) === openLine) return;
                const existing = foldableByLine.get(openLine);
                if (existing === undefined || open < existing) foldableByLine.set(openLine, open);
            });
            const foldedLines = new Set(findMarkers(value).map(m => lineOf(lineStarts, m.start)));

            const lines = [];
            for (let index = 0; index < lineCount; index += 1) {
                let icon = '<span class="gired-code-editor-fold"> </span>';
                if (foldedLines.has(index)) {
                    icon = `<span class="gired-code-editor-fold is-folded" data-action="unfold" data-line="${index}" title="Expandir">▸</span>`;
                } else if (foldableByLine.has(index)) {
                    icon = `<span class="gired-code-editor-fold" data-action="fold" data-open="${foldableByLine.get(index)}" title="Colapsar">▾</span>`;
                }
                const number = index === activeLine ? `<span class="is-active">${index + 1}</span>` : String(index + 1);
                lines.push(`${number}${icon}`);
            }
            gutter.innerHTML = lines.join("\n");
            gutter.style.minWidth = `${Math.max(3, String(lineCount).length) + 3}ch`;

            updateStatus();
            syncScroll();
        };

        /** Agenda um único redesenho por frame. */
        const scheduleRender = () => {
            if (renderScheduled) return;
            renderScheduled = true;
            requestAnimationFrame(render);
        };

        /** Colapsa a região cujo parêntese de abertura está em openIndex. */
        const foldAt = openIndex => {
            const value = textarea.value;
            const close = computeBrackets(value).get(openIndex);
            if (close === undefined || !value.slice(openIndex, close).includes("\n")) return false;

            const id = nextFoldId++;
            folds.set(id, value.slice(openIndex + 1, close));
            const marker = markerFor(id);
            const caret = textarea.selectionStart;
            textarea.setRangeText(marker, openIndex + 1, close, "preserve");
            if (caret > openIndex && caret <= close) {
                const after = openIndex + 1 + marker.length;
                textarea.setSelectionRange(after, after);
            }
            lastRenderedValue = null;
            scheduleRender();
            return true;
        };

        /** Expande um marcador concreto. */
        const unfoldMarker = marker => {
            const hidden = folds.get(marker.id) ?? "";
            folds.delete(marker.id);
            textarea.setRangeText(hidden, marker.start, marker.end, "preserve");
            lastRenderedValue = null;
            scheduleRender();
        };

        /** Expande todas as regiões, incluindo as aninhadas dentro de outras colapsadas. */
        const unfoldAll = () => {
            for (let guard = 0; guard < 1000; guard += 1) {
                const markers = findMarkers(textarea.value);
                if (!markers.length) break;
                markers.reverse().forEach(unfoldMarker);
            }
            folds.clear();
        };

        /** Expande qualquer região colapsada tocada pelo intervalo indicado, para não a corromper. */
        const unfoldTouching = (start, end) => {
            const markers = findMarkers(textarea.value).filter(m =>
                (start === end ? start > m.start && start < m.end : start < m.end && end > m.start));
            markers.reverse().forEach(unfoldMarker);
            return markers.length > 0;
        };

        /** Colapsa todas as regiões de primeiro nível (filhos diretos da raiz). */
        const foldAll = () => {
            unfoldAll();
            const value = textarea.value;
            const pairs = computeBrackets(value);
            const opens = [...pairs.keys()].sort((a, b) => a - b);
            const rootOpen = opens[0];
            if (rootOpen === undefined) return;
            const rootClose = pairs.get(rootOpen);
            const topLevel = [];
            let cursor = rootOpen;
            opens.forEach(open => {
                if (open > cursor && pairs.get(open) < rootClose) {
                    topLevel.push(open);
                    cursor = pairs.get(open);
                }
            });
            topLevel.reverse().forEach(open => foldAt(open));
            textarea.setSelectionRange(0, 0);
            textarea.scrollTop = 0;
        };

        /** Colapsa a região mais interior que contém o cursor. */
        const foldAtCursor = () => {
            const caret = textarea.selectionStart;
            const value = textarea.value;
            let best = -1;
            computeBrackets(value).forEach((close, open) => {
                if (open < caret && caret <= close && open > best && value.slice(open, close).includes("\n")) best = open;
            });
            if (best >= 0) foldAt(best);
        };

        /** Expande a primeira região colapsada na linha do cursor. */
        const unfoldAtCursor = () => {
            const value = textarea.value;
            const caret = textarea.selectionStart;
            const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
            const lineEndIndex = value.indexOf("\n", caret);
            const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
            const marker = findMarkers(value).find(m => m.start >= lineStart && m.start <= lineEnd);
            if (marker) unfoldMarker(marker);
        };

        gutter.addEventListener("mousedown", event => {
            const target = event.target.closest("[data-action]");
            if (!target) return;
            event.preventDefault();
            if (target.dataset.action === "fold") {
                foldAt(Number(target.dataset.open));
            } else {
                const line = Number(target.dataset.line);
                const lineStarts = computeLineStarts(textarea.value);
                const marker = findMarkers(textarea.value).find(m => lineOf(lineStarts, m.start) === line);
                if (marker) unfoldMarker(marker);
            }
            textarea.focus();
        });

        foldAllButton.addEventListener("click", foldAll);
        unfoldAllButton.addEventListener("click", unfoldAll);

        /** Substitui a seleção atual preservando o histórico de undo sempre que possível. */
        const insertText = text => {
            textarea.focus();
            if (!document.execCommand || !document.execCommand("insertText", false, text)) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.setRangeText(text, start, end, "end");
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
            }
        };

        /** Substitui todo o conteúdo mantendo o cursor no início. */
        const replaceAll = text => {
            folds.clear();
            textarea.focus();
            textarea.select();
            insertText(text);
            textarea.setSelectionRange(0, 0);
            textarea.scrollTop = 0;
            scheduleRender();
        };

        /** Reindenta o JSON quando este for válido. */
        const formatJson = () => {
            try {
                replaceAll(JSON.stringify(JSON.parse(fullValue()), null, 2));
            } catch (_) {
                updateStatus();
            }
        };

        /** Compacta o JSON quando este for válido. */
        const compactJson = () => {
            try {
                replaceAll(JSON.stringify(JSON.parse(fullValue())));
            } catch (_) {
                updateStatus();
            }
        };

        formatButton.addEventListener("click", formatJson);
        compactButton.addEventListener("click", compactJson);
        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(fullValue());
                copyButton.textContent = "Copiado";
                setTimeout(() => { copyButton.textContent = "Copiar"; }, 1200);
            } catch (_) {
                textarea.select();
            }
        });

        /** Atalhos de teclado no estilo dos editores de código. */
        textarea.addEventListener("keydown", event => {
            if (!isExtensionEnabled()) return;

            const withMod = event.ctrlKey || event.metaKey;
            if (withMod && event.shiftKey && (event.code === "BracketLeft" || event.key === "[" || event.key === "{")) {
                event.preventDefault();
                foldAtCursor();
                return;
            }
            if (withMod && event.shiftKey && (event.code === "BracketRight" || event.key === "]" || event.key === "}")) {
                event.preventDefault();
                unfoldAtCursor();
                return;
            }

            const isEditingKey = event.key.length === 1 || ["Backspace", "Delete", "Enter", "Tab"].includes(event.key);
            if (isEditingKey && !withMod) {
                const selectionStart = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;
                let touched;
                if (event.key === "Backspace" && selectionStart === selectionEnd) {
                    touched = unfoldTouching(selectionStart - 1, selectionStart);
                } else if (event.key === "Delete" && selectionStart === selectionEnd) {
                    touched = unfoldTouching(selectionStart, selectionStart + 1);
                } else {
                    touched = unfoldTouching(selectionStart, selectionEnd);
                }
                if (touched && (event.key === "Backspace" || event.key === "Delete")) {
                    event.preventDefault();
                    return;
                }
            }

            const { selectionStart: start, selectionEnd: end, value } = textarea;

            if (event.key === "Tab") {
                event.preventDefault();
                const lineStart = value.lastIndexOf("\n", start - 1) + 1;
                const selectionHasLines = value.slice(start, end).includes("\n");

                if (selectionHasLines || event.shiftKey) {
                    const lineEnd = value.indexOf("\n", end);
                    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
                    const block = value.slice(lineStart, blockEnd);
                    const updated = block
                        .split("\n")
                        .map(lineText => event.shiftKey
                            ? lineText.replace(new RegExp(`^(${INDENT}|\t)`), "")
                            : INDENT + lineText)
                        .join("\n");
                    textarea.setSelectionRange(lineStart, blockEnd);
                    insertText(updated);
                    textarea.setSelectionRange(lineStart, lineStart + updated.length);
                } else {
                    insertText(INDENT);
                }
                scheduleRender();
                return;
            }

            if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                const lineStart = value.lastIndexOf("\n", start - 1) + 1;
                const currentIndent = (value.slice(lineStart, start).match(/^[ \t]*/) || [""])[0];
                const previousChar = value[start - 1];
                const nextChar = value[end];
                const opensBlock = previousChar === "{" || previousChar === "[";
                const closesBlock = opensBlock && (nextChar === "}" || nextChar === "]");

                if (closesBlock) {
                    insertText(`\n${currentIndent}${INDENT}\n${currentIndent}`);
                    const caret = start + 1 + currentIndent.length + INDENT.length;
                    textarea.setSelectionRange(caret, caret);
                } else {
                    insertText(`\n${currentIndent}${opensBlock ? INDENT : ""}`);
                }
                scheduleRender();
                return;
            }

            if (start === end && PAIRS[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey) {
                const nextChar = value[start];
                if (event.key === "\"" && nextChar === "\"") {
                    event.preventDefault();
                    textarea.setSelectionRange(start + 1, start + 1);
                    scheduleRender();
                    return;
                }
                if (event.key === "\"" && /[\w"]/.test(value[start - 1] || "")) return;
                if (nextChar && !/[\s,\]}]/.test(nextChar)) return;
                event.preventDefault();
                insertText(event.key + PAIRS[event.key]);
                textarea.setSelectionRange(start + 1, start + 1);
                scheduleRender();
                return;
            }

            if (start === end && (event.key === "}" || event.key === "]") && value[start] === event.key) {
                event.preventDefault();
                textarea.setSelectionRange(start + 1, start + 1);
                scheduleRender();
                return;
            }

            if (event.key === "Backspace" && start === end && start > 0) {
                const previousChar = value[start - 1];
                const nextChar = value[start];
                if (PAIRS[previousChar] === nextChar) {
                    event.preventDefault();
                    textarea.setSelectionRange(start - 1, start + 1);
                    insertText("");
                    scheduleRender();
                    return;
                }
            }

            if (event.shiftKey && event.altKey && event.key.toLowerCase() === "f") {
                event.preventDefault();
                formatJson();
            }
        });

        textarea.addEventListener("beforeinput", () => {
            unfoldTouching(textarea.selectionStart, textarea.selectionEnd);
        });
        textarea.addEventListener("input", scheduleRender);

        /** Se o cursor ficar dentro de um marcador (por clique ou setas), a região expande-se. */
        const expandUnderCaret = () => {
            if (document.activeElement !== textarea) return;
            const { selectionStart, selectionEnd } = textarea;
            if (selectionStart !== selectionEnd) return;
            const marker = findMarkers(textarea.value).find(m => selectionStart > m.start && selectionStart < m.end);
            if (marker) unfoldMarker(marker);
        };
        textarea.addEventListener("keyup", expandUnderCaret);
        textarea.addEventListener("mouseup", () => setTimeout(expandUnderCaret, 0));

        /** Antes de o xblock ler a textarea (Save / Visual view), tudo é expandido. */
        document.addEventListener("click", event => {
            const button = event.target.closest(".sage-studio-save, .sage-studio-codetoggle, .action-save");
            if (!button || !findMarkers(textarea.value).length) return;
            unfoldAll();
        }, true);
        textarea.addEventListener("scroll", syncScroll, { passive: true });
        ["keyup", "click", "select", "focus"].forEach(type => textarea.addEventListener(type, scheduleRender));
        document.addEventListener("selectionchange", () => {
            if (document.activeElement === textarea) scheduleRender();
        });

        /** O xblock alterna display:none/block na textarea; o wrapper segue esse estado. */
        const syncVisibility = () => {
            const visible = textarea.style.display !== "none";
            wrapper.classList.toggle("is-visible", visible);
            if (visible) {
                lastRenderedValue = null;
                scheduleRender();
            }
        };

        new MutationObserver(syncVisibility).observe(textarea, { attributes: true, attributeFilter: ["style"] });
        syncVisibility();

        /** O botão nativo "Code view" escreve o JSON na textarea sem disparar input. */
        const toggle = textarea.parentElement?.querySelector(TOGGLE_SELECTOR)
            || textarea.closest(".sage-singlechoiceunified-studio, .xblock-studio_view, .xblock")?.querySelector(TOGGLE_SELECTOR);
        toggle?.addEventListener("click", () => {
            lastRenderedValue = null;
            setTimeout(scheduleRender, 0);
        });

        new ResizeObserver(syncScroll).observe(scroll);
    }

    /** Aplica o editor a todas as textareas de Code view já presentes. */
    function enhanceAll() {
        document.querySelectorAll(TEXTAREA_SELECTOR).forEach(enhanceTextarea);
    }

    /** O Studio injeta o modal dinamicamente; observamos a sua criação. */
    function startObserver() {
        let scheduled = false;
        const observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                enhanceAll();
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    enhanceAll();
    startObserver();
})();
