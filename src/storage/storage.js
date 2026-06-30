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

import fetchConfig from "../data/fetch.json";

const Storage = {

    origin() {
        return fetchConfig.origin;
    },

    works() {
        return `${this.origin()}/works`;
    },

    work(work) {
        return `${this.works()}/${work}`;
    },

    chapter(work, chapter) {
        return `${this.work(work)}/${chapter}`;
    },

    chapterJSON(work, chapter) {
        return `${this.chapter(work, chapter)}/item.json`;
    },

    image(work, chapter, image) {
        return `${this.chapter(work, chapter)}/${image}`;
    },

    thumbnail(work, image) {
        return `${this.work(work)}/thumbnails/${image}`;
    }

};

export default Storage;
