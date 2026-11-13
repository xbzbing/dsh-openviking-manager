/** Public i18n entry for the manager client: dictionaries live in ./locales/, helpers stay here. */
import { dictionaries } from "./locales.js";
import type { TranslationKey } from "./locales.js";

export { dictionaries };
export type { TranslationKey } from "./locales.js";

export type ManagerLocale = "en" | "zh";

export type Translation = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function localeFrom(value: string | undefined): ManagerLocale {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function browserLocale(): ManagerLocale {
  if (typeof document !== "undefined" && document.documentElement.lang !== "") return localeFrom(document.documentElement.lang);
  if (typeof navigator !== "undefined") return localeFrom(navigator.language);
  return "en";
}

export function createTranslation(locale: string | undefined): Translation {
  const dictionary = dictionaries[localeFrom(locale)];
  return (key, params) => (params === undefined ? dictionary[key] : dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`)));
}
