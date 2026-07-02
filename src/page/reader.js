import { Storage } from "../storage/storage.js";
import { resolveManifest } from "../storage/manifest_resolver.js";

async function renderManifestInto(root, manifestUrl, source, work, chapter) {
    if (!root || !manifestUrl) {
        console.warn("Reader: missing root or manifestUrl.");
        return;
    }

    let manifest = await fetch(manifestUrl).then(r => {
        if (!r.ok) {
            throw new Error(`Manifest failed: ${r.status}`);
        }
        return r.json();
    });

    manifest = resolveManifest(manifest, source, work, chapter);

    const wrapper = document.createElement("div");
    wrapper.className = "reader-pages";

    const anchor = document.createElement("div");
    anchor.id = "chapter-start";
    wrapper.appendChild(anchor);

    for (let i = 1; i <= manifest.pages; i++) {
        const img = document.createElement("img");

        img.className = "reader-page";
        img.loading = "lazy";
        img.decoding = "async";

        img.src =
            `${manifest.base_url}/` +
            `${String(i).padStart(manifest.padding, "0")}.${manifest.extension}`;

        wrapper.appendChild(img);
    }

    root.replaceChildren(wrapper);

    setTimeout(() => {
        anchor.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }, 50);
}

export class Reader {
    static async start(work, chapter) {
        const container = document.getElementById("reader-container");

        if (!container) return;

        const source =
            new URLSearchParams(window.location.search).get("source") || "e";

        const manifestUrl = Storage.manifest(source, work, chapter);

        try {
            await renderManifestInto(container, manifestUrl, source, work, chapter);
        } catch (err) {
            console.error("Reader failed:", err);

            container.innerHTML = `
                <div class="reader-error">
                    <h2>Failed to load chapter</h2>
                </div>
            `;
        }
    }
}

window.addEventListener("open-reader", async (e) => {
    const entry = e.detail;
    const root = document.getElementById("blocks-root");

    if (!root) {
        console.warn("Reader: blocks-root missing. Refusing to wipe page.");
        return;
    }

    const source = entry.source || "e";
    const work = entry.work || entry.slug || entry.work_slug;
    const chapter = entry.chapter || entry.chapter_path;

    const manifestUrl =
        entry.manifest_url || Storage.manifest(source, work, chapter);

    try {
        await renderManifestInto(root, manifestUrl, source, work, chapter);
    } catch (err) {
        console.error("Reader failed:", err);

        root.innerHTML = `
            <div class="reader-error">
                <h2>Failed to load chapter</h2>
            </div>
        `;
    }
});
