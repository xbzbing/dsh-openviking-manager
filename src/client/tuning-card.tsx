import type { Translation } from "./i18n.js";

export interface RecallTuningKnobView<T> {
  value: T;
  source: "env" | "workspace" | "plugin.dsh" | "plugin" | "default";
  configured: boolean;
  envOverride: string;
  workspaceLayer: string;
  envVar: string;
  default: T;
  pinned: boolean;
}

export interface RecallTuningView {
  scoreThreshold: RecallTuningKnobView<number>;
  recallLimit: RecallTuningKnobView<number>;
  recallQueryExpansion: RecallTuningKnobView<"auto" | "off">;
  recallExcludeUris: RecallTuningKnobView<string[]>;
  recallEventsDecayProtection: RecallTuningKnobView<string>;
  timeoutMs: RecallTuningKnobView<number>;
  recallContextTimeoutMs: RecallTuningKnobView<number>;
  restartPending: boolean;
  /** Pinned knobs no layer supplies yet — written once on first load. */
  initPatch: { scoreThreshold?: number; recallLimit?: number; recallQueryExpansion?: "auto" | "off"; recallExcludeUris?: string[]; timeoutMs?: number; recallContextTimeoutMs?: number };
}

/** Field state held between loads: a string so "empty" can mean "official
 * default" — which the server turns back into an absent key. */
export interface RecallTuningDraft {
  scoreThreshold: string;
  recallLimit: string;
  recallQueryExpansion: "auto" | "off";
  recallExcludeUris: string;
  recallEventsDecayProtection: string;
  timeoutMs: string;
  recallContextTimeoutMs: string;
}

/** The tuning knobs, folded by default. It owns no fetch: the page keeps the
 * draft and the save handler, and this card renders the seven fields and their
 * override warnings. */
