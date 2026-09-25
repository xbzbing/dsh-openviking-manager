import { useEffect, useRef, useState } from "react";
import type { Translate } from "@deepseek-ai/dsh-client-ui-slots";
import type { TranslationKey } from "./i18n.js";

export const DEFAULT_TOGGLE_API_PREFIX = "/plugins/dsh-openviking-manager/api";

interface ToggleEnvelope {
  ok?: boolean;
  value?: { sessionId: string; enabled: boolean };
  error?: string;
}

export interface OpenVikingToggleProps {
  sessionId: string;
  t: Translate<TranslationKey>;
  apiPrefix?: string;
  fetchFn?: typeof fetch;
}

async function requestToggle(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<boolean | undefined> {
  const response = await fetchFn(url, init);
  const json = (await response.json()) as ToggleEnvelope;
  if (!response.ok || !json.ok || typeof json.value?.enabled !== "boolean") return undefined;
  return json.value.enabled;
}

export function OpenVikingToggle({ sessionId, t, apiPrefix = DEFAULT_TOGGLE_API_PREFIX, fetchFn = fetch }: OpenVikingToggleProps) {
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const loadAbort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const current = ++generation.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setEnabled(true);
    setBusy(true);
    setFailed(false);
    void (async () => {
      try {
        const value = await requestToggle(fetchFn, `${apiPrefix}/session-toggle?sessionId=${encodeURIComponent(sessionId)}`, {
          signal: controller.signal,
        });
        if (generation.current !== current) return;
        if (value === undefined) setFailed(true);
        else setEnabled(value);
      } catch {
        if (generation.current === current && !controller.signal.aborted) setFailed(true);
      } finally {
        if (generation.current === current) setBusy(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [apiPrefix, fetchFn, sessionId]);

  const toggle = async (): Promise<void> => {
    if (busy) return;
    const next = !enabled;
    const current = ++generation.current;
    loadAbort.current?.abort();
    setBusy(true);
    setEnabled(next);
    try {
      const value = await requestToggle(fetchFn, `${apiPrefix}/session-toggle`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, enabled: next }),
      });
      if (generation.current !== current) return;
      if (value === undefined) throw new Error("toggle rejected");
      setEnabled(value);
      setFailed(false);
    } catch {
      if (generation.current === current) {
        setEnabled(!next);
        setFailed(true);
      }
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };

  const stateHint = failed ? t("toggleFailed") : enabled ? t("toggleStateOn") : t("toggleStateOff");

  return (
    <button
      type="button"
      className={`ovm-ovToggle${enabled ? "" : " ovm-ovToggleOff"}`}
      aria-pressed={enabled}
      aria-busy={busy}
      aria-label={t("toggleAction")}
      data-ovm-tip={stateHint}
      disabled={busy}
      onClick={() => void toggle()}
    >
      <span className="ovm-ovToggleDot" aria-hidden="true" />
      <span className="ovm-ovToggleLabel">{t("toggleLabel")}</span>
    </button>
  );
}
