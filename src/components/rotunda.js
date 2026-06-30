import { Storage } from "../storage/storage.js";

const ROTUNDA_FILE = "/src/data/rotunda.json";
const STORAGE_FILE = "/src/data/storage.json";

export class Rotunda {

    static async start() {

        const container = document.querySelector(".landing-rotunda");

        if (!container) {
            return;
        }

        const [storage, rotunda] = await Promise.all([

            fetch(STORAGE_FILE, {
                cache: "no-store"
            }).then(r => r.json()),

                                                     fetch(ROTUNDA_FILE, {
                                                         cache: "no-store"
                                                     }).then(r => r.json())

        ]);

        const environment = storage.active;
        const sources = storage[environment].sources;

        const works = rotunda.works.slice(0, 3);

        const cards = [];

        for (const work of works) {

            //--------------------------------------------------
            // item.json
            //--------------------------------------------------

            const manifestUrl = Storage.manifest(

                work.source,
                work.slug,
                work.chapters[0]

            );

            const manifest = await fetch(manifestUrl, {

                cache: "no-store"

            }).then(r => r.json());

            //--------------------------------------------------
            // Build first image.
            //--------------------------------------------------

            const filename =
            `${String(1).padStart(
                manifest.padding,
                "0"
            )}.${manifest.extension}`;

            const image =
            `${manifest.base_url}/${filename}`;

            cards.push({

                title: work.display,

                image

            });

        }

        container.innerHTML = `

        <div class="rotunda-track">

        ${cards.map(card => `

            <div class="rotunda-card">

            <img
            class="rotunda-cover"
            src="${card.image}"
            alt="${card.title}"
            >

            <div class="rotunda-title">

            ${card.title}

            </div>

            </div>

            `).join("")}

            </div>

            `;

    }

}
