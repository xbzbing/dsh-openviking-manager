import type { Translation } from "./i18n.js";

export interface WorkspaceSummary {
  path: string;
  workspaceRoot: string;
  peer: string;
  peerOrigin: string;
  sharedWith: string[];
  userLevelSpace: boolean;
  overrides: string[];
  risks: string[];
}

export interface WorkspacesView { available: boolean; truncated: boolean; workspaces: WorkspaceSummary[]; }

/** Read-only inspection of the sidebar workspaces: which directories resolve
 * to the same peer, and which workspace keys override this machine. */
export function WorkspaceCard(props: { view: WorkspacesView; t: Translation }) {
  const { view, t } = props;
  return (

      <section className="ovm-card" aria-label={t("workspacesTitle")}>
        {/* Folded by default: this is an inspection, not a setting, and the rows
            are long. Read-only either way — it answers "which of my workspaces
            share memories" as a session in each one would be resolved. */}
        <details className="ovm-collapse">
          <summary><h2>{t("workspacesTitle")}</h2></summary>
          <div className="ovm-collapseContent">
            <p className="ovm-hint">{t("workspacesHint")}</p>
            {view.truncated ? <p className="ovm-warning" role="alert">{t("workspacesTruncated")}</p> : null}
            {view.workspaces.length === 0
              ? <p className="ovm-hint">{t("workspacesEmpty")}</p>
              : (
                <ul className="ovm-workspaces">
                  {view.workspaces.map((workspace) => (
                    <li key={workspace.path}>
                      <div className="ovm-workspaceHead">
                        <code>{workspace.path}</code>
                        <span className={workspace.userLevelSpace ? "ovm-warning" : "ovm-hint"}>
                          {workspace.peer === "" ? t("projectUserSpace") : workspace.peer}
                        </span>
                      </div>
                      {workspace.sharedWith.length > 0
                        ? <p className="ovm-warning">{t("workspaceShares", { peers: workspace.sharedWith.join(", ") })}</p>
                        : <p className="ovm-hint">{t("workspaceIsolated")}</p>}
                      {workspace.overrides.length > 0
                        ? <p className="ovm-hint">{t("workspaceOverrides", { keys: workspace.overrides.join(", ") })}</p>
                        : null}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </details>
      </section>
  );
}
