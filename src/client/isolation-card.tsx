import { SegmentedControl } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Translation } from "./i18n.js";

/** The isolation switch and the scope it applies to. The per-directory peer
 * preview lived here and was removed: it looked like a saved project path and
 * only re-resolved the other cards, while the workspace card already reports
 * every sidebar workspace's peer and its isolation risks. */
export interface RecallScopeView {
  scope: "all" | "actor";
  source: "env" | "workspace" | "plugin.dsh" | "plugin" | "default";
  envOverride: string;
  workspaceLayer: string;
  sharedScope: string;
  restartPending: boolean;
}

/** The isolation control's two modes, in render order: each owns a panel id. */
const ISOLATION_MODES = ["all", "actor"] as const;

export function IsolationCard(props: {
  scope: RecallScopeView;
  busy: boolean;
  initializing: boolean;
  onScopeChange: (isolate: boolean) => void;
  t: Translation;
}) {
  const { scope, busy, initializing, onScopeChange, t } = props;
  return (
    <section className="ovm-card" aria-label={t("projectTitle")}>
      <h2>{t("projectTitle")}</h2>
      {/* The platform has no switch: its cards express a two-choice mode with
          the segmented control, so this does the same. */}
      <SegmentedControl
        id="ovm-isolation"
        label={t("isolateByTopicLabel")}
        value={scope.scope}
        disabled={busy || initializing || scope.source === "env" || scope.source === "workspace"}
        options={[
          { value: "all", label: t("scopeAll") },
          { value: "actor", label: t("scopeActor") },
        ]}
        onChange={(next: string) => void onScopeChange(next === "actor")}
      />
      {/* The platform control marks each tab with `aria-controls="<id>-<value>-panel"`
          and leaves the panel to its owner, so both exist here and the inactive
          one stays hidden; otherwise every tab carries a dangling reference. */}
      {ISOLATION_MODES.map((mode) => (
        <div
          key={mode}
          id={`ovm-isolation-${mode}-panel`}
          role="tabpanel"
          aria-labelledby={`ovm-isolation-${mode}`}
          hidden={scope.scope !== mode}
        >
          <p className="ovm-hint ovm-isolationHint">{t(mode === "actor" ? "isolationHintActor" : "isolationHintAll")}</p>
        </div>
      ))}
      <p className="ovm-hint ovm-isolationHint">{t("reloadNotice")}</p>
      {scope.source === "env" ? <p className="ovm-warning" role="alert">{t("envOverrideWarning", { variable: "OPENVIKING_RECALL_PEER_SCOPE" })}</p> : null}
      {scope.source === "workspace" ? <p className="ovm-warning" role="alert">{t("tuningWorkspaceWarning", { keys: "recall.peer_scope" })}</p> : null}
      {scope.sharedScope !== "" ? <p className="ovm-hint">{t("projectSharedNote", { scope: scope.sharedScope })}</p> : null}
    </section>
  );
}
