import type { Translation } from "./i18n.js";

export interface PeerIdView {
  peerId: string;
  source: "env" | "workspace" | "plugin.dsh" | "plugin" | "ovcli" | "default";
  envOverride: string;
  ovcliOverride: string;
  sharedPeerId: string;
  restartPending: boolean;
  project: unknown;
}

/** The advanced process-level pin. The page owns the draft and the requests;
 * this card renders the field, its hazard copy and the layer warnings. */
export function PeerIdCard(props: {
  view: PeerIdView;
  draft: string;
  locked: boolean;
  busy: boolean;
  onDraft: (value: string) => void;
  onSave: (event: React.FormEvent) => void;
  onFill: () => void;
  t: Translation;
}) {
  const { view, draft, locked, busy, onDraft, onSave, onFill, t } = props;
  return (

      <section className="ovm-card" aria-label={t("peerIdLabel")}>
        <details className="ovm-peerId ovm-collapse">
          <summary><h2>{t("peerIdLabel")}</h2></summary>
          <div className="ovm-collapseContent">
            <p className="ovm-hint">{t("peerIdHint")}</p>
            <form onSubmit={(event) => void onSave(event)}>
              <label>{t("peerIdLabel")}
                <input
                  value={view.source === "workspace" ? view.peerId : locked ? (view.envOverride || view.ovcliOverride) : draft}
                  placeholder={t("peerIdPlaceholder")}
                  disabled={busy || locked}
                  onChange={(event) => onDraft(event.target.value)}
                />
              </label>
              <div className="ovm-actions">
                <button type="button" className="ovm-secondary" disabled={busy || locked} onClick={() => void onFill()}>{t("fillCurrentRepo")}</button>
                <button type="submit" disabled={busy || locked}>{t("savePeerId")}</button>
              </div>
            </form>
            <p className="ovm-hint">{draft.trim() === "" ? t("peerIdHintEmpty") : t("peerIdHintSet")}</p>
            {draft.trim() === "" ? null : <p className="ovm-warning" role="alert">{t("peerIdHazard")}</p>}
            <p className="ovm-hint ovm-isolationHint">{t("peerIdMultiRepoNotice")}</p>
            <p className="ovm-hint">{t("peerIdReloadNotice")}</p>
          </div>
        </details>
        {/* Overrides sit outside the fold: a closed panel must not hide that the
            file value is not the effective one. */}
        {view.sharedPeerId !== "" ? <p className="ovm-warning" role="alert">{t("peerIdSharedClearNote", { value: view.sharedPeerId })}</p> : null}
        {view.source === "env" ? <p className="ovm-warning" role="alert">{t("peerIdEnvWarning")}</p> : null}
        {view.source === "ovcli" ? <p className="ovm-warning" role="alert">{t("peerIdCredentialWarning")}</p> : null}
        {view.source === "workspace" ? <p className="ovm-warning" role="alert">{t("tuningWorkspaceWarning", { keys: "peer.id" })}</p> : null}
      </section>
  );
}
