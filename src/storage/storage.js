/*
------------------------------------------------------------------------------
storage.js

Purpose

    Storage is the single source of truth for where website assets live.

Responsibilities

    • Know the active storage origin.
    • Construct URLs for website assets.
    • Never perform fetch requests.
    • Never parse JSON.
    • Never contain business logic.

Everything that needs a URL should ask Storage.

Examples

    Storage.work("Akira");
    Storage.chapter("Akira", "chapter_1");
    Storage.image("Akira", "chapter_1", "001.webp");

This keeps Cloudflare, R2, localhost, and future providers isolated to one file.

------------------------------------------------------------------------------
*/

// src/storage/storage.js

import storage from "../data/storage.json";

export class Storage {

    static active() {

        return storage.active;

    }

    static profile() {

        return storage[this.active()];

    }

    static source(id) {

        const root = this.profile().sources[id];

        if (!root) {
            throw new Error(`Unknown storage source "${id}"`);
        }

        return root;

    }

    static work(source, slug) {

        return `${this.source(source)}/${encodeURIComponent(slug)}`;

    }

    static chapter(source, slug, chapter) {

        return `${this.work(source, slug)}/${chapter}`;

    }

    static manifest(source, slug, chapter) {

        return `${this.chapter(source, slug, chapter)}/item.json`;

    }

}
