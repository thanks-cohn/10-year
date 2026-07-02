import { Storage } from "./storage.js";

export function resolveManifest(manifest, source, slug, chapter) {
    if (!manifest) {
        throw new Error("resolveManifest(): manifest is null.");
    }

    return {
        ...manifest,
        base_url: Storage.chapter(source, slug, chapter)
    };
}
