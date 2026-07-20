import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTag, normalizeTags, normalizeVisibilityPolicy, isPublicRotundaEligible, filterRotundaCandidates, tagSearchTokensForWork } from "../src/utils/tag.js";

const catalog = { version: 1, works: { A: { tags: [" Gore ", "soft gore"], sources: ["manual"], updated_at: null }, B: { tags: ["romance", "english"], sources: ["manual"], updated_at: null }, C: { tags: [], sources: ["manual"], updated_at: null } } };

test("exact normalized tag matching", () => {
  assert.equal(normalizeTag(" Soft Gore "), "soft-gore");
  assert.deepEqual(normalizeTags([" Gore ", "gore", "Soft   Gore"]), ["gore", "soft-gore"]);
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: ["soft-gore"] }, { public_rotunda: { omit_public_tags: ["gore"] } }), true);
});

test("showcase_mode any/all and empty showcase", () => {
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: ["romance"] }, { public_rotunda: { showcase_tags: ["romance", "english"], showcase_mode: "any" } }), true);
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: ["romance"] }, { public_rotunda: { showcase_tags: ["romance", "english"], showcase_mode: "all" } }), false);
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: ["romance", "english"] }, { public_rotunda: { showcase_tags: ["romance", "english"], showcase_mode: "all" } }), true);
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: [] }, { public_rotunda: { showcase_tags: [] } }), true);
});

test("omission precedence and exact omit_works", () => {
  const policy = { public_rotunda: { showcase_tags: ["romance"], omit_public_tags: ["gore"], omit_everyone_tags: ["blocked"], omit_works: ["Exact"] } };
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: ["romance", "gore"] }, policy), false);
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: ["romance", "blocked"] }, policy), false);
  assert.equal(isPublicRotundaEligible({ slug: "Exact", tags: ["romance"] }, policy), false);
  assert.equal(isPublicRotundaEligible({ slug: "Exactly", tags: ["romance"] }, policy), true);
});

test("malformed policy and missing tag entry safety", () => {
  assert.deepEqual(normalizeVisibilityPolicy({ public_rotunda: { showcase_tags: "gore", showcase_mode: "wat" } }).public_rotunda.showcase_tags, []);
  assert.deepEqual(filterRotundaCandidates([{ slug: "C" }, { slug: "Missing" }], null, catalog).map(w => w.slug), ["C", "Missing"]);
});

test("rotunda policy does not remove tag search tokens", () => {
  assert.deepEqual(tagSearchTokensForWork("B", catalog), ["english", "romance"]);
  assert.deepEqual(filterRotundaCandidates([{ slug: "B" }], { public_rotunda: { omit_public_tags: ["romance"] } }, catalog), []);
});

test("repeated rotunda initialization is cleanup-first and policy-driven", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/components/rotunda.js", import.meta.url), "utf8"));
  assert.match(source, /Rotunda\.cleanup\?\.\(\)/);
  assert.match(source, /visibilityPolicyStore\.addEventListener\("change", policyChange\)/);
  assert.match(source, /visibilityPolicyStore\.removeEventListener\("change", policyChange\)/);
  assert.match(source, /filterRotundaCandidates\(rawWorks/);
});

test("runtime rotunda filtering ignores legacy public false", () => {
  assert.equal(isPublicRotundaEligible({ slug: "x", tags: [], public: false }, { public_rotunda: { omit_works: [] } }), true);
});

test("hidden rotunda policy is independent from existing Search code path", async () => {
  const fs = await import("node:fs/promises");
  const searchSource = await fs.readFile(new URL("../src/components/search.js", import.meta.url), "utf8");
  assert.match(searchSource, /\/data\/search\.index\.json/);
  assert.doesNotMatch(searchSource, /omit_public_tags|omit_everyone_tags|public_rotunda/);
});
