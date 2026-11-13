/** Locale barrel for the manager client: `zh` defines the key set; `en` must cover it. */
import { en } from "./locales/en.js";
import { zh } from "./locales/zh.js";

export { en, zh };
export type { TranslationKey } from "./locales/zh.js";

export const dictionaries = { en, zh } as const;