export function TuningCard(props: {
  view: RecallTuningView;
  draft: RecallTuningDraft;
  dirtyCount: number;
  busy: boolean;
  initializing: boolean;
  envVars: string[];
  workspaceLayers: string[];
  onChange: (key: keyof RecallTuningDraft, value: string) => void;
  onSave: (event: React.FormEvent) => void;
  t: Translation;
}) {
  const { view, draft, dirtyCount, busy, initializing, envVars, workspaceLayers, onChange, onSave, t } = props;
  return (

      <section className="ovm-card" aria-label={t("tuningTitle")}>
        {/* Collapsed by default, exactly like the recovery panel: this is
            occasional configuration, not something to scan on every visit. */}
        <details className="ovm-tuning ovm-collapse">
          <summary><h2>{t("tuningTitle")}</h2></summary>
          <div className="ovm-collapseContent">
            <p className="ovm-hint ovm-tuningIntro">{t("tuningIntro")}</p>
            <form onSubmit={(event) => void onSave(event)}>
              <div className="ovm-tuningGrid">
                <div className="ovm-tuningField">
                  <label>{t("scoreThresholdLabel")}
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step="any"
                      value={draft.scoreThreshold}
                      placeholder={t("defaultPlaceholder", { value: String(view.scoreThreshold.default) })}
                      disabled={busy || initializing || view.scoreThreshold.source === "env" || view.scoreThreshold.source === "workspace"}
                      onChange={(event) => onChange("scoreThreshold", event.target.value)}
                    />
                  </label>
                  <p className="ovm-hint">{t("scoreThresholdHint")}</p>
                </div>
                <div className="ovm-tuningField">
                  <label>{t("recallLimitLabel")}
                    <input
                      type="number"
                      min={1}
                      max={50}
                      step={1}
                      value={draft.recallLimit}
                      placeholder={t("defaultPlaceholder", { value: String(view.recallLimit.default) })}
                      disabled={busy || initializing || view.recallLimit.source === "env" || view.recallLimit.source === "workspace"}
                      onChange={(event) => onChange("recallLimit", event.target.value)}
                    />
                  </label>
                  <p className="ovm-hint">{t("recallLimitHint")}</p>
                </div>
                <div className="ovm-tuningField">
                  <label>{t("queryExpansionLabel")}
                    <select
                      value={draft.recallQueryExpansion}
                      disabled={busy || initializing || view.recallQueryExpansion.source === "env" || view.recallQueryExpansion.source === "workspace"}
                      onChange={(event) => onChange("recallQueryExpansion", event.target.value === "off" ? "off" : "auto")}
                    >
                      <option value="auto">{t("queryExpansionAuto")}</option>
                      <option value="off">{t("queryExpansionOff")}</option>
                    </select>
                  </label>
                  <p className="ovm-hint">{t("queryExpansionHint")}</p>
                </div>
                <div className="ovm-tuningField">
                  <label>{t("excludeUrisLabel")}
                    <textarea
                      rows={4}
                      value={draft.recallExcludeUris}
                      placeholder="viking://"
                      disabled={busy || initializing || view.recallExcludeUris.source === "env" || view.recallExcludeUris.source === "workspace"}
                      onChange={(event) => onChange("recallExcludeUris", event.target.value)}
                    />
                  </label>
                  <p className="ovm-hint">{t("excludeUrisHint")}</p>
                </div>
                <div className="ovm-tuningField">
                  <label>{t("decayLabel")}
                    <input
                      value={draft.recallEventsDecayProtection}
                      placeholder="7d"
                      disabled={busy || initializing || view.recallEventsDecayProtection.source === "env" || view.recallEventsDecayProtection.source === "workspace"}
                      onChange={(event) => onChange("recallEventsDecayProtection", event.target.value)}
                    />
                  </label>
                  <p className="ovm-hint">{t("decayHint")}</p>
                </div>
                <div className="ovm-tuningField">
                  <label>{t("timeoutMsLabel")}
                    <input
                      type="number"
                      min={1000}
                      max={300000}
                      step={500}
                      value={draft.timeoutMs}
                      placeholder={t("defaultPlaceholder", { value: String(view.timeoutMs.default) })}
                      disabled={busy || initializing || view.timeoutMs.source === "env" || view.timeoutMs.source === "workspace"}
                      onChange={(event) => onChange("timeoutMs", event.target.value)}
                    />
                  </label>
                  <p className="ovm-hint">{t("timeoutMsHint")}</p>
                </div>
                <div className="ovm-tuningField">
                  <label>{t("recallContextTimeoutMsLabel")}
                    <input
                      type="number"
                      min={0}
                      max={600000}
                      step={500}
                      value={draft.recallContextTimeoutMs}
                      placeholder={t("defaultPlaceholder", { value: String(view.recallContextTimeoutMs.default) })}
                      disabled={busy || initializing || view.recallContextTimeoutMs.source === "env" || view.recallContextTimeoutMs.source === "workspace"}
                      onChange={(event) => onChange("recallContextTimeoutMs", event.target.value)}
                    />
                  </label>
                  <p className="ovm-hint">{t("recallContextTimeoutMsHint")}</p>
                </div>
              </div>
              <p className="ovm-hint">{t("tuningReloadNotice")}</p>
              <p className="ovm-hint">{t("tuningSharedRestoreNote")}</p>
              <div className="ovm-actions"><button type="submit" disabled={busy || initializing || dirtyCount === 0}>{t("saveTuning")}</button></div>
            </form>
          </div>
        </details>
        {/* The env-override warning sits outside the fold: a closed panel must
            not hide that the file value is not the effective one. */}
        {envVars.length > 0 ? <p className="ovm-warning" role="alert">{t("tuningEnvWarning", { vars: envVars.join(", ") })}</p> : null}
        {workspaceLayers.length > 0 ? <p className="ovm-warning" role="alert">{t("tuningWorkspaceWarning", { keys: workspaceLayers.join(", ") })}</p> : null}
      </section>
  );
}
