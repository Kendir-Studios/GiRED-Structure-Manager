(() => {
    "use strict";

    const ITEM_CLASS = "gired-problem-convert";
    const WRAPPER_SELECTOR = "li.studio-xblock-wrapper";

    let scheduled = false;

    /** Lê um cookie pelo nome (necessário para o CSRF do Studio). */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[1]) : "";
    }

    /** Chamada JSON à API do Studio com credenciais e CSRF. */
    async function studioJson(url, method, body) {
        const headers = { Accept: "application/json" };
        if (method !== "GET") {
            headers["Content-Type"] = "application/json; charset=utf-8";
            headers["X-CSRFToken"] = getCookie("csrftoken");
        }
        const response = await fetch(url, {
            method,
            credentials: "same-origin",
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} em ${method} ${url}`);
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }

    /** Texto de uma escolha CAPA sem os choicehints embutidos. */
    function choiceText(choice) {
        const clone = choice.cloneNode(true);
        clone.querySelectorAll("choicehint").forEach(el => el.remove());
        return clone.textContent.replace(/\s+/g, " ").trim();
    }

    /** Feedback de uma escolha: para checkboxes só interessa o hint de "selected". */
    function choiceHint(choice, isCheckbox) {
        const hints = Array.from(choice.querySelectorAll("choicehint"));
        const hint = isCheckbox
            ? hints.find(h => (h.getAttribute("selected") || "").toLowerCase() === "true")
            : hints.find(h => !h.getAttribute("selected")) || hints[0];
        return (hint?.textContent || "").replace(/\s+/g, " ").trim();
    }

    /** Troca caracteres tipográficos por equivalentes simples: “ ” ' « » -> ", … -> ..., — -> -. */
    function correctChars(str) {
        const chars = { "'": "\"", "“": "\"", "”": "\"", "…": "...", "»": "\"", "«": "\"", "—": "-" };
        return str.replace(/[“”—…'«»]/g, (m) => chars[m]);
    }

    /** Aplica correctChars a todos os valores de texto do conteúdo da dinâmica. */
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

    /**
     * Mantém a divisão do problema original: o bloco `.ea-stem` (introdução/contexto)
     * vai para `introductory_statement` e o `label` (a pergunta) para `information_and_question`.
     */
    function splitStatement(doc) {
        const clean = text => (text || "").replace(/\s+/g, " ").trim();
        const intro = clean(doc.querySelector('[class~="ea-stem"]')?.textContent);
        let question = clean(doc.querySelector("problem label, label")?.textContent);
        if (!question) {
            const paragraph = Array.from(doc.querySelectorAll("problem p, p"))
                .find(el => !el.closest('[class~="ea-stem"]') && !el.closest("choice"));
            question = clean(paragraph?.textContent);
        }
        if (!question) return { intro: "", question: intro };
        return { intro, question };
    }

    /** Nome normalizado de uma escolha para detetar Verdadeiro/Falso. */
    function normalizedChoice(text) {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    /** Radio com exatamente duas escolhas Verdadeiro/Falso -> sage_trueorfalse. */
    function buildTrueOrFalse(choices, statement) {
        if (choices.length !== 2) return null;
        const names = choices.map(choice => normalizedChoice(choiceText(choice)));
        const trueIndex = names.findIndex(name => name === "verdadeiro" || name === "true" || name === "v");
        const falseIndex = names.findIndex(name => name === "falso" || name === "false" || name === "f");
        if (trueIndex === -1 || falseIndex === -1) return null;

        const isCorrect = choice => (choice.getAttribute("correct") || "").toLowerCase() === "true";
        const correctChoice = choices.find(isCorrect);
        const wrongChoice = choices.find(choice => !isCorrect(choice));
        if (!correctChoice) return null;

        return {
            category: "sage_trueorfalse",
            content: {
                correct_answer: choices.indexOf(correctChoice) === trueIndex,
                wrong_description: wrongChoice ? choiceHint(wrongChoice, false) : "",
                correct_description: choiceHint(correctChoice, false),
                introductory_statement: statement.intro,
                information_and_question: statement.question,
                _asset_type: "true_or_false"
            }
        };
    }

    /** stringresponse (resposta escrita) -> sage_fillintheblanks. */
    function buildFillInTheBlanks(doc, statement) {
        const responses = Array.from(doc.querySelectorAll("stringresponse"));
        if (!responses.length) return null;

        const clean = text => (text || "").replace(/\s+/g, " ").trim();
        const blanks = responses.map(response => {
            const alternatives = Array.from(response.querySelectorAll("additional_answer"))
                .map(alt => (alt.getAttribute("answer") || "").trim())
                .filter(Boolean);
            const wrongHints = Array.from(response.querySelectorAll("stringequalhint"))
                .map(hint => clean(hint.textContent))
                .filter(Boolean);
            return {
                correct_answer: (response.getAttribute("answer") || "").trim(),
                accepted_alternatives: alternatives,
                correct_feedback: clean(response.querySelector("correcthint")?.textContent),
                incorrect_feedback: wrongHints.join(" ")
            };
        });

        // Reconstrói o texto do enunciado com "___" no lugar de cada resposta;
        // a introdução (.ea-stem) e a pergunta (label) saem porque já vão nos campos próprios.
        const body = (doc.querySelector("problem") || doc.body).cloneNode(true);
        body.querySelectorAll('label, description, demandhint, script, style, solution, [class~="ea-stem"]')
            .forEach(el => el.remove());
        body.querySelectorAll("stringresponse").forEach(el => el.replaceWith(el.ownerDocument.createTextNode(" ___ ")));
        const textWithBlanks = body.textContent.replace(/\s+/g, " ").trim();

        return {
            category: "sage_fillintheblanks",
            content: {
                audio_version: false,
                blanks,
                text_with_blanks: textWithBlanks,
                wrong_description: "",
                correct_description: "",
                introductory_statement: statement.intro,
                information_and_question: statement.question,
                _asset_type: "fill_in_the_blanks"
            }
        };
    }

    /**
     * Converte o XML CAPA numa dinâmica SAGE.
     * Radio V/F -> True or False; radio -> Single Choice (Unified);
     * checkbox -> Multiple Selection (Unified); stringresponse -> Fill in the Blanks.
     */
    function buildConversion(xml) {
        const doc = new DOMParser().parseFromString(xml, "text/html");

        const statement = splitStatement(doc);

        const checkboxGroup = doc.querySelector("choiceresponse checkboxgroup");
        const radioGroup = doc.querySelector("multiplechoiceresponse choicegroup");
        const group = checkboxGroup || radioGroup;
        if (!group) return buildFillInTheBlanks(doc, statement);
        const isCheckbox = Boolean(checkboxGroup);

        const choices = Array.from(group.querySelectorAll("choice"));
        if (!choices.length) return null;

        if (!isCheckbox) {
            const trueOrFalse = buildTrueOrFalse(choices, statement);
            if (trueOrFalse) return trueOrFalse;
        }

        const answers = choices.map(choice => {
            const correct = (choice.getAttribute("correct") || "").toLowerCase() === "true";
            const hint = choiceHint(choice, isCheckbox);
            const answer = {
                answer_text: choiceText(choice),
                correct_description: correct ? hint : "",
                incorrect_description: correct ? "" : hint
            };
            if (isCheckbox) answer.is_correct = correct;
            return answer;
        });

        const shuffle = (group.getAttribute("shuffle") || "true").toLowerCase() === "true";

        if (isCheckbox) {
            return {
                category: "sage_multipleselectionunified",
                content: {
                    audio_version: false,
                    questions: [{
                        information_and_question: statement.question,
                        answer_modality: "text",
                        incomplete_description: "",
                        answers
                    }],
                    image_caption: "",
                    randomize_answers: shuffle,
                    reflective_mode: false,
                    introductory_statement: statement.intro,
                    _asset_type: "multiple_selection_unified"
                }
            };
        }

        const correctIndex = choices.findIndex(choice => (choice.getAttribute("correct") || "").toLowerCase() === "true");
        return {
            category: "sage_singlechoiceunified",
            content: {
                audio_version: false,
                questions: [{
                    information_and_question: statement.question,
                    answer_modality: "text",
                    answers,
                    correct_answer_index: Math.max(0, correctIndex)
                }],
                image_caption: "",
                randomize_answers: shuffle,
                reflective_mode: false,
                introductory_statement: statement.intro,
                _asset_type: "single_choice_unified"
            }
        };
    }

    /** Converte o problema e coloca a nova dinâmica imediatamente abaixo. */
    async function convertProblem(wrapper) {
        const locator = wrapper.dataset.locator;
        const parent = document.querySelector(".wrapper-xblock.level-page")?.dataset.locator;
        if (!locator || !parent) {
            window.alert("Não foi possível identificar o componente ou a unidade.");
            return;
        }

        try {
            const source = await studioJson(`/xblock/${locator}`, "GET");
            const conversion = buildConversion(source.data || "");
            if (!conversion) {
                window.alert("Este problema não tem um formato suportado para conversão (escolha simples/múltipla, V/F ou resposta escrita).");
                return;
            }

            const created = await studioJson("/xblock/", "POST", {
                parent_locator: parent,
                category: conversion.category
            });
            if (!created.locator) throw new Error("o Studio não devolveu o novo componente");

            await studioJson(`/xblock/${created.locator}/handler/studio_submit`, "POST", {
                display_name: source.metadata?.display_name || source.display_name || "Dinâmica convertida",
                content: JSON.stringify(correctCharsDeep(conversion.content))
            });

            const children = Array.from(document.querySelectorAll(`${WRAPPER_SELECTOR}[data-locator]`))
                .map(item => item.dataset.locator)
                .filter(item => item && item !== created.locator);
            children.splice(children.indexOf(locator) + 1, 0, created.locator);
            await studioJson(`/xblock/${parent}`, "PUT", { children });

            location.reload();
        } catch (error) {
            window.alert(`Conversão falhou: ${error.message}`);
        }
    }

    /** Acrescenta "Converter em dinâmica" ao menu de ações dos problemas CAPA. */
    function ensureMenuItems() {
        scheduled = false;
        if (location.hostname !== "cms.gired.pt") return;

        document.querySelectorAll(WRAPPER_SELECTOR).forEach(wrapper => {
            if (!wrapper.querySelector(".problems-wrapper")) return;

            const menu = wrapper.querySelector(".xblock-header-primary .action-actions-menu .nav-sub ul");
            if (!menu || menu.querySelector(`.${ITEM_CLASS}`)) return;

            const item = document.createElement("li");
            item.className = "nav-item";

            const link = document.createElement("a");
            link.className = ITEM_CLASS;
            link.href = "#";
            link.setAttribute("role", "button");
            link.textContent = "Converter em dinâmica";
            link.title = "Cria uma dinâmica Unified com este conteúdo, logo abaixo deste problema";
            link.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                wrapper.querySelector(".action-actions-menu .wrapper-nav-sub")?.classList.remove("is-shown");
                void convertProblem(wrapper);
            });

            item.appendChild(link);

            const deleteItem = menu.querySelector(".delete-button")?.closest("li");
            if (deleteItem) menu.insertBefore(item, deleteItem);
            else menu.appendChild(item);
        });
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
                !(mutation.target instanceof Element) || !mutation.target.closest(`.${ITEM_CLASS}`));
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
