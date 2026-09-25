import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { pluginSection } from "./recall-scope.js";
import {
  asRecord,
  EXCLUDE_URIS,
  type KnobSpec,
  QUERY_EXPANSION,
  RECALL_LIMIT,
  type RecallTuningPatch,
  SCORE_THRESHOLD,
} from "./recall-tuning.js";

/** Write path for the official recall tuning knobs: request-body validation
 * and the ovcli.conf `plugin`-section save. The read/compute path (knob specs,
 * layer resolution, view assembly) lives in `recall-tuning.ts`, whose exported
 * specs this module reuses so both paths share one definition. */

const MAX_EXCLUDE_ENTRIES = 100;
const MAX_EXCLUDE_ENTRY_CHARS = 512;
const VIKING_URI_RE = /^viking:\/\/\S+$/;

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

  return patch;
}

/** Mutable working copy of the two ovcli.conf sections a save touches: the
 * shared `plugin` section and its `plugin.dsh` harness override. */
interface SaveDraft {
  shared: Record<string, unknown>;
  harness: Record<string, unknown> | undefined;
  harnessTouched: boolean;
}

/** Clear a key from the harness section only, so the shared section stays the
 * single source of it while a stale `plugin.dsh` override cannot win. */
function dropFromHarness(draft: SaveDraft, names: string[]): void {
  if (draft.harness === undefined) return;
  for (const name of names) {
    if (!Object.hasOwn(draft.harness, name)) continue;
    delete draft.harness[name];
    draft.harnessTouched = true;
  }
}

/** Retire a key from both sections — "remove it" for a default restore. */
function dropKey(draft: SaveDraft, names: string[]): void {
  for (const name of names) delete draft.shared[name];
  dropFromHarness(draft, names);
}

/** Write a value to the shared section. Retiring the key (and its aliases)
 * from both sections first keeps one name per section, so a stale `plugin.dsh`
 * override or the legacy alias cannot mask the new value. */
function putKnob(draft: SaveDraft, spec: KnobSpec, value: unknown): void {
  dropKey(draft, [spec.key, ...spec.aliases]);
  draft.shared[spec.key] = value;
}

/** Restore a knob's official default by removing the key from both sections
 * instead of pinning a value — an absent key *is* the official default. */
function restoreKnob(draft: SaveDraft, spec: KnobSpec): void {
  dropKey(draft, [spec.key, ...spec.aliases]);
}

/** True when a patch value means "restore the official default" for its knob:
 * `null` for every knob, plus an empty list for `recallExcludeUris`. */
function isRestore(name: keyof RecallTuningPatch, value: unknown): boolean {
  if (value === null) return true;
  return name === "recallExcludeUris" && Array.isArray(value) && value.length === 0;
}

const SPEC_BY_KEY: Record<keyof RecallTuningPatch, KnobSpec> = {
  scoreThreshold: SCORE_THRESHOLD,
  recallLimit: RECALL_LIMIT,
  recallQueryExpansion: QUERY_EXPANSION,
  recallExcludeUris: EXCLUDE_URIS,
};

/** Write the patch to ovcli.conf's `plugin` section.
 *
 * - a supplied value is written to the shared section after clearing any
 *   `plugin.dsh` override, so one section is the single source of the key;
 * - `null` (and an empty exclude list) removes the key from both sections —
 *   an absent key *is* the official default, so that is what "back to stock"
 *   means for a knob without a product default;
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
    harnessTouched: false,
  };

  for (const [name, value] of entries) {
    const spec = SPEC_BY_KEY[name];
    if (isRestore(name, value)) restoreKnob(draft, spec);
    else putKnob(draft, spec, value);
  }

  // The harness section only disappears when this write emptied it; an
  // untouched `plugin.dsh` keeps whatever other keys it carries.
  if (draft.harnessTouched && draft.harness !== undefined) {
    if (Object.keys(draft.harness).length > 0) draft.shared.dsh = draft.harness;
    else delete draft.shared.dsh;
  }

  const next: Record<string, unknown> = { ...existing, plugin: draft.shared };
  await writeOvcliObject(path, next);
}
