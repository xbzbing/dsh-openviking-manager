import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { pluginSection } from "./recall-scope.js";
import {
  asRecord,
  EVENTS_DECAY_PROTECTION,
  EXCLUDE_URIS,
  type KnobSpec,
  QUERY_EXPANSION,
  RECALL_CONTEXT_TIMEOUT_MS,
  RECALL_LIMIT,
  type RecallTuningPatch,
  SCORE_THRESHOLD,
  TIMEOUT_MS,
} from "./recall-tuning.js";

/** Write path for the official recall tuning knobs: request-body validation
 * and the ovcli.conf save. The read/compute path (knob specs, layer
 * resolution, view assembly) lives in `recall-tuning.ts`, whose exported specs
 * this module reuses so both paths share one definition.
 *
 * Values are written to `plugin.dsh` — this is the DSH panel, and the shared
 * `plugin` section belongs to every other harness on the machine. Restoring a
 * knob to stock retires the key from both sections instead: a leftover shared
 * value would otherwise keep pinning the knob the UI just reset. */

const MAX_EXCLUDE_ENTRIES = 100;
const MAX_EXCLUDE_ENTRY_CHARS = 512;
const VIKING_URI_RE = /^viking:\/\/\S+$/;
/** The server's duration syntax for `events_time_decay_protection`
 * (`90s`, `45m`, `12h`, `7d`, `2w`). The server owns the semantics; this only
 * refuses input that is obviously not a duration. */
const DURATION_RE = /^\d+(ms|s|m|h|d|w)$/;
const MAX_DECAY_CHARS = 32;

function invalid(message: string): Error {
  return new Error(message);
}

function numberOrNull(raw: unknown, key: string, min: number, max: number): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    if (raw === undefined) return undefined;
    throw invalid(`${key} must be a number between ${min} and ${max}, or null`);
  }
  if (raw < min || raw > max) throw invalid(`${key} must be a number between ${min} and ${max}, or null`);
  return raw;
}

function intOrNull(raw: unknown, key: string, min: number, max: number): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    if (raw === undefined) return undefined;
    throw invalid(`${key} must be an integer between ${min} and ${max}, or null`);
  }
  if (raw < min || raw > max) throw invalid(`${key} must be an integer between ${min} and ${max}, or null`);
  return raw;
}

function uriListOrNull(raw: unknown, key: string): string[] | null | undefined {
  if (raw === null) return null;
  if (!Array.isArray(raw)) {
    if (raw === undefined) return undefined;
    throw invalid(`${key} must be an array of viking:// URIs, or null`);
  }
  if (raw.length > MAX_EXCLUDE_ENTRIES) {
    throw invalid(`${key} accepts at most ${MAX_EXCLUDE_ENTRIES} entries`);
  }
  const entries: string[] = [];
  for (const item of raw) {
    // The official knob takes the list verbatim; the UI validates so a typo
    // cannot silently turn into a filter that never matches.
    if (typeof item !== "string" || item.length > MAX_EXCLUDE_ENTRY_CHARS || !VIKING_URI_RE.test(item)) {
      throw invalid(`${key} entries must be viking:// URIs without spaces, one string each`);
    }
    entries.push(item);
  }
  return entries;
}

/** Validate a PUT body into a patch. Unknown keys are ignored; a missing key
 * leaves that knob untouched, which is what makes a partial save safe. */
export function parseRecallTuningPatch(raw: unknown): RecallTuningPatch {
  const body = asRecord(raw);
  if (body === undefined) throw invalid("request body must be a JSON object");

  const patch: RecallTuningPatch = {};

  if (Object.hasOwn(body, "scoreThreshold")) {
    const value = numberOrNull(body.scoreThreshold, "scoreThreshold", 0, 1);
    if (value !== undefined) patch.scoreThreshold = value;
  }
  if (Object.hasOwn(body, "recallLimit")) {
    const value = intOrNull(body.recallLimit, "recallLimit", 1, 50);
    if (value !== undefined) patch.recallLimit = value;
  }
  if (Object.hasOwn(body, "recallQueryExpansion")) {
    const value = body.recallQueryExpansion;
    if (value !== null && value !== "auto" && value !== "off") {
      throw invalid('recallQueryExpansion must be "auto", "off", or null');
    }
    patch.recallQueryExpansion = value;
  }
  if (Object.hasOwn(body, "recallExcludeUris")) {
    const value = uriListOrNull(body.recallExcludeUris, "recallExcludeUris");
    if (value !== undefined) patch.recallExcludeUris = value;
  }
  if (Object.hasOwn(body, "timeoutMs")) {
    const value = intOrNull(body.timeoutMs, "timeoutMs", 1000, 300000);
    if (value !== undefined) patch.timeoutMs = value;
  }
  if (Object.hasOwn(body, "recallContextTimeoutMs")) {
    const value = intOrNull(body.recallContextTimeoutMs, "recallContextTimeoutMs", 0, 600000);
    if (value !== undefined) patch.recallContextTimeoutMs = value;
  }
  if (Object.hasOwn(body, "recallEventsDecayProtection")) {
    const raw = body.recallEventsDecayProtection;
    if (raw === null || raw === "") patch.recallEventsDecayProtection = null;
    else if (typeof raw !== "string") {
      throw invalid('recallEventsDecayProtection must be a duration string such as "7d", or null');
    } else {
      const value = raw.trim();
      if (value.length > MAX_DECAY_CHARS || !DURATION_RE.test(value)) {
        throw invalid('recallEventsDecayProtection must be a duration such as "90s", "12h", "7d" or "2w", or null');
      }
      patch.recallEventsDecayProtection = value;
    }
  }

  return patch;
}

