(() => {
    "use strict";

    const ITEM_CLASS = "gired-json-download";
    const SA_BUTTON_CLASS = "gired-sa-export";
    const CONTEXT_KEY = "giredStructureMapperContextV2";
    const ROUTE_MAP_KEY = "giredStructureMapperRoutesV2";
    const WRAPPER_SELECTOR = "li.studio-xblock-wrapper";
    const SAGE_CONTENT_SELECTOR = ".sage-react-xblock[data-content]";

    let scheduled = false;

    /** Normaliza texto para segmentos de nome de ficheiro (ex.: "SA 01" -> "SA01"). */
    function compact(value) {
        return (value || "").replace(/\s+/g, "").trim();
    }

    /** Código sequencial da dinâmica sem parênteses (ex.: DIN01). */
    function dynamicCode(index) {
        return `DIN${String(index).padStart(2, "0")}`;
    }

    /** O conteúdo chega duplamente codificado; espelha a descodificação do próprio componente. */
    function decodeContent(raw) {
        return raw
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'");
    }

    /** Troca caracteres tipográficos por equivalentes simples: “ ” ' « » -> ", … -> ..., — -> -. */
    function correctChars(str) {
        const chars = { "'": "\"", "“": "\"", "”": "\"", "…": "...", "»": "\"", "«": "\"", "—": "-" };
        return str.replace(/[“”—…'«»]/g, (m) => chars[m]);
    }

    /** Aplica correctChars a todos os valores de texto de um JSON já analisado. */
    function correctCharsDeep(value) {
        if (typeof value === "string") return correctChars(value);
        if (Array.isArray(value)) return value.map(correctCharsDeep);
        if (value && typeof value === "object") {
            const result = {};
            for (const [key, item] of Object.entries(value)) result[key] = correctCharsDeep(item);
            return result;
        }
        return value;
    }

    /** Número do recurso no cabeçalho do CMS (ex.: RED_MAT07_ST2). */
    function getCourseNumber() {
        return compact(document.querySelector(".info-course .course-number")?.textContent);
    }

    /** Códigos SA/AT: primeiro pelos badges já injetados, depois pelo contexto guardado. */
    async function getContextCodes() {
        const sa = compact(document.querySelector(".gired-structure-mapper-cms-sa")?.textContent);
        const at = compact(document.querySelector(".gired-structure-mapper-cms-at")?.textContent);
        if (sa && at) return { sa, at };

        try {
            const result = await chrome.storage.local.get([CONTEXT_KEY, ROUTE_MAP_KEY]);
            const url = new URL(location.href);
            url.hash = "";
            const route = `${url.origin}${url.pathname}${url.search}`;
            const context = result[ROUTE_MAP_KEY]?.[route] || result[CONTEXT_KEY] || null;
            return {
                sa: sa || compact(context?.saCode),
                at: at || compact(context?.atCode)
            };
        } catch (_) {
            return { sa, at };
        }
    }

    /** Posição (1-based) desta dinâmica entre as dinâmicas SAGE da unidade. */
    function getDynamicIndex(wrapper) {
        const dynamics = Array.from(document.querySelectorAll(WRAPPER_SELECTOR))
            .filter(item => item.querySelector(SAGE_CONTENT_SELECTOR));
        return dynamics.indexOf(wrapper) + 1;
    }

    /** Descarrega um blob através de um link temporário. */
    function downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    const MEDIA_PATH_RE = /\.(?:png|jpe?g|gif|webp|svg|bmp|avif|mp3|wav|ogg|m4a|aac|flac|mp4|webm)(?:$|[?#])/i;
    const MEDIA_REFERENCE_RE = /(?:https?:\/\/|\/\/|\/|\.\.\/|\.\/)?[a-z0-9_%+().@-]+(?:\/[a-z0-9_%+().@-]+)*\.(?:png|jpe?g|gif|webp|svg|bmp|avif|mp3|wav|ogg|m4a|aac|flac|mp4|webm)(?:\?[^"'\s<>]*)?/gi;

    function mediaExtensionFromType(type) {
        const normalized = (type || "").split(";")[0].trim().toLowerCase();
        return {
            "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
            "image/webp": ".webp", "image/svg+xml": ".svg", "image/bmp": ".bmp",
            "image/avif": ".avif", "audio/mpeg": ".mp3", "audio/wav": ".wav",
            "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/aac": ".aac",
            "audio/flac": ".flac", "video/mp4": ".mp4", "video/webm": ".webm"
        }[normalized] || "";
    }

    function safeFilename(value) {
        return (value || "media")
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, "_")
            .replace(/^\.+|\.+$/g, "") || "media";
    }

    function mediaBasename(value) {
        try {
            const pathname = value.startsWith("data:")
                ? ""
                : new URL(value, location.href).pathname;
            return decodeURIComponent(pathname.split("/").pop() || "").toLowerCase();
        } catch (_) {
            return decodeURIComponent(String(value).split(/[?#]/)[0].split("/").pop() || "").toLowerCase();
        }
    }

    function resolveMediaUrl(value, baseUrl, mediaLookup) {
        if (typeof value !== "string" || !value.trim()) return null;
        if (value.startsWith("data:image/") || value.startsWith("data:audio/") || value.startsWith("data:video/")) {
            return value;
        }

        const renderedUrl = mediaLookup?.[mediaBasename(value)];
        if (renderedUrl) return renderedUrl;

        try {
            const url = new URL(value, baseUrl);
            if (!["http:", "https:"].includes(url.protocol)) return null;
            return MEDIA_PATH_RE.test(url.href) ? url.href : null;
        } catch (_) {
            return null;
        }
    }

    function getRenderedMediaLookup(element, baseUrl) {
        const lookup = {};
        element.querySelectorAll("img[src], audio[src], video[src], source[src]").forEach(media => {
            const source = media.currentSrc || media.getAttribute("src") || "";
            if (!source) return;
            try {
                const url = new URL(source, baseUrl).href;
                const names = [
                    mediaBasename(source),
                    mediaBasename(media.getAttribute("src") || "")
                ].filter(Boolean);
                names.forEach(name => { lookup[name] = url; });
            } catch (_) {
                // Um recurso inválido não impede a exportação dos restantes.
            }
        });
        return lookup;
    }

    function uniqueMediaName(url, response, jsonStem, state) {
        let basename = "";
        if (!url.startsWith("data:")) {
            try {
                basename = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
            } catch (_) {
                basename = "";
            }
        }

        const typeExtension = mediaExtensionFromType(response.headers.get("content-type"));
        basename = safeFilename(basename || `media${typeExtension}`);
        if (!/\.[a-z0-9]{2,5}$/i.test(basename) && typeExtension) basename += typeExtension;

        const dot = basename.lastIndexOf(".");
        const root = dot > 0 ? basename.slice(0, dot) : basename;
        const extension = dot > 0 ? basename.slice(dot) : "";
        const prefix = safeFilename(jsonStem);
        let candidate = `${prefix}_${root}${extension}`;
        let number = 2;
        while (state.usedNames.has(candidate.toLowerCase())) {
            candidate = `${prefix}_${root}_${number++}${extension}`;
        }
        state.usedNames.add(candidate.toLowerCase());
        return candidate;
    }

    async function downloadMediaReference(url, jsonStem, entries, state, problems) {
        if (state.byUrl.has(url)) return state.byUrl.get(url);

        try {
            const response = await fetch(url, { credentials: "include" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const filename = uniqueMediaName(url, response, jsonStem, state);
            entries.push({
                name: filename,
                data: new Uint8Array(await response.arrayBuffer())
            });
            state.byUrl.set(url, filename);
            return filename;
        } catch (error) {
            problems.push(`Média ${url.slice(0, 180)}: ${error.message}`);
            return null;
        }
    }

    async function localizeMediaString(value, baseUrl, mediaLookup, jsonStem, entries, state, problems) {
        const wholeUrl = resolveMediaUrl(value, baseUrl, mediaLookup);
        if (wholeUrl) {
            return await downloadMediaReference(wholeUrl, jsonStem, entries, state, problems) || value;
        }

        const references = Array.from(new Set(value.match(MEDIA_REFERENCE_RE) || []));
        let localized = value;
        for (const reference of references) {
            const url = resolveMediaUrl(reference, baseUrl, mediaLookup);
            if (!url) continue;
            const filename = await downloadMediaReference(url, jsonStem, entries, state, problems);
            if (filename) localized = localized.split(reference).join(filename);
        }
        return localized;
    }

    async function localizeMedia(value, baseUrl, mediaLookup, jsonStem, entries, state, problems) {
        if (typeof value === "string") {
            return localizeMediaString(value, baseUrl, mediaLookup, jsonStem, entries, state, problems);
        }
        if (Array.isArray(value)) {
            return Promise.all(value.map(item => localizeMedia(item, baseUrl, mediaLookup, jsonStem, entries, state, problems)));
        }
        if (value && typeof value === "object") {
            const localized = {};
            for (const [key, item] of Object.entries(value)) {
                localized[key] = await localizeMedia(item, baseUrl, mediaLookup, jsonStem, entries, state, problems);
            }
            return localized;
        }
        return value;
    }

    async function packageDynamicJson(dynamic, jsonStem, entries, state, problems) {
        try {
            const parsed = JSON.parse(dynamic.text);
            const localized = await localizeMedia(
                parsed, dynamic.baseUrl, dynamic.mediaLookup, jsonStem, entries, state, problems
            );
            return JSON.stringify(localized, null, 2);
        } catch (_) {
            return dynamic.text;
        }
    }

    // ---------- ZIP mínimo (entradas STORED, sem compressão) ----------

    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /** Constrói um .zip a partir de entradas {name, text} (nomes em UTF-8). */
    function buildZip(entries) {
        const encoder = new TextEncoder();
        const u16 = value => new Uint8Array([value & 255, (value >> 8) & 255]);
        const u32 = value => new Uint8Array([value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255]);

        const now = new Date();
        const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
        const dosDate = ((((now.getFullYear() - 1980) & 0x7F) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

        const chunks = [];
        const central = [];
        let offset = 0;
        let centralSize = 0;

        for (const entry of entries) {
            const name = encoder.encode(entry.name);
            const data = entry.data instanceof Uint8Array
                ? entry.data
                : encoder.encode(entry.text || "");
            const crc = crc32(data);

            // Cabeçalho local + nome + dados (flag 0x0800 = nome em UTF-8).
            const local = [u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
                u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data];
            local.forEach(part => chunks.push(part));

            const record = [u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
                u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
                u32(0), u32(offset), name];
            record.forEach(part => central.push(part));

            offset += local.reduce((sum, part) => sum + part.length, 0);
            centralSize += record.reduce((sum, part) => sum + part.length, 0);
        }

        const end = [u32(0x06054B50), u16(0), u16(0), u16(entries.length), u16(entries.length),
            u32(centralSize), u32(offset), u16(0)];

        return new Blob([...chunks, ...central, ...end], { type: "application/zip" });
    }

    /** Extrai, formata e descarrega o JSON da dinâmica do wrapper indicado. */
    async function exportDynamicJson(wrapper) {
        const container = wrapper.querySelector(SAGE_CONTENT_SELECTOR);
        if (!container) return;

        let text = decodeContent(container.dataset.content || "");
        try {
            text = JSON.stringify(correctCharsDeep(JSON.parse(text)), null, 2);
        } catch (_) {
            // JSON inválido: descarrega na mesma o conteúdo em bruto.
        }

        const { sa, at } = await getContextCodes();
        const parts = [getCourseNumber(), sa, at].filter(Boolean);
        parts.push(dynamicCode(getDynamicIndex(wrapper)));
        downloadBlob(`${parts.join("_")}.json`, new Blob([text], { type: "application/json" }));
    }

    /** Unidades (ATs) da SA atual, pela ordem da barra de sequência. */
    function getUnitTabs() {
        return Array.from(document.querySelectorAll("#sequence-list .nav-item.tab[data-href]"))
            .map((tab, index) => ({
                href: tab.dataset.href,
                title: (tab.dataset.pageTitle || "").trim(),
                code: index === 0 ? "INTROD" : `AT${String(index).padStart(2, "0")}`,
                active: tab.classList.contains("active")
                    || tab.getAttribute("aria-selected") === "true"
                    || tab.getAttribute("aria-expanded") === "true"
            }));
    }

    /** Extrai e formata as dinâmicas SAGE já renderizadas num documento. */
    function extractDynamics(doc, baseUrl) {
        return Array.from(doc.querySelectorAll(`${WRAPPER_SELECTOR} ${SAGE_CONTENT_SELECTOR}`))
            .map(element => {
                let text = decodeContent(element.getAttribute("data-content") || "");
                try {
                    text = JSON.stringify(correctCharsDeep(JSON.parse(text)), null, 2);
                } catch (_) {
                    // JSON inválido: entra no ZIP em bruto na mesma.
                }
                return {
                    text,
                    baseUrl,
                    mediaLookup: getRenderedMediaLookup(element, baseUrl)
                };
            });
    }

    /** Carrega uma unidade como navegação normal e espera pela renderização do CMS. */
    function loadUnitDocumentInFrame(url) {
        return new Promise((resolve, reject) => {
            const frame = document.createElement("iframe");
            frame.hidden = true;
            frame.setAttribute("aria-hidden", "true");

            let settled = false;
            let poll = null;
            let renderedAt = 0;

            const cleanup = () => {
                if (poll) window.clearInterval(poll);
                window.clearTimeout(timeout);
                frame.remove();
            };

            const finish = () => {
                if (settled) return;
                try {
                    const html = frame.contentDocument?.documentElement?.outerHTML;
                    if (!html) throw new Error("resposta vazia");
                    settled = true;
                    cleanup();
                    resolve(new DOMParser().parseFromString(html, "text/html"));
                } catch (error) {
                    settled = true;
                    cleanup();
                    reject(error);
                }
            };

            const timeout = window.setTimeout(finish, 15000);

            frame.addEventListener("load", () => {
                // O Studio injeta os XBlocks depois do load; aguarda até aparecer uma
                // dinâmica ou até ao limite, que também cobre unidades legitimamente vazias.
                poll = window.setInterval(() => {
                    try {
                        if (frame.contentDocument?.querySelector(SAGE_CONTENT_SELECTOR)) {
                            if (!renderedAt) renderedAt = Date.now();
                            if (Date.now() - renderedAt >= 1000) finish();
                        }
                    } catch (error) {
                        settled = true;
                        cleanup();
                        reject(error);
                    }
                }, 250);
            }, { once: true });

            frame.addEventListener("error", () => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error("falha ao carregar a unidade"));
            }, { once: true });

            frame.src = url;
            document.body.appendChild(frame);
        });
    }

    /** Vai buscar os JSONs (já formatados) das dinâmicas de uma unidade da SA. */
    async function fetchUnitDynamics(href, active) {
        // A unidade aberta já está totalmente renderizada e é a fonte mais fiável.
        if (active) return extractDynamics(document, location.href);

        const url = new URL(href, location.href).href;
        let fetchError = null;

        try {
            const response = await fetch(url, {
                credentials: "include",
                headers: {
                    "Accept": "text/html,application/xhtml+xml"
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const doc = new DOMParser().parseFromString(await response.text(), "text/html");
            const dynamics = extractDynamics(doc, url);
            if (dynamics.length) return dynamics;
        } catch (error) {
            fetchError = error;
        }

        try {
            return extractDynamics(await loadUnitDocumentInFrame(url), url);
        } catch (frameError) {
            const detail = fetchError ? `${fetchError.message}; ` : "";
            throw new Error(`${detail}navegação alternativa: ${frameError.message}`);
        }
    }

    /** Exporta um ZIP com os JSONs de todas as dinâmicas da SA atual. */
    async function exportSaZip(button) {
        if (button.dataset.busy) return;
        button.dataset.busy = "true";
        button.disabled = true;
        const label = button.querySelector(".button-label");
        const originalLabel = label.textContent;

        try {
            const tabs = getUnitTabs();
            const { sa } = await getContextCodes();
            const prefix = [getCourseNumber(), sa].filter(Boolean);

            const entries = [];
            const problems = [];
            const mediaState = { byUrl: new Map(), usedNames: new Set() };

            for (let i = 0; i < tabs.length; i++) {
                const tab = tabs[i];
                label.textContent = `A exportar ${i + 1}/${tabs.length}…`;
                try {
                    const dynamics = await fetchUnitDynamics(tab.href, tab.active);
                    for (let index = 0; index < dynamics.length; index++) {
                        const jsonStem = `${[...prefix, tab.code].join("_")}_${dynamicCode(index + 1)}`;
                        const text = await packageDynamicJson(
                            dynamics[index], jsonStem, entries, mediaState, problems
                        );
                        entries.push({ name: `${jsonStem}.json`, text });
                    }
                } catch (error) {
                    problems.push(`${tab.code} (${tab.title}): ${error.message}`);
                }
            }

            if (!entries.length && !problems.length) {
                label.textContent = "Sem dinâmicas nesta SA";
                return;
            }

            if (problems.length) {
                entries.push({
                    name: `${prefix.join("_") || "SA"}_AVISOS.txt`,
                    text: `Avisos durante a exportação:\n${problems.join("\n")}\n`
                });
            }

            downloadBlob(`${prefix.join("_") || "SA"}.zip`, buildZip(entries));
            label.textContent = problems.length ? `Concluído (${problems.length} avisos)` : "Concluído";
        } catch (_) {
            label.textContent = "Falhou; tenta novamente";
        } finally {
            window.setTimeout(() => {
                label.textContent = originalLabel;
                button.disabled = false;
                delete button.dataset.busy;
            }, 2500);
        }
    }

    /** Acrescenta "Descarregar JSON" ao menu de ações de cada dinâmica SAGE. */
    function ensureMenuItems() {
        scheduled = false;
        if (location.hostname !== "cms.gired.pt") return;

        document.querySelectorAll(WRAPPER_SELECTOR).forEach(wrapper => {
            if (!wrapper.querySelector(SAGE_CONTENT_SELECTOR)) return;

            const menu = wrapper.querySelector(".xblock-header-primary .action-actions-menu .nav-sub ul");
            if (!menu || menu.querySelector(`.${ITEM_CLASS}`)) return;

            const item = document.createElement("li");
            item.className = "nav-item";

            const link = document.createElement("a");
            link.className = ITEM_CLASS;
            link.href = "#";
            link.setAttribute("role", "button");
            link.textContent = "Descarregar JSON";
            link.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                wrapper.querySelector(".action-actions-menu .wrapper-nav-sub")?.classList.remove("is-shown");
                void exportDynamicJson(wrapper);
            });

            item.appendChild(link);

            // Mantém o "Eliminar" como última ação, à maneira do menu nativo.
            const deleteItem = menu.querySelector(".delete-button")?.closest("li");
            if (deleteItem) menu.insertBefore(item, deleteItem);
            else menu.appendChild(item);
        });

        ensureSaButton();
    }

    /** Botão na barra lateral para descarregar a SA inteira em ZIP. */
    function ensureSaButton() {
        if (!document.querySelector("#sequence-list .nav-item.tab[data-href]")) return;

        const publishing = document.querySelector("#publish-unit .bit-publishing");
        if (!publishing || publishing.querySelector(`.${SA_BUTTON_CLASS}`)) return;

        const wrapper = document.createElement("div");
        wrapper.className = "wrapper-pub-actions bar-mod-actions";

        const list = document.createElement("ul");
        const item = document.createElement("li");

        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-outline-primary btn-default ${SA_BUTTON_CLASS}`;
        button.title = "Exporta um ZIP com os JSONs de todas as dinâmicas desta SA";

        const icon = document.createElement("span");
        icon.className = "icon fa fa-download";
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = "button-label";
        label.textContent = "Descarregar JSONs da SA";

        button.append(icon, label);
        button.addEventListener("click", () => void exportSaZip(button));

        item.appendChild(button);
        list.appendChild(item);
        wrapper.appendChild(list);
        publishing.appendChild(wrapper);
    }

    /** Agrupa alterações rápidas do DOM numa única passagem. */
    function scheduleEnsure() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(ensureMenuItems);
    }

    /** O Studio recria os cabeçalhos dos componentes dinamicamente. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation =>
                !(mutation.target instanceof Element)
                || !mutation.target.closest(`.${ITEM_CLASS}, .${SA_BUTTON_CLASS}`));
            if (relevant) scheduleEnsure();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function initialize() {
        ensureMenuItems();
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
