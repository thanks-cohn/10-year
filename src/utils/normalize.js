/*
 = *==============================================================================

 Location:
 src/utils/normalize.js

 Purpose:
 Produce canonical searchable text.

 Overview:

 Search relies on deterministic comparisons.

 Every searchable string is normalized before matching.

 The browser and the build pipeline must implement the exact
 same normalization rules.

 Rules:

 lowercase

 ↓

 replace "_" with spaces

 ↓

 replace "-" with spaces

 ↓

 remove punctuation

 ↓

 collapse repeated whitespace

 ↓

 trim

 Examples:

 "Attack_on_Titan"

 →

 "attack on titan"

 -------------------------------------------------------------------------------

 This function should never perform matching.

 Its sole responsibility is converting arbitrary human text into a
 canonical searchable representation.

 ===============================================================================
 */

/**
 * Normalize text into a canonical searchable form.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {

    if (typeof text !== "string") {
        return "";
    }

    return text
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
