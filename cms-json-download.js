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

    /** O conteúdo chega duplamente codificado; espelha a descodificação do próprio componente. */
    function decodeContent(raw) {
        return raw
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'");
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
            const data = encoder.encode(entry.text);
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
            text = JSON.stringify(JSON.parse(text), null, 2);
        } catch (_) {
            // JSON inválido: descarrega na mesma o conteúdo em bruto.
        }

        const { sa, at } = await getContextCodes();
        const parts = [getCourseNumber(), sa, at].filter(Boolean);
        parts.push(`DIN(${getDynamicIndex(wrapper)})`);
        downloadBlob(`${parts.join("_")}.json`, new Blob([text], { type: "application/json" }));
    }

    /** Unidades (ATs) da SA atual, pela ordem da barra de sequência. */
    function getUnitTabs() {
        return Array.from(document.querySelectorAll("#sequence-list .nav-item.tab[data-href]"))
            .map((tab, index) => ({
                href: tab.dataset.href,
                title: (tab.dataset.pageTitle || "").trim(),
                code: index === 0 ? "INTROD" : `AT${String(index).padStart(2, "0")}`
            }));
    }

    /** Carrega uma unidade como navegação normal quando o CMS rejeita o fetch com HTTP 400. */
    function loadUnitDocumentInFrame(url) {
        return new Promise((resolve, reject) => {
            const frame = document.createElement("iframe");
            frame.hidden = true;
            frame.setAttribute("aria-hidden", "true");
            frame.setAttribute("sandbox", "allow-same-origin");

            const cleanup = () => {
                window.clearTimeout(timeout);
                frame.remove();
            };

            const timeout = window.setTimeout(() => {
                cleanup();
                reject(new Error("tempo esgotado"));
            }, 20000);

            frame.addEventListener("load", () => {
                try {
                    const html = frame.contentDocument?.documentElement?.outerHTML;
                    if (!html) throw new Error("resposta vazia");
                    const doc = new DOMParser().parseFromString(html, "text/html");
                    cleanup();
                    resolve(doc);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            }, { once: true });

            frame.addEventListener("error", () => {
                cleanup();
                reject(new Error("falha ao carregar a unidade"));
            }, { once: true });

            frame.src = url;
            document.body.appendChild(frame);
        });
    }

    /** Vai buscar os JSONs (já formatados) das dinâmicas de uma unidade da SA. */
    async function fetchUnitDynamics(href) {
        const url = new URL(href, location.href).href;
        let doc;

        try {
            const response = await fetch(url, {
                credentials: "include",
                headers: {
                    "Accept": "text/html,application/xhtml+xml"
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            doc = new DOMParser().parseFromString(await response.text(), "text/html");
        } catch (fetchError) {
            try {
                doc = await loadUnitDocumentInFrame(url);
            } catch (frameError) {
                throw new Error(`${fetchError.message}; navegação alternativa: ${frameError.message}`);
            }
        }

        return Array.from(doc.querySelectorAll(`${WRAPPER_SELECTOR} ${SAGE_CONTENT_SELECTOR}`))
            .map(element => {
                let text = decodeContent(element.getAttribute("data-content") || "");
                try {
                    text = JSON.stringify(JSON.parse(text), null, 2);
                } catch (_) {
                    // JSON inválido: entra no ZIP em bruto na mesma.
                }
                return text;
            });
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

            for (let i = 0; i < tabs.length; i++) {
                const tab = tabs[i];
                label.textContent = `A exportar ${i + 1}/${tabs.length}…`;
                try {
                    const dynamics = await fetchUnitDynamics(tab.href);
                    dynamics.forEach((text, index) => {
                        entries.push({
                            name: `${[...prefix, tab.code].join("_")}_DIN(${index + 1}).json`,
                            text
                        });
                    });
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
                    text: `Unidades que não foi possível exportar:\n${problems.join("\n")}\n`
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
