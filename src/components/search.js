// src/components/search.js

export class Search {

    static async render() {

        const container =
            document.getElementById("search-container");

        container.innerHTML = `

            <section class="search">

                <input
                    id="landing-search-input"
                    type="search"
                    placeholder="Search works or chapters...">

                <div id="search-results">

                </div>

            </section>

        `;

    }

}
