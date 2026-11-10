import { SegmentedControl } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Translation, TranslationKey } from "./i18n.js";
import { SOURCE_KEYS } from "./view-keys.js";

export interface WorkspaceDeclarationView { key: string; value: unknown; layer: string; }
export interface ProjectRiskView { code: string; severity: "error" | "warning"; values?: Record<string, string>; }
/** The project a session in `cwd` belongs to, resolved by the official loader
 * (workspace layers included). */
export interface ProjectView {
  available: boolean;
  cwd: string;
  workspaceRoot: string;
  peer: string;
  peerOrigin: string;
  pinnedPeer: string;
  pinnedPeerSource: string;
  declarations: WorkspaceDeclarationView[];
  warnings: string[];
  risks: ProjectRiskView[];
}
export interface RecallScopeView {
  scope: "all" | "actor";
  source: "env" | "workspace" | "plugin.dsh" | "plugin" | "default";
  envOverride: string;
  workspaceLayer: string;
  sharedScope: string;
  restartPending: boolean;
  project: ProjectView;
}

/** One display key per server-side isolation risk code. */
const RISK_KEYS: Record<string, TranslationKey> = {
  "workspace-scope-all": "riskScopeAll",
  "workspace-disables-recall": "riskRecallOff",
  "workspace-disables-capture": "riskCaptureOff",
  "pinned-peer": "riskPinnedPeer",
  "workspace-pins-peer": "riskWorkspacePeer",
  "peer-id-conflict": "riskPeerConflict",
  "no-peer": "riskNoPeer",
  "root-key-credential": "riskRootKey",
};

/** The isolation control's two modes, in render order: each owns a panel id. */
const ISOLATION_MODES = ["all", "actor"] as const;

/** The project-scoped part of the isolation card: a path field, the resolved
 * root/peer/scope, and the workspace declarations that outrank this file. It
 * is read-only except for the path, because this manager never writes a
 * workspace layer. */
function ProjectPanel(props: {
  scope: RecallScopeView;
  draft: string;
  busy: boolean;
  onDraft: (value: string) => void;
  onResolve: (event?: React.FormEvent) => void;
  t: Translation;
}) {
  const { scope, draft, busy, onDraft, onResolve, t } = props;
  return <>
    <form className="ovm-projectPath" onSubmit={(event) => void onResolve(event)}>
      <label>{t("projectPath")}
        <input value={draft} onChange={(event) => onDraft(event.target.value)} placeholder={scope.project.cwd} disabled={busy} />
      </label>
      <div className="ovm-actions"><button type="submit" disabled={busy}>{t("projectResolve")}</button></div>
    </form>
    <p className="ovm-hint">{t("projectPathHint")}</p>
    {scope.project.available ? null : <p className="ovm-warning" role="alert">{t("projectUnavailable")}</p>}
    <dl className="ovm-projectMeta">
      <div><dt>{t("projectRoot")}</dt><dd>{scope.project.workspaceRoot === "" ? t("projectNotInRepo") : scope.project.workspaceRoot}</dd></div>
      <div><dt>{t("projectPeer")}</dt><dd>{scope.project.peer === "" ? t("projectUserSpace") : scope.project.peer}</dd></div>
      <div><dt>{t("projectScope")}</dt><dd>{scope.scope === "actor" ? t("scopeActor") : t("scopeAll")} · {t(SOURCE_KEYS[scope.source] ?? "scopeSourceDefault")}</dd></div>
    </dl>
    {scope.project.declarations.length === 0
      ? <p className="ovm-hint">{t("projectNoDeclarations")}</p>
      : (
        <div className="ovm-declarations">
          <h3>{t("projectDeclarations")}</h3>
          <ul>{scope.project.declarations.map((item) => <li key={item.key}><code>{item.key}</code> = <code>{String(item.value)}</code> · {item.layer}</li>)}</ul>
        </div>
      )}
    {scope.project.warnings.length > 0
      ? <div className="ovm-warnings"><h3>{t("projectWarnings")}</h3><ul>{scope.project.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
      : null}
  </>;
}

/** The isolation switch and the project it applies to. Read-only except for
 * the switch (which the page saves) and the inspection path. */
export function IsolationCard(props: {
  scope: RecallScopeView;
  busy: boolean;
  initializing: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onResolve: (event?: React.FormEvent) => void;
  onScopeChange: (isolate: boolean) => void;
  t: Translation;
}) {
  const { scope, busy, initializing, draft, onDraft, onResolve, onScopeChange, t } = props;
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
        <ProjectPanel scope={scope} draft={draft} busy={busy} onDraft={onDraft} onResolve={onResolve} t={t} />
        {scope.project.risks.length > 0 ? (
          <div className="ovm-risks">
            <h3>{t("projectRisks")}</h3>
            <ul>
              {scope.project.risks.map((risk) => (
                <li key={risk.code} className={risk.severity === "error" ? "ovm-warning" : "ovm-hint"} role={risk.severity === "error" ? "alert" : undefined}>
                  {t(RISK_KEYS[risk.code] ?? "riskUnknown", risk.values ?? {})}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
  );
}
