// src/page/landing.js

export class Landing {

    static async start() {

        document.body.innerHTML = `
        <div class="landing">

        <header class="landing-header">

        <h1>MON Website</h1>

        <p class="landing-tagline">
        Read what the world forgot.
        </p>

        </header>

        <section class="landing-rotunda">

        <div id="rotunda">

        Rotunda

        </div>

        </section>

        <section class="landing-search">

        <div id="search">

        Search

        </div>

        </section>

        <section class="landing-layout">

        <aside class="landing-sidebar left">

        <div class="sidebar-card">

        Left Banner

        </div>

        </aside>

        <main class="landing-main">

        <div id="blocks">

        Landing Blocks

        </div>

        </main>

        <aside class="landing-sidebar right">

        <div class="sidebar-card">

        Right Banner

        </div>

        </aside>

        </section>

        </div>
        `;

    }

}
