import {
  IconChevronDownOutlineRegular,
  Menu,
  type MenuItem,
} from "@deepseek-ai/dsh-client-ui-primitives";
import type { Translation, TranslationKey } from "./i18n.js";
import { SOURCE_KEYS } from "./view-keys.js";

/** The `peer.source` rule: a policy, not a per-session value. */
export interface PeerSourceView {
  choice: "git" | "git-directory" | "cwd" | "none" | "custom";
  templates: string[];
  origin: "env" | "workspace" | "plugin.dsh" | "plugin" | "default";
  envOverride: string;
  sharedValue: string;
  recommended: "git" | "git-directory" | "cwd" | "none";
  needsAttention: boolean;
}

/** Which explanation fits the rule in force. The old single sentence only
 * described the `git` case, so `cwd` and `none` were warned about with copy
 * that named the opposite behaviour. */
function attentionKey(view: PeerSourceView): TranslationKey | undefined {
  if (!view.needsAttention) return undefined;
  if (view.templates.length === 0) return "peerSourceAttentionNone";
  const hasRepositoryIdentity = view.templates.some((item) => item.includes("{git_remote}") || item.includes("{git_root}"));
  const hasDirectoryFallback = view.templates.some((item) => item.includes("{cwd}") || item.includes("{dir}"));
  if (!hasRepositoryIdentity && hasDirectoryFallback) return "peerSourceAttentionCwd";
  if (hasRepositoryIdentity && !hasDirectoryFallback) return "peerSourceAttentionGit";
  return "peerSourceAttentionMixed";
}

export function PeerSourceCard(props: {
  view: PeerSourceView;
  busy: boolean;
  initializing: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: PeerSourceView["recommended"]) => void;
  t: Translation;
}) {
  const { view, busy, initializing, open, onOpenChange, onSelect, t } = props;
  const choices: Array<{ value: PeerSourceView["recommended"]; label: string }> = [
    { value: "git-directory", label: t("peerSourceGitDirectory") },
    { value: "git", label: t("peerSourceGit") },
    { value: "cwd", label: t("peerSourceCwd") },
    { value: "none", label: t("peerSourceNone") },
  ];
  const current = choices.find((item) => item.value === view.choice)
    ?? { value: "git" as const, label: t("peerSourceCustom") };
  const locked = busy || initializing || view.origin === "env" || view.origin === "workspace";
  const items: MenuItem[] = choices.map((item) => ({ id: item.value, label: item.label, disabled: locked }));
  const attention = attentionKey(view);
  return (
    <section className="ovm-card" aria-label={t("peerSourceTitle")}>
      <h2>{t("peerSourceTitle")}</h2>
      {/* A rule, not a per-session value: the official plugin derives one peer
          per session from that session's directory, so this decides the shape
          of every derivation rather than naming one project. */}
      <p className="ovm-hint">{t("peerSourceHint")}</p>
      <div className="ovm-field">
        <span className="ovm-fieldLabel" id="ovm-peer-source-label">{t("peerSourceLabel")}</span>
        <Menu
          open={open}
          align="start"
          selection="check"
          selectedId={view.choice}
          items={items}
          onClose={() => onOpenChange(false)}
          onSelect={(id: string) => {
            onOpenChange(false);
            if (id === view.choice) return;
            onSelect(id as PeerSourceView["recommended"]);
          }}
          anchor={(
            <button
              type="button"
              className="ovm-select"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-labelledby="ovm-peer-source-label"
              disabled={locked}
              onClick={() => onOpenChange(!open)}
            >
              <span>{current.label}</span>
              <IconChevronDownOutlineRegular size={14} />
            </button>
          )}
        />
      </div>
      <p className="ovm-hint ovm-ruleNote"><code>{view.templates.length === 0 ? "[]" : view.templates.join(" → ")}</code> · {t(SOURCE_KEYS[view.origin] ?? "scopeSourceDefault")}</p>
      {view.origin === "env" ? <p className="ovm-warning" role="alert">{t("envOverrideWarning", { variable: "OPENVIKING_PEER_SOURCE" })}</p> : null}
      {view.origin === "workspace" ? <p className="ovm-warning" role="alert">{t("tuningWorkspaceWarning", { keys: "peer.source" })}</p> : null}
      {view.sharedValue !== "" ? <p className="ovm-hint">{t("peerSourceSharedNote", { value: view.sharedValue })}</p> : null}
      {attention === undefined ? null : <p className="ovm-warning" role="alert">{t(attention)}</p>}
    </section>
  );
}
