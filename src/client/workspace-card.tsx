import { useState } from "react";
import { IconChevronDownOutlineRegular, Menu, type MenuItem } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Translation, TranslationKey } from "./i18n.js";

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

/** The three states a row can report. The filter menu reuses the row tag's
 * words so the control and the result cannot drift apart. */
const STATUSES = ["shared", "isolated", "user-level"] as const;
type WorkspaceStatus = typeof STATUSES[number];
type StatusFilter = "all" | WorkspaceStatus;

const STATUS_LABELS: Record<WorkspaceStatus, TranslationKey> = {
  shared: "workspaceTagShared",
  isolated: "workspaceTagIsolated",
  "user-level": "workspaceTagUserLevel",
};

const FILTER_CHOICES: Array<{ value: StatusFilter; label: TranslationKey }> = [
  { value: "all", label: "workspacesFilterAll" },
  ...STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
];

function statusOf(workspace: WorkspaceSummary): WorkspaceStatus {
  if (workspace.userLevelSpace) return "user-level";
  return workspace.sharedWith.length > 0 ? "shared" : "isolated";
}

/** Read-only inspection of the sidebar workspaces: which directories resolve
 * to the same peer, and which workspace keys override this machine. */
export function WorkspaceCard(props: { view: WorkspacesView; t: Translation }) {
  const { view, t } = props;
  // Both filters are local: typing must not reach the host, and the registry
  // list is small enough to filter on every keystroke.
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const needle = query.trim().toLocaleLowerCase();
  const currentFilter = t(FILTER_CHOICES.find((item) => item.value === status)?.label ?? "workspacesFilterAll");
  const filterItems: MenuItem[] = FILTER_CHOICES.map((item) => ({ id: item.value, label: t(item.label) }));
  const visible = view.workspaces.filter((workspace) =>
    (status === "all" || statusOf(workspace) === status)
    && (needle === "" || workspace.path.toLocaleLowerCase().includes(needle)));
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
                <div className="ovm-workspaceTools">
                  <input
                    className="ovm-workspaceSearch"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("workspacesSearch")}
                    aria-label={t("workspacesSearch")}
                  />
                  {/* The shell's own menu primitive, so this matches the
                      other rule pickers instead of the native popup. */}
                  <Menu
                    open={filterOpen}
                    align="end"
                    selection="check"
                    selectedId={status}
                    items={filterItems}
                    onClose={() => setFilterOpen(false)}
                    onSelect={(id: string) => {
                      setFilterOpen(false);
                      setStatus(id as StatusFilter);
                    }}
                    anchor={(
                      <button
                        type="button"
                        className="ovm-select ovm-filterSelect"
                        aria-haspopup="menu"
                        aria-expanded={filterOpen}
                        aria-label={t("workspacesFilter")}
                        onClick={() => setFilterOpen(!filterOpen)}
                      >
                        <span>{currentFilter}</span>
                        <IconChevronDownOutlineRegular size={14} />
                      </button>
                    )}
                  />
                </div>
                {visible.length === 0
                  ? <p className="ovm-hint">{needle === "" ? t("workspacesNoMatchStatus") : t("workspacesNoMatch", { query: query.trim() })}</p>
                  : (
                    <ul className="ovm-workspaces">
                      {visible.map((workspace) => {
                        const state = statusOf(workspace);
                        // The row keeps one line for the path and one for the
                        // peer: the status tag never sits between them, so a
                        // long path cannot be mistaken for the peer name.
                        const hint = state === "user-level"
                          ? t("workspaceUserLevelHint")
                          : state === "shared"
                            ? t("workspaceShares", { peers: workspace.sharedWith.join(", ") })
                            : t("workspaceIsolated");
                        return (
                          <li key={workspace.path}>
                            <div className="ovm-workspaceHead">
                              <code>{workspace.path}</code>
                              <span className={`ovm-tag ovm-tag${state === "user-level" ? "UserLevel" : state === "shared" ? "Shared" : "Isolated"}`} title={hint} aria-label={hint}>
                                {t(STATUS_LABELS[state])}
                              </span>
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
