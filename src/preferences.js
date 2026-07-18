import { getSupabase, session } from "./discussion/supabase.js";
import { normalize } from "./utils/normalize.js";

// Central site-wide content-default configuration. No authoritative tag list was
// found in the repo, so keep this empty until the exact policy tags are chosen.
export const DEFAULT_EXCLUDED_TAGS = Object.freeze([]);

const VALID_TAG_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let currentUserId = null;
let cached = null;
let inflight = null;
const listeners = new Set();

export function normalizeTagKey(value) {
    return normalize(String(value || ""))
        .replace(/[_\s]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function tagsForWork(work = {}) {
    const raw = work.tags || work.content_tags || work.contentTags || work.tag_keys || work.tagKeys || [];
    return Array.isArray(raw) ? raw.map(normalizeTagKey).filter(Boolean) : [];
}

export function knownTagsFromCatalog(catalog = {}) {
    const map = new Map();
    for (const work of catalog.works || []) {
        const displayTags = work.tags || work.content_tags || work.contentTags || work.tag_keys || work.tagKeys || [];
        if (!Array.isArray(displayTags)) continue;
        for (const tag of displayTags) {
            const key = normalizeTagKey(tag);
            if (key && !map.has(key)) map.set(key, { key, label: String(tag) });
        }
    }
    for (const key of DEFAULT_EXCLUDED_TAGS) if (!map.has(key)) map.set(key, { key, label: key.replaceAll("-", " ") });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function compose(rows = []) {
    const defaults = new Set(DEFAULT_EXCLUDED_TAGS.map(normalizeTagKey).filter(Boolean));
    const additions = new Set();
    const allowedDefaults = new Set();
    for (const row of rows) {
        const key = normalizeTagKey(row.tag_key);
        if (!key) continue;
        if (row.preference === "allow_default") allowedDefaults.add(key);
        else additions.add(key);
    }
    return {
        defaults,
        additions,
        allowedDefaults,
        effective: new Set([...defaults, ...additions].filter(key => !allowedDefaults.has(key)))
    };
}

function snapshot(rows = [], status = "ready") {
    const composed = compose(rows);
    return { status, rows, ...composed };
}

function notify(value) { for (const fn of listeners) fn(value); }

async function fetchRows() {
    const s = await session().catch(() => null);
    const userId = s?.user?.id || null;
    if (currentUserId !== userId) { currentUserId = userId; cached = null; }
    if (!userId) return snapshot([], "signed-out");
    const db = await getSupabase();
    if (!db) return snapshot([], "unconfigured");
    const { data, error } = await db.from("user_tag_preferences").select("tag_key,preference,updated_at").order("tag_key");
    if (error) throw error;
    return snapshot(data || []);
}

export async function loadTagPreferences({ refresh = false } = {}) {
    if (cached && !refresh) return cached;
    if (!inflight) inflight = fetchRows().then(value => { cached = value; notify(value); return value; }).finally(() => { inflight = null; });
    return inflight;
}

export function getCachedTagPreferences() { return cached || snapshot([], "initial"); }
export function subscribeTagPreferences(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function clearUserPreferenceCache() { currentUserId = null; cached = null; inflight = null; notify(getCachedTagPreferences()); }

export function isWorkExcluded(work, prefs = getCachedTagPreferences()) {
    const tags = tagsForWork(work);
    return tags.some(tag => prefs.effective.has(tag));
}

export function filterExcludedWorks(works, prefs = getCachedTagPreferences()) {
    return (works || []).filter(work => !isWorkExcluded(work, prefs));
}

export async function saveTagPreference(tagKey, preference) {
    const key = normalizeTagKey(tagKey);
    if (!VALID_TAG_KEY.test(key)) throw new Error("Invalid tag key.");
    const db = await getSupabase();
    if (!db) throw new Error("Supabase is not configured.");
    const { error } = await db.from("user_tag_preferences").upsert({ tag_key: key, preference }, { onConflict: "user_id,tag_key" });
    if (error) throw error;
    return loadTagPreferences({ refresh: true });
}

export async function removeTagPreference(tagKey) {
    const db = await getSupabase();
    if (!db) throw new Error("Supabase is not configured.");
    const { error } = await db.from("user_tag_preferences").delete().eq("tag_key", normalizeTagKey(tagKey));
    if (error) throw error;
    return loadTagPreferences({ refresh: true });
}

export async function restoreDefaultTagPreferences() {
    const db = await getSupabase();
    if (!db) throw new Error("Supabase is not configured.");
    const { error } = await db.from("user_tag_preferences").delete().neq("tag_key", "");
    if (error) throw error;
    return loadTagPreferences({ refresh: true });
}
