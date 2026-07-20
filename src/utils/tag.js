const EMPTY_TAG_CATALOG = { version: 1, works: {} };

export function normalizeTag(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

export function normalizeTags(values) {
    const input = Array.isArray(values) ? values : [];
    return [...new Set(input.map(normalizeTag).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function normalizeTagCatalog(catalog = EMPTY_TAG_CATALOG) {
    const works = {};
    const rawWorks = catalog && typeof catalog === "object" && catalog.works && typeof catalog.works === "object" ? catalog.works : {};
    for (const [slug, entry] of Object.entries(rawWorks).sort(([a], [b]) => a.localeCompare(b))) {
        if (!slug) continue;
        const object = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
        works[slug] = {
            tags: normalizeTags(object.tags),
            sources: normalizeTags(object.sources?.length ? object.sources : ["manual"]),
            updated_at: object.updated_at ?? null
        };
    }
    return { version: 1, works };
}

export function tagsForSlug(slug, catalog = EMPTY_TAG_CATALOG) {
    const entry = normalizeTagCatalog(catalog).works[String(slug || "")];
    return entry ? entry.tags : [];
}

export function joinWorkTags(works, catalog = EMPTY_TAG_CATALOG) {
    if (!Array.isArray(works)) return [];
    const normalizedCatalog = normalizeTagCatalog(catalog);
    return works.map(work => {
        const slug = work?.slug;
        const catalogTags = slug ? normalizedCatalog.works[slug]?.tags : [];
        return { ...work, tags: catalogTags || normalizeTags(work?.tags) };
    });
}

export function normalizePublicRotundaPolicy(policy) {
    const source = policy?.public_rotunda && typeof policy.public_rotunda === "object" ? policy.public_rotunda : {};
    const mode = source.showcase_mode === "all" ? "all" : "any";
    return {
        showcase_tags: normalizeTags(source.showcase_tags),
        showcase_mode: mode,
        omit_public_tags: normalizeTags(source.omit_public_tags),
        omit_everyone_tags: normalizeTags(source.omit_everyone_tags),
        omit_works: Array.isArray(source.omit_works) ? [...new Set(source.omit_works.map(value => String(value ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []
    };
}

export function normalizeVisibilityPolicy(policy) {
    return { version: 1, public_rotunda: normalizePublicRotundaPolicy(policy) };
}

function hasTag(tags, needles) {
    const set = new Set(normalizeTags(tags));
    return needles.some(tag => set.has(tag));
}

export function isPublicRotundaEligible(work, policy) {
    if (!work || typeof work !== "object") return false;
    const normalized = normalizeVisibilityPolicy(policy).public_rotunda;
    const slug = String(work.slug || "");
    if (!slug || normalized.omit_works.includes(slug)) return false;
    if (work.public === false) return false;
    const tags = normalizeTags(work.tags);
    if (hasTag(tags, normalized.omit_everyone_tags) || hasTag(tags, normalized.omit_public_tags)) return false;
    if (!normalized.showcase_tags.length) return true;
    const tagSet = new Set(tags);
    return normalized.showcase_mode === "all"
        ? normalized.showcase_tags.every(tag => tagSet.has(tag))
        : normalized.showcase_tags.some(tag => tagSet.has(tag));
}

export function filterRotundaCandidates(candidates, policy, catalog = EMPTY_TAG_CATALOG) {
    return joinWorkTags(candidates, catalog).filter(work => isPublicRotundaEligible(work, policy));
}

export function tagSearchTokensForWork(slug, catalog = EMPTY_TAG_CATALOG) {
    return [...new Set(tagsForSlug(slug, catalog).flatMap(tag => [tag, ...tag.split("-")]).filter(Boolean))];
}

// Back-compat aliases used by older tests/imports.
export const normalizeCandidate = work => ({ ...work, tags: normalizeTags(work?.tags), public: work?.public !== false });
export const isRotundaEligible = isPublicRotundaEligible;
