import { continueWithGoogle, ensureAnonymousSession, getSupabase, session } from "./discussion/supabase.js";
import { loadWork } from "./storage/work_manifest.js";
import fetchData from "./data/fetch.json";
import { Storage } from "./storage/storage.js";
import { knownTagsFromCatalog, loadTagPreferences, removeTagPreference, restoreDefaultTagPreferences, saveTagPreference, subscribeTagPreferences, tagsForWork } from "./preferences.js";
import { toggleBookmark } from "./discussion/service.js";

const PAGE_SIZE = 48;

function accountIdentity(user) {
    if (!user) return "Signed out";
    if (user.is_anonymous) return "Anonymous account";
    return user.user_metadata?.full_name || user.user_metadata?.name || "Linked account";
}

function frame(title, body = "") {
    return `<div class="account-shell"><header class="account-header"><a class="landing-brand" href="/">Doku-Doujin</a><nav><a href="/?account=profile">Account</a><a href="/?account=bookmarks">Bookmarks</a><a href="/?account=settings">Settings</a></nav></header><main class="account-card"><h1>${title}</h1>${body}</main></div>`;
}

async function authControls(root, user) {
    const actions = document.createElement("div");
    actions.className = "account-actions";
    if (!user) actions.innerHTML = `<button data-auth="anon">Start private account</button><button data-auth="google">Continue with Google</button>`;
    else if (user.is_anonymous) actions.innerHTML = `<button data-auth="google">Link Google without losing data</button><button data-auth="signout">Sign out</button>`;
    else actions.innerHTML = `<button data-auth="signout">Sign out</button>`;
    actions.addEventListener("click", async event => {
        const action = event.target?.dataset?.auth;
        if (!action) return;
        event.target.disabled = true;
        try {
            if (action === "anon") await ensureAnonymousSession();
            if (action === "google") await continueWithGoogle();
            if (action === "signout") await (await getSupabase())?.auth.signOut();
            window.location.reload();
        } catch (error) { event.target.disabled = false; alert(error.message || "Authentication failed."); }
    });
    root.append(actions);
}

async function bookmarkRows() {
    const db = await getSupabase();
    if (!db) return [];
    const { data, error } = await db.from("bookmarks").select("work_id,created_at").order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (error) throw error;
    return data || [];
}

async function renderBookmarks(root) {
    const status = document.createElement("p");
    status.className = "account-status";
    status.textContent = "Loading bookmarks…";
    const list = document.createElement("div");
    list.className = "bookmark-grid";
    root.append(status, list);
    try {
        const rows = await bookmarkRows();
        if (!rows.length) { status.textContent = "No bookmarks yet."; return; }
        status.textContent = `Showing ${rows.length} recent bookmarks.`;
        const worksBySlug = new Map((fetchData.works || []).map(work => [work.slug, work]));
        const cards = await Promise.all(rows.map(async row => {
            const base = worksBySlug.get(row.work_id);
            const work = await loadWork(row.work_id).catch(() => base) || base || { slug: row.work_id, display: row.work_id, missing: true };
            const chapter = work.chapters?.[0];
            const source = work.source || fetchData.default?.source || "e";
            const thumb = work.thumb || `${Storage.work(source, work.slug)}/thumb.webp`;
            const el = document.createElement("article");
            el.className = "bookmark-card";
            el.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${thumb}"><h2>${work.display || work.slug}</h2><p>${tagsForWork(work).join(", ") || (work.missing ? "Work metadata unavailable" : "Saved work")}</p><div><a href="/?source=${encodeURIComponent(source)}&work=${encodeURIComponent(work.slug)}&chapter=${encodeURIComponent(chapter || "")}">Open</a><button type="button">Remove</button></div>`;
            el.querySelector("button").addEventListener("click", async () => { await toggleBookmark(work.slug, true); el.remove(); });
            return el;
        }));
        list.replaceChildren(...cards);
    } catch (error) { status.textContent = `Bookmarks could not load: ${error.message || "temporary error"}.`; }
}

async function renderSettings(root) {
    const prefs = await loadTagPreferences().catch(() => null);
    const allTags = knownTagsFromCatalog(fetchData);
    root.insertAdjacentHTML("beforeend", `<p class="account-status">Effective exclusions = global defaults + personal additions − allowed default overrides.</p><label class="tag-search">Search tags <input type="search" placeholder="Filter tags"></label><div class="tag-list"></div><button class="restore-defaults">Restore defaults</button><p class="save-state" role="status"></p>`);
    const list = root.querySelector(".tag-list");
    const input = root.querySelector("input");
    const state = root.querySelector(".save-state");
    const draw = async () => {
        const p = await loadTagPreferences().catch(() => prefs);
        const q = input.value.toLowerCase();
        list.replaceChildren(...allTags.filter(t => !q || t.label.toLowerCase().includes(q) || t.key.includes(q)).map(tag => {
            const isDefault = p.defaults.has(tag.key);
            const isAdded = p.additions.has(tag.key);
            const allowed = p.allowedDefaults.has(tag.key);
            const effective = p.effective.has(tag.key);
            const row = document.createElement("label");
            row.className = "tag-row";
            row.innerHTML = `<input type="checkbox" ${effective ? "checked" : ""}> <span>${tag.label}</span> <small>${isDefault ? (allowed ? "default allowed" : "default") : (isAdded ? "personal" : "available")}</small>`;
            row.querySelector("input").addEventListener("change", async event => {
                state.textContent = "Saving…";
                try {
                    if (isDefault) await (event.target.checked ? removeTagPreference(tag.key) : saveTagPreference(tag.key, "allow_default"));
                    else await (event.target.checked ? saveTagPreference(tag.key, "exclude") : removeTagPreference(tag.key));
                    state.textContent = "Saved."; await draw();
                } catch (error) { state.textContent = `Could not save: ${error.message}`; }
            });
            return row;
        }));
    };
    input.addEventListener("input", draw);
    root.querySelector(".restore-defaults").addEventListener("click", async () => { state.textContent = "Restoring…"; await restoreDefaultTagPreferences(); state.textContent = "Defaults restored."; draw(); });
    subscribeTagPreferences(draw);
    await draw();
}

export class AccountPage {
    static async start(kind = "profile") {
        const container = document.getElementById("reader-container");
        document.body.classList.remove("reader-active");
        container.innerHTML = frame(kind === "settings" ? "Settings" : kind === "bookmarks" ? "Bookmarks" : "Account", `<p class="account-status">Checking account…</p>`);
        const card = container.querySelector(".account-card");
        const s = await session().catch(() => null);
        card.querySelector(".account-status").textContent = `Status: ${s ? accountIdentity(s.user) : "Signed out"}`;
        await authControls(card, s?.user);
        if (!s) return;
        if (kind === "settings") await renderSettings(card);
        else await renderBookmarks(card);
    }
}
