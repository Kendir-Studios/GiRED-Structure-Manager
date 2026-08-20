(() => {
    "use strict";

    const EXPORT_FILE_PREFIX = "gired-comentarios-";
    const EXPORT_SHEET_NAME = "Comentários";
    const LINK_COLUMN_INDEX = 3;
    const PATCH_FLAG = "__giredStructureMapperHyperlinkPatch";

    /**
     * Aplica hiperligações reais às células da coluna "Link" antes de o ficheiro
     * XLSX ser escrito pelo SheetJS usado pelo GiRED.
     */
    function addWorksheetHyperlinks(workbook, fileName) {
        if (!workbook?.Sheets || !String(fileName || "").startsWith(EXPORT_FILE_PREFIX)) return;

        const worksheet = workbook.Sheets[EXPORT_SHEET_NAME];
        if (!worksheet?.["!ref"] || !window.XLSX?.utils) return;

        const range = window.XLSX.utils.decode_range(worksheet["!ref"]);

        // A linha 0 contém os cabeçalhos. A coluna 3 corresponde a "Link".
        for (let row = 1; row <= range.e.r; row += 1) {
            const address = window.XLSX.utils.encode_cell({ r: row, c: LINK_COLUMN_INDEX });
            const cell = worksheet[address];
            const target = String(cell?.v || "").trim();

            if (!cell || !/^https?:\/\//i.test(target)) continue;

            cell.l = {
                Target: target,
                Tooltip: "Abrir localização no GiRED"
            };
        }
    }

    /**
     * Interceta apenas a escrita do workbook do Excel Mapper, mantendo intactas
     * as restantes exportações XLSX existentes no GiRED.
     */
    function ensureXlsxPatch() {
        const xlsx = window.XLSX;
        if (!xlsx?.writeFile || xlsx[PATCH_FLAG]) return Boolean(xlsx?.[PATCH_FLAG]);

        const originalWriteFile = xlsx.writeFile.bind(xlsx);

        xlsx.writeFile = function patchedWriteFile(workbook, fileName, options) {
            addWorksheetHyperlinks(workbook, fileName);
            return originalWriteFile(workbook, fileName, options);
        };

        Object.defineProperty(xlsx, PATCH_FLAG, {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false
        });

        return true;
    }

    // Tenta aplicar imediatamente caso o SheetJS já esteja disponível.
    ensureXlsxPatch();

    // Garante a aplicação antes do handler do botão do Excel Mapper executar.
    document.addEventListener("click", event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest("#gired-vc-export-mapper")) return;
        ensureXlsxPatch();
    }, true);
})();
