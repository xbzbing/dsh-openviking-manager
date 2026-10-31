import { useEffect, useState } from "react";

/** One shared value per page: the composer pill and the configuration page live
 * in the same bundle, so a save on the page shows or hides the pill at once. */
let showInputToggle: boolean | undefined;
const listeners = new Set<(value: boolean) => void>();

export function setShowInputToggle(value: boolean): void {
  showInputToggle = value;
  for (const listener of listeners) listener(value);
}

interface PreferencesEnvelope { ok?: boolean; value?: { showInputToggle?: unknown } }

/** Read the stored value; failures leave the current value (hidden by default). */
export async function refreshShowInputToggle(fetchFn: typeof fetch, apiPrefix: string, signal?: AbortSignal): Promise<boolean | undefined> {
  try {
    const response = await fetchFn(`${apiPrefix}/ui-preferences`, { signal });
    const json = (await response.json()) as PreferencesEnvelope;
    if (!response.ok || !json.ok || typeof json.value?.showInputToggle !== "boolean") return undefined;
    if (!signal?.aborted) setShowInputToggle(json.value.showInputToggle);
    return json.value.showInputToggle;
  } catch {
    return undefined;
  }
}

/** Current value, re-read from the server on mount. `false` until known. */
export function useShowInputToggle(fetchFn: typeof fetch, apiPrefix: string): boolean {
  const [value, setValue] = useState(showInputToggle ?? false);
  useEffect(() => {
    listeners.add(setValue);
    if (showInputToggle !== undefined) setValue(showInputToggle);
    const controller = new AbortController();
    void refreshShowInputToggle(fetchFn, apiPrefix, controller.signal);
    return () => {
      controller.abort();
      listeners.delete(setValue);
    };
  }, [apiPrefix, fetchFn]);
  return value;
}