/** Mutable working copy of the two ovcli.conf sections a save touches: the
 * shared `plugin` section and its `plugin.dsh` harness override. */
interface SaveDraft {
  shared: Record<string, unknown>;
  harness: Record<string, unknown> | undefined;
}

/** Clear a key from the harness section only. */
function dropFromHarness(draft: SaveDraft, names: string[]): void {
  if (draft.harness === undefined) return;
  for (const name of names) delete draft.harness[name];
}

/** Retire a key from both sections — "remove it" for a stock restore. */
function dropKey(draft: SaveDraft, names: string[]): void {
  for (const name of names) delete draft.shared[name];
  dropFromHarness(draft, names);
}

/** Write a value to the DSH-scoped section after retiring its aliases there,
 * so a stale spelling cannot mask the new value. The shared section is left
 * alone: it is what the other harnesses on this machine read. */
function putKnob(draft: SaveDraft, spec: KnobSpec, value: unknown): void {
  draft.harness ??= {};
  dropFromHarness(draft, spec.aliases);
  draft.harness[spec.key] = value;
}

/** Restore a knob's official default by removing the key from both sections
 * instead of pinning a value — an absent key *is* the official default. */
function restoreKnob(draft: SaveDraft, spec: KnobSpec): void {
  dropKey(draft, [spec.key, ...spec.aliases]);
}

/** True when a patch value means "restore the official default" for its knob:
 * `null` for every knob, plus an empty list for `recallExcludeUris` and an
 * empty string for the duration knob. */
function isRestore(name: keyof RecallTuningPatch, value: unknown): boolean {
  if (value === null) return true;
  if (name === "recallExcludeUris" && Array.isArray(value) && value.length === 0) return true;
  return name === "recallEventsDecayProtection" && value === "";
}

const SPEC_BY_KEY: Record<keyof RecallTuningPatch, KnobSpec> = {
  scoreThreshold: SCORE_THRESHOLD,
  recallLimit: RECALL_LIMIT,
  recallQueryExpansion: QUERY_EXPANSION,
  recallExcludeUris: EXCLUDE_URIS,
  recallEventsDecayProtection: EVENTS_DECAY_PROTECTION,
  timeoutMs: TIMEOUT_MS,
  recallContextTimeoutMs: RECALL_CONTEXT_TIMEOUT_MS,
};

/** Write the patch to ovcli.conf's `plugin.dsh` section.
 *
 * - a supplied value is written to the DSH-scoped section, leaving the shared
 *   `plugin` section for the other harnesses on this machine;
 * - `null` (an empty exclude list, an empty duration) removes the key from
 *   both sections — an absent key *is* the official default, so that is what
 *   "back to stock" means, and a leftover shared value must not keep pinning
 *   a knob the UI just reset;
 * - `recallQueryExpansion: "auto"` is an explicit choice the UI offers, so it
 *   is written rather than dropped: dropping it would hand the key back to the
 *   official default and let the next load re-pin the product one. `null` still
 *   removes it for a caller that wants stock behaviour;
 * - a pinned knob never comes back as absent through the UI: restoring its
 *   default writes the product default instead, which keeps the value the
 *   next page load would re-pin anyway from bouncing twice;
 * - `scoreThreshold` retires its official alias `recallScoreThreshold` when it
 *   is written or removed, so the stale spelling cannot mask the new value.
 *
 * Every other key (credentials, sections, unknown entries) is preserved. */
export async function saveRecallTuning(path: string, patch: RecallTuningPatch): Promise<void> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
    [keyof RecallTuningPatch, unknown]
  >;
  if (entries.length === 0) return;

  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const harness = shared === undefined ? undefined : asRecord(shared.dsh);
  const draft: SaveDraft = {
    shared: { ...(shared ?? {}) },
    harness: harness === undefined ? undefined : { ...harness },
  };

  for (const [name, value] of entries) {
    const spec = SPEC_BY_KEY[name];
    if (isRestore(name, value)) restoreKnob(draft, spec);
    else putKnob(draft, spec, value);
  }

  // An empty harness section is dropped rather than written as `{}`; a section
  // that still carries other keys — the isolation scope, a peer pin — stays.
  if (draft.harness === undefined || Object.keys(draft.harness).length === 0) delete draft.shared.dsh;
  else draft.shared.dsh = draft.harness;

  const next: Record<string, unknown> = { ...existing, plugin: draft.shared };
  await writeOvcliObject(path, next);
}
