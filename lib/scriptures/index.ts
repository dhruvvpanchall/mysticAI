/**
 * Scripture registry. The chat route looks up a ScriptureModule by id; new
 * scriptures (Mahabharata, Upanishads, Vedas, etc.) get added here and need
 * only implement the ScriptureModule contract from ./types.
 *
 * Default is Gita — every legacy request that omits the `model` param gets
 * the existing Gita behavior, which is the contract for backward compat.
 */

import { gita } from "./gita";
import { ramayana } from "./ramayana";
import type { ScriptureId, ScriptureModule } from "./types";

export const SCRIPTURES: Record<ScriptureId, ScriptureModule> = {
  gita,
  ramayana,
};

export const DEFAULT_SCRIPTURE: ScriptureId = "gita";

/** Coerce any client-supplied string into a valid ScriptureId; returns the
 *  default when the value is unknown or missing. Keeps the API forgiving. */
export function resolveScriptureId(raw: unknown): ScriptureId {
  if (typeof raw === "string" && raw in SCRIPTURES) {
    return raw as ScriptureId;
  }
  return DEFAULT_SCRIPTURE;
}

export function getScripture(id: ScriptureId): ScriptureModule {
  return SCRIPTURES[id];
}

/** UI helpers: list metadata for every scripture, for switcher rendering. */
export const SCRIPTURE_LIST = Object.values(SCRIPTURES).map((s) => s.meta);

export type { ScriptureId, ScriptureModule } from "./types";
export type { ScriptureMeta, RetrievedVerse, GreetingKind, InfoKind } from "./types";
