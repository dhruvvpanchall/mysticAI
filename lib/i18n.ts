/**
 * Single source of truth for language detection. Used by:
 *
 *   - /api/chat route — to pick the reply language (Hindi query → Hindi
 *     reply) and to short-circuit the gibberish gate.
 *   - /api/translate — to validate that Hindi targets actually contain
 *     Devanagari.
 *   - /api/transcribe — to coarse-classify Whisper output by script.
 *   - chat page — to set `contentLang` on assistant messages so reloads
 *     remember which language each reply was authored in.
 *   - voice player — to decide whether to translate before speaking.
 *
 * Detection is intentionally simple: a single Devanagari code point
 * anywhere in the text marks the whole string as Hindi. Everything else
 * is treated as English.
 */

export type Lang = "en" | "hi";

/** Devanagari Unicode block (U+0900 – U+097F). */
const DEVANAGARI = /[ऀ-ॿ]/;

/** True if the text contains any Devanagari character. */
export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

/** Coarse two-way classifier — Hindi if Devanagari is present, else English. */
export function detectLang(text: string): Lang {
  return DEVANAGARI.test(text) ? "hi" : "en";
}
