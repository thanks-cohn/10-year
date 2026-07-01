// src/components/search.js

const SEARCH_INDEX_URL = "/data/search.index.json";
const MAX_RESULTS = 12;

let searchIndex = null;

async function loadSearchIndex() {
    if (searchIndex) {
        return searchIndex;
    }

    const response = await fetch(SEARCH_INDEX_URL, { cache: "force-cache" });

    if (!response.ok) {
        throw new Error(`Unable to load ${SEARCH_INDEX_URL}`);
    }

    searchIndex = await response.json();
    return searchIndex;
}

const ALIASES = new Map([
    ["vol", "volume"],
    ["v", "volume"],
    ["ch", "chapter"],
    ["chap", "chapter"],
    ["pt", "part"],
]);

const COMMON_TYPOS = new Map([
    ["vilume", "volume"],
    ["voluem", "volume"],
    ["xhapter", "chapter"],
    ["chaper", "chapter"],
    ["chaptr", "chapter"],
]);

function normalize(value) {
    return String(value ?? "")
        .toLowerCase()
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replaceAll("/", " ")
        .replace(/([a-z])(\d)/g, "$1 $2")
        .replace(/(\d)([a-z])/g, "$1 $2")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function canonicalToken(token) {
    const typoFixed = COMMON_TYPOS.get(token) ?? token;
    return ALIASES.get(typoFixed) ?? typoFixed;
}

function queryTokens(query) {
    return normalize(query)
        .split(" ")
        .map(canonicalToken)
        .filter(Boolean);
}

function compactQuery(query) {
    return queryTokens(query).join("");
}

function uniqueIds(ids) {
    return [...new Set(ids)];
}

function intersect(left, right) {
    const rightSet = new Set(right);
    return left.filter(id => rightSet.has(id));
}

function idsForToken(index, token) {
    const exact = index.tokens[token];

    if (exact) {
        return exact;
    }

    const matches = [];

    for (const [indexToken, ids] of Object.entries(index.tokens)) {
        if (indexToken.startsWith(token) || indexToken.includes(token) || token.includes(indexToken)) {
            matches.push(...ids);
        }
    }

    return uniqueIds(matches);
}

function candidateIds(index, tokens) {
    if (tokens.length === 0) {
        return [];
    }

    const idLists = tokens
        .map(token => idsForToken(index, token))
        .filter(ids => ids.length > 0);

    if (idLists.length === 0) {
        return [];
    }

    let strict = idLists[0];

    for (const ids of idLists.slice(1)) {
        strict = intersect(strict, ids);
    }

    if (strict.length > 0) {
        return strict;
    }

    return uniqueIds(idLists.flat());
}

function scoreEntry(entry, tokens, compact) {
    let score = 0;
    const entryTokens = new Set(entry.tokens ?? []);
    const normalized = entry.normalized ?? "";
    const entryCompact = entry.compact ?? "";

    if (entryCompact === compact) {
        score += 1000;
    } else if (entryCompact.includes(compact)) {
        score += 300;
    }

    for (const token of tokens) {
        if (entryTokens.has(token)) {
            score += 80;
        } else if (normalized.includes(token)) {
            score += 30;
        } else if (entryCompact.includes(token)) {
            score += 15;
        }
    }

    if (entry.type === "work") {
        score += 20;
    }

    score -= Math.min(normalized.length / 100, 20);

    return score;
}

function search(index, query) {
    const tokens = queryTokens(query);
    const compact = compactQuery(query);

    if (tokens.length === 0) {
        return [];
    }

    return candidateIds(index, tokens)
        .map(id => index.entries[id])
        .filter(Boolean)
        .map(entry => ({ entry, score: scoreEntry(entry, tokens, compact) }))
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(result => result.entry);
}

function clear(element) {
    element.replaceChildren();
}

function resultSubtitle(entry) {
    if (entry.type === "work") {
        return "Work — opens first chapter";
    }

    return entry.chapter ?? "Chapter";
}

export class Search {

    static async start() {
        const index = await loadSearchIndex();

        const container = document.querySelector(".landing-search");

        if (!container) {
            return;
        }

        clear(container);

        const wrapper = document.createElement("section");
        wrapper.className = "search";

        const input = document.createElement("input");
        input.id = "landing-search-input";
        input.type = "search";
        input.placeholder = "Search works or chapters...";
        input.autocomplete = "off";

        const results = document.createElement("div");
        results.id = "search-results";
        results.className = "search-results";
        results.hidden = true;

        wrapper.append(input, results);
        container.append(wrapper);

        input.addEventListener("input", () => {
            this.#renderResults(searchIndex, input.value, results);
        });

        input.addEventListener("keydown", event => {
            if (event.key !== "Enter") {
                return;
            }

            const firstLink = results.querySelector("a");

            if (firstLink) {
                firstLink.click();
            }
        });
    }

    static #renderResults(index, query, results) {
        clear(results);

        const matches = search(index, query);

        if (matches.length === 0) {
            results.hidden = true;
            return;
        }

        results.hidden = false;

        for (const entry of matches) {
            const link = document.createElement("a");
            link.className = "search-result";
            link.href = entry.reader_url;

            const title = document.createElement("strong");
            title.textContent = entry.display;

            const subtitle = document.createElement("span");
            subtitle.textContent = resultSubtitle(entry);

            link.append(title, subtitle);
            results.append(link);
        }
    }
}
