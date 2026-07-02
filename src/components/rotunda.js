import { Storage } from "../storage/storage.js";
import { resolveManifest } from "../storage/manifest_resolver.js";
import rotunda from "../data/rotunda.json";
import storage from "../data/storage.json";
import "../styles/rotunda.css";

export class Rotunda {
    static async start() {
        const container = document.querySelector(".landing-rotunda");

        if (!container) {
            return;
        }

        const environment = storage.active;
        const sources = storage[environment]?.sources ?? {};
        const works = rotunda.works ?? [];
        const cards = [];

        for (const work of works) {
            try {
                if (!work.chapters?.length) {
                    console.warn(`Rotunda: skipping "${work.slug}" (no chapters).`);
                    continue;
                }

                if (!sources[work.source]) {
                    console.warn(`Rotunda: skipping "${work.slug}" (unknown source).`);
                    continue;
                }

                const manifestUrl = Storage.manifest(
                    work.source,
                    work.slug,
                    work.chapters[0]
                );

                const response = await fetch(manifestUrl, { cache: "no-store" });

                if (!response.ok) {
                    console.warn(`Rotunda: skipping "${work.slug}" (${response.status}).`);
                    continue;
                }

                let manifest = await response.json();
        manifest = resolveManifest(
            manifest,
            work.source,
            work.slug,
            work.chapters[0]
        );

                const filename =
                    `${String(1).padStart(manifest.padding, "0")}.${manifest.extension}`;

                cards.push({
                    title: work.display,
                    image: `${manifest.base_url}/${filename}`
                });
            } catch (error) {
                console.warn(`Rotunda: failed to load "${work.slug}".`, error);
            }
        }

        console.log(`Rotunda loaded ${cards.length} works.`);

        container.innerHTML = `
            <div class="rotunda-track">
                ${cards.map(card => `
                    <div class="rotunda-card">
                        <img
                            class="rotunda-cover"
                            src="${card.image}"
                            alt="${card.title}"
                        >
                        <div class="rotunda-title">${card.title}</div>
                    </div>
                `).join("")}
            </div>
        `;
    }
}
