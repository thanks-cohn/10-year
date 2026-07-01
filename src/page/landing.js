import { Rotunda } from "../components/rotunda.js";
import { Search } from "../components/search.js";

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

        container.innerHTML = `
        <div class="app-root">

            <header class="search-layer">
                <div class="landing-search"></div>
            </header>

            <section class="rotunda-layer">
                <div class="landing-rotunda"></div>
            </section>

            <div class="app-shell">

                <aside class="col left">
                    <div class="panel">
                        <h3>Library</h3>
                    </div>
                </aside>

                <!-- ✅ CENTER COLUMN FIX -->
                <main class="col center">
                    <div class="landing-shell">
                        <div id="blocks-root"></div>
                    </div>
                </main>

                <aside class="col right">
                    <div class="panel">
                        <h3>Info</h3>
                    </div>
                </aside>

            </div>
        </div>
        `;

        // safe init
        await safeStart("search", Search.start);
        await safeStart("rotunda", Rotunda.start);
    }
}
