import { Rotunda } from "../components/rotunda.js";
import { Search } from "../components/search.js";

async function safeStart(name, start) {
    try {
        await start();
        console.log(`${name} loaded.`);
    } catch (error) {
        console.warn(`${name} failed, continuing.`, error);
    }
}

export class Landing {
    static async start() {
        const container = document.getElementById("reader-container");

        if (!container) {
            return;
        }

        container.innerHTML = `
            <main class="landing">
                <section class="landing-hero">
                    <h1>AnimePlex</h1>
                    <p>Search and read from the archive.</p>

                    <div class="landing-search"></div>
                </section>

                <section class="landing-columns">
                    <article>
                        <h2>Read</h2>
                        <p>Find chapters quickly from the local browser index.</p>
                    </article>

                    <article>
                        <h2>Browse</h2>
                        <p>Explore featured works from the rotunda.</p>
                    </article>

                    <article>
                        <h2>Archive</h2>
                        <p>Static data, fast links, and portable storage roots.</p>
                    </article>
                </section>

                <section class="landing-rotunda" aria-label="Featured works"></section>
            </main>
        `;

        await Promise.allSettled([
            safeStart("Search", () => Search.start()),
            safeStart("Rotunda", () => Rotunda.start())
        ]);
    }
}
