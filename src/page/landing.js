// src/page/landing.js

import { Rotunda } from "../components/rotunda.js";
import { Search } from "../components/search.js";
import { Blocks } from "../blocks/blocks.js";

export class Landing {

    static async start() {

        const container =
            document.getElementById("reader-container");

        if (!container) {
            throw new Error("Missing #reader-container");
        }

        container.innerHTML = `

            <section id="landing-page">

                <section id="landing-hero">

                    <header id="hero-header">

                        <span id="hero-featured">
                            Featured
                        </span>

                        <h1 id="hero-title">

                        </h1>

                        <p id="hero-subtitle">

                        </p>

                    </header>

                    <section id="rotunda-container">

                    </section>

                    <section id="search-container">

                    </section>

                </section>

                <section id="landing-blocks">

                </section>

            </section>

        `;

        await Rotunda.render();

        await Search.render();

        await Blocks.render();

    }

}
