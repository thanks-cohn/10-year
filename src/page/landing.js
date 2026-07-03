import { Rotunda } from "../components/rotunda.js";
import { Search } from "../components/search.js";
import { Blocks } from "../components/blocks.js";

async function safeStart(name, fn) {
    try {
        await fn();
    } catch (e) {
        console.warn(`${name} failed`, e);
    }
}

export class Landing {
    static async start() {
        const container = document.getElementById("reader-container");
        if (!container) return;

        document.body.classList.remove("reader-active");

        container.innerHTML = `
        <div class="app-root">
            <header class="search-layer">
                <div class="landing-search"></div>
            </header>

            <section class="rotunda-layer">
                <div class="landing-rotunda"></div>
            </section>

            <section id="blocks-root"></section>
        </div>
        `;

        await safeStart("search", Search.start);
        await safeStart("rotunda", Rotunda.start);
        await safeStart("blocks", Blocks.start);
    }
}
