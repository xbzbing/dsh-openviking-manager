import { useState } from "react";
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
  // Local-only filter: typing must not reach the host, and the registry list is
  // small enough to filter on every keystroke.
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const visible = needle === ""
    ? view.workspaces
    : view.workspaces.filter((workspace) => workspace.path.toLocaleLowerCase().includes(needle));
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
              <>
                <input
                  className="ovm-workspaceSearch"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("workspacesSearch")}
                  aria-label={t("workspacesSearch")}
                />
                {visible.length === 0
                  ? <p className="ovm-hint">{t("workspacesNoMatch", { query: query.trim() })}</p>
                  : (
                    <ul className="ovm-workspaces">
                      {visible.map((workspace) => {
                        const shared = workspace.sharedWith.length > 0;
                        // The row keeps one line for the path and one for the
                        // peer: the status tag never sits between them, so a
                        // long path cannot be mistaken for the peer name.
                        const tag = workspace.userLevelSpace
                          ? { label: t("workspaceTagUserLevel"), className: "ovm-tagUserLevel", hint: t("workspaceUserLevelHint") }
                          : shared
                            ? { label: t("workspaceTagShared"), className: "ovm-tagShared", hint: t("workspaceShares", { peers: workspace.sharedWith.join(", ") }) }
                            : { label: t("workspaceTagIsolated"), className: "ovm-tagIsolated", hint: t("workspaceIsolated") };
                        return (
                          <li key={workspace.path}>
                            <div className="ovm-workspaceHead">
                              <code>{workspace.path}</code>
                              <span className={`ovm-tag ${tag.className}`} title={tag.hint} aria-label={tag.hint}>{tag.label}</span>
                            </div>
                            <p className="ovm-workspacePeer">
                              <span className="ovm-workspacePeerLabel">{t("workspacePeerLabel")}</span>
                              <code>{workspace.peer === "" ? "—" : workspace.peer}</code>
                            </p>
                            {workspace.overrides.length > 0
                              ? <p className="ovm-hint">{t("workspaceOverrides", { keys: workspace.overrides.join(", ") })}</p>
                              : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </>
            )}
        </div>
      </details>
    </section>
  );
}
