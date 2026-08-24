(() => {
    "use strict";

    const SIDEBAR_SELECTOR = "#course-vc-sidebar";
    const STATS_BADGE_SELECTOR = "#vc-comment-stats .course-vc-status-badge";
    const COUNTER_CLASS = "gired-structure-mapper-cd-counter";
    const BLOCKING_PATTERN = /problema\(?s?\)?\s+bloqueante/i;

    let updateScheduled = false;

    /** Indica se a extensão está atualmente ativa na página. */
    function isExtensionEnabled() {
        return !document.documentElement.classList.contains("gired-structure-mapper-disabled");
    }

    /** Extrai o último número presente num texto (ex.: "Aberto: 24" -> 24). */
    function parseCount(text) {
        const match = String(text || "").match(/(\d[\d\s.]*)\s*$/);
        if (!match) return null;
        return Number(match[1].replace(/[\s.]/g, ""));
    }

    /** Encontra o elemento mais interior do painel cujo texto é o contador nativo de bloqueantes. */
    function findNativeBlockingCounter(sidebar) {
        const candidates = Array.from(sidebar.querySelectorAll("div, span, p, button"))
            .filter(el => !el.closest(`.${COUNTER_CLASS}`) && BLOCKING_PATTERN.test(el.textContent || ""));
        return candidates.find(el =>
            !candidates.some(other => other !== el && el.contains(other))
        ) || null;
    }

    /** Obtém o total de erros em aberto a partir das estatísticas nativas. */
    function getOpenTotal() {
        const badge = Array.from(document.querySelectorAll(STATS_BADGE_SELECTOR))
            .find(el => /aberto/i.test(el.textContent || "") && !/n[aã]o\s+corrigir|resolvid/i.test(el.textContent || ""));
        return badge ? parseCount(badge.textContent) : null;
    }

    /** Cria ou atualiza o contador de problemas C/D em aberto, por baixo do nativo. */
    function updateCounter() {
        updateScheduled = false;
        if (!isExtensionEnabled()) return;

        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return;

        const native = findNativeBlockingCounter(sidebar);
        const existing = sidebar.querySelector(`.${COUNTER_CLASS}`);

        if (!native) {
            existing?.remove();
            return;
        }

        const blocking = parseCount((native.textContent || "").match(/\d[\d\s.]*(?=\s*problema)/i)?.[0] ?? native.textContent);
        const openTotal = getOpenTotal();
        if (blocking === null || openTotal === null) {
            existing?.remove();
            return;
        }

        const openCd = Math.max(0, openTotal - blocking);

        let counter = existing;
        if (!counter) {
            counter = document.createElement("div");
            counter.className = COUNTER_CLASS;
            counter.setAttribute("role", "status");

            const icon = document.createElement("span");
            icon.className = `${COUNTER_CLASS}-icon`;
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = "!";

            const label = document.createElement("span");
            label.className = `${COUNTER_CLASS}-label`;

            counter.append(icon, label);
        }

        const text = `${openCd} problema(s) em aberto (Sev C/D)`;
        const label = counter.querySelector(`.${COUNTER_CLASS}-label`);
        if (label.textContent !== text) label.textContent = text;
        counter.classList.toggle("is-clear", openCd === 0);

        // O GiRED pode recriar o contador nativo; garantimos que ficamos sempre imediatamente a seguir.
        if (counter.previousElementSibling !== native || counter.parentElement !== native.parentElement) {
            native.after(counter);
        }
    }

    /** Agenda uma única atualização por frame. */
    function scheduleUpdate() {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(updateCounter);
    }

    /** O painel é montado e atualizado dinamicamente; reagimos a qualquer alteração. */
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(m =>
                !(m.target instanceof Element) || !m.target.closest(`.${COUNTER_CLASS}`));
            if (relevant) scheduleUpdate();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }

    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes.giredStructureMapperEnabled) return;
            if (changes.giredStructureMapperEnabled.newValue === false) {
                document.querySelector(`.${COUNTER_CLASS}`)?.remove();
            } else {
                scheduleUpdate();
            }
        });
    }

    scheduleUpdate();
    startObserver();
})();
