// src/components/rotunda.js

export class Rotunda {

    static async render() {

        const container = document.getElementById("rotunda-container");

        container.innerHTML = `

            <section class="rotunda">

                <div class="rotunda-track">

                    <article class="rotunda-card">

                        <img
                            src="https://placehold.co/300x420"
                            alt="Akira">

                        <h2>Akira</h2>

                    </article>

                    <article class="rotunda-card">

                        <img
                            src="https://placehold.co/300x420"
                            alt="Ghost">

                        <h2>Ghost in the Shell</h2>

                    </article>

                    <article class="rotunda-card">

                        <img
                            src="https://placehold.co/300x420"
                            alt="Berserk">

                        <h2>Berserk</h2>

                    </article>

                </div>

            </section>

        `;

    }

}
