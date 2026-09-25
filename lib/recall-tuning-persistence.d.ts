import { type RecallTuningPatch } from "./recall-tuning.js";
/** Validate a PUT body into a patch. Unknown keys are ignored; a missing key
 * leaves that knob untouched, which is what makes a partial save safe. */
export declare function parseRecallTuningPatch(raw: unknown): RecallTuningPatch;
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
export declare function saveRecallTuning(path: string, patch: RecallTuningPatch): Promise<void>;
