import { useEffect, useState } from "react";
import { browserLocale, createTranslation, type Translation } from "./i18n.js";

export interface ConfigView { url: string; account: string; user: string; apiKeySet: boolean; apiKeyMasked: string; }
interface ConfigResult { kind: "missing" | "invalid-json" | "invalid-shape" | "ready"; config: ConfigView; permissionWarning?: boolean; message?: string; }
interface DiscoveryResult { ovcli: ConfigResult; suggestedEndpoint: string; localServer: { found: boolean; authMode?: string; rootKeyAvailable: boolean; configError?: string }; }
interface ApiEnvelope { ok: boolean; value?: unknown; error?: string; code?: string; }
interface VersionView { current: string; repositoryUrl?: string; latest?: string; updateAvailable: boolean; releaseUrl?: string; checkedRemote: boolean; error?: string; }
interface RecallScopeView { scope: "all" | "actor"; source: "env" | "plugin.dsh" | "plugin" | "default"; envOverride: string; restartPending: boolean; }
interface RecallTuningKnobView<T> { value: T; source: "env" | "plugin.dsh" | "plugin" | "default"; configured: boolean; envOverride: string; envVar: string; default: T; pinned: boolean; }
interface RecallTuningView {
  scoreThreshold: RecallTuningKnobView<number>;
  recallLimit: RecallTuningKnobView<number>;
  recallQueryExpansion: RecallTuningKnobView<"auto" | "off">;
  recallExcludeUris: RecallTuningKnobView<string[]>;
  restartPending: boolean;
  /** Pinned knobs no layer supplies yet — written once on first load. */
  initPatch: { scoreThreshold?: number; recallLimit?: number; recallQueryExpansion?: "auto" | "off"; recallExcludeUris?: string[] };
}
/** Field state held between loads: a string so "empty" can mean "official
 * default" — which the server turns back into an absent key. */
interface RecallTuningDraft { scoreThreshold: string; recallLimit: string; recallQueryExpansion: "auto" | "off"; recallExcludeUris: string; }
interface RestartView { restarted: boolean; count: number; reason?: string; error?: string; }
export interface ManagerFormProps { apiPrefix?: string; fetchFn?: typeof fetch; t?: Translation; }

/** Mirrors ENDPOINT_NOT_CONFIGURED_CODE in src/manager-api.ts across the client boundary. */
const ENDPOINT_NOT_CONFIGURED = "endpoint-not-configured";

const fallback: ConfigView = { url: "http://127.0.0.1:1933", account: "", user: "", apiKeySet: false, apiKeyMasked: "" };

type AdminTab = "list-accounts" | "create-account" | "create-user" | "rotate-user-key";

const adminTabs: Array<{ id: AdminTab; title: "listAccounts" | "createAccount" | "createUser" | "regenerateKey" }> = [
  { id: "list-accounts", title: "listAccounts" },
  { id: "create-account", title: "createAccount" },
  { id: "create-user", title: "createUser" },
  { id: "rotate-user-key", title: "regenerateKey" },
];

async function responseJson(response: Response): Promise<ApiEnvelope> {
  const value = (await response.json()) as ApiEnvelope;
  if (!response.ok || !value.ok) {
    const error = new Error(value.error ?? "OpenViking Manager request failed") as Error & { code?: string };
    if (typeof value.code === "string") error.code = value.code;
    throw error;
  }
  return value;
}

function AdminIdentityForm(props: { title: string; submit: string; accountLabel: string; userLabel: string; disabled: boolean; defaultAccount?: string; defaultUser?: string; danger?: boolean; hint?: string; accountOptions?: string[]; chooseAccountLabel?: string; noAccountsLabel?: string; loadAccountsLabel?: string; onLoadAccounts?: () => void; onSubmit: (accountId: string, userId: string) => void }) {
  const [accountId, setAccountId] = useState(props.defaultAccount ?? "");
  const [userId, setUserId] = useState(props.defaultUser ?? "");
  useEffect(() => { setAccountId(props.defaultAccount ?? ""); }, [props.defaultAccount]);
  useEffect(() => { setUserId(props.defaultUser ?? ""); }, [props.defaultUser]);
  // Picking from existing accounts is only possible once they were listed; the
  // account must already exist, so there is nothing to create until then.
  const accountsMissing = props.accountOptions !== undefined && props.accountOptions.length === 0;
  return <form className="ovm-adminForm" onSubmit={(event) => { event.preventDefault(); props.onSubmit(accountId, userId); }}>
    <h3>{props.title}</h3>
    {props.hint === undefined ? null : <p className="ovm-hint">{props.hint}</p>}
    {props.accountOptions === undefined
      ? <label>{props.accountLabel}<input required value={accountId} onChange={(event) => setAccountId(event.target.value)} /></label>
      : accountsMissing
        ? <>
          <p className="ovm-hint">{props.noAccountsLabel}</p>
          <button type="button" className="ovm-secondary" disabled={props.disabled} onClick={() => props.onLoadAccounts?.()}>{props.loadAccountsLabel}</button>
        </>
        : <label>{props.accountLabel}<select required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">{props.chooseAccountLabel}</option>{props.accountOptions.map((account) => <option key={account} value={account}>{account}</option>)}</select></label>}
    <label>{props.userLabel}<input required value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
    <button type="submit" className={props.danger ? "ovm-danger" : ""} disabled={props.disabled || accountsMissing}>{props.submit}</button>
  </form>;
}

export function ManagerForm({ apiPrefix = "/plugins/dsh-openviking-manager/api", fetchFn = fetch, t = createTranslation(browserLocale()) }: ManagerFormProps) {
  const [config, setConfig] = useState<ConfigView>(fallback);
  const [apiKey, setApiKey] = useState("");
  const [kind, setKind] = useState<ConfigResult["kind"] | "loading">("loading");
  const [permissionWarning, setPermissionWarning] = useState(false);
  const [localServer, setLocalServer] = useState<DiscoveryResult["localServer"]>();
  const [status, setStatus] = useState(t("loading"));
  const [busy, setBusy] = useState(false);
  const [rootApiKey, setRootApiKey] = useState("");
  const [adminAccounts, setAdminAccounts] = useState<string[]>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ userId: string; role: string }>>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [adminStatus, setAdminStatus] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("list-accounts");
  const [version, setVersion] = useState<VersionView>();
  const [versionStatus, setVersionStatus] = useState("");
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [recallScope, setRecallScope] = useState<RecallScopeView>();
  const [recallTuning, setRecallTuning] = useState<RecallTuningView>();
  const [tuningDraft, setTuningDraft] = useState<RecallTuningDraft>({ scoreThreshold: "", recallLimit: "", recallQueryExpansion: "auto", recallExcludeUris: "" });

  const load = async () => {
    setBusy(true);
    try {
      const discovery = (await responseJson(await fetchFn(`${apiPrefix}/discovery`))).value as unknown as DiscoveryResult;
      const next = discovery.ovcli;
      setConfig(next.kind === "ready" ? next.config : { ...next.config, url: discovery.suggestedEndpoint });
      setKind(next.kind);
      setPermissionWarning(next.permissionWarning === true);
      setLocalServer(discovery.localServer);
      setStatus(next.kind === "ready" ? t("configurationLoaded") : next.message ?? t("noUsableConfig"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("unableLoad")); }
    finally { setBusy(false); }
  };
  const loadVersion = async () => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/version`))).value as VersionView;
      setVersion(value);
    } catch { /* version info is non-critical; leave the section hidden on failure */ }
  };
  // The isolation section only renders when this endpoint answers, so hosts
  // without the route (older fixtures) keep their previous page shape. After
  // an action, a transient failure instead keeps the current view on screen.
  const loadRecallScope = async (hideOnFailure = true): Promise<RecallScopeView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`))).value as RecallScopeView;
      setRecallScope(value);
      return value;
    } catch { if (hideOnFailure) setRecallScope(undefined); return undefined; }
  };
  // Same contract as the isolation section: a host without the route keeps its
  // previous page shape, and a failure after an action keeps the current view.
  const loadRecallTuning = async (hideOnFailure = true): Promise<RecallTuningView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning`))).value as RecallTuningView;
      setRecallTuning(value);
      return value;
    } catch { if (hideOnFailure) setRecallTuning(undefined); return undefined; }
  };

  useEffect(() => { void load(); void loadVersion(); void initializeRecallSettings(); }, []);

  // The draft follows the loaded view: an empty field means the key is absent,
  // so "clear the box" restores that knob's default — the product one when it
  // is pinned, the official one otherwise.
  useEffect(() => {
    if (!recallTuning) return;
    setTuningDraft({
      scoreThreshold: recallTuning.scoreThreshold.configured ? String(recallTuning.scoreThreshold.value) : "",
      recallLimit: recallTuning.recallLimit.configured ? String(recallTuning.recallLimit.value) : "",
      recallQueryExpansion: recallTuning.recallQueryExpansion.value,
      recallExcludeUris: recallTuning.recallExcludeUris.value.join("\n"),
    });
  }, [recallTuning]);

  const checkUpdates = async () => {
    setCheckingVersion(true);
    setVersionStatus(t("checkingUpdates"));
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/version?check=1`))).value as unknown as VersionView;
      setVersion(value);
      if (value.error !== undefined) setVersionStatus(t("updateCheckFailed", { error: value.error }));
      else if (value.updateAvailable && value.latest !== undefined) setVersionStatus(t("updateAvailable", { latest: value.latest, current: value.current }));
      else setVersionStatus(t("upToDate", { current: value.current }));
    } catch (error) {
      setVersionStatus(t("updateCheckFailed", { error: error instanceof Error ? error.message : "unknown" }));
    }
    finally { setCheckingVersion(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/config`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...config, ...(apiKey === "" ? {} : { apiKey }) }) }))).value as ConfigResult;
      setConfig(next.config); setApiKey(""); setKind(next.kind); setPermissionWarning(false); setStatus(t("configurationSaved"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("unableSave")); }
    finally { setBusy(false); }
  };

  /** POST the reload and settle the status line. Busy is owned by the caller:
   * this runs both from the automatic post-save path and the manual fallback
   * button shown when the automatic reload did not complete. */
  const runRestart = async () => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope/restart`, { method: "POST" }))).value as RestartView;
      if (value.restarted) setStatus(t("restartSucceeded"));
      else if (value.reason === "plugin-unavailable") setStatus(t("restartUnavailable"));
      else setStatus(t("restartFailed", { error: value.error ?? value.reason ?? "unknown" }));
    } catch (error) {
      setStatus(t("restartFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally {
      await loadRecallScope(false);
      await loadRecallTuning(false);
    }
  };

  const setScope = async (isolate: boolean) => {
    // Optimistic flip: a controlled checkbox whose prop only changes after
    // the round-trip snaps back to its old state under the click, which reads
    // as "the toggle does nothing". Revert on failure instead.
    const previous = recallScope;
    setBusy(true);
    if (previous) setRecallScope({ ...previous, scope: isolate ? "actor" : "all" });
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: isolate ? "actor" : "all" }),
      }))).value as RecallScopeView;
      setRecallScope(value);
      // The applied plugin only picks the value up through a reload, so a
      // changed file triggers one right away; the banner plus manual button
      // remain as the fallback when it does not complete.
      if (value.restartPending) {
        setStatus(t("reloading"));
        await runRestart();
      } else {
        setStatus(t("isolationSaved"));
      }
    } catch {
      if (previous) setRecallScope(previous);
      setStatus(t("isolationSaveFailed"));
    } finally { setBusy(false); }
  };

  /** First open of a config that still carries the official defaults pins the
   * product ones: the isolation switch's `actor`, the tuning knobs' 0.5 and
   * off. Both writes land before a single reload — two independent
   * initialisations would race the restart guard and reload the official
   * plugin twice — and a key some layer already supplied is never touched. */
  const initializeRecallSettings = async () => {
    const scope = await loadRecallScope(true);
    const tuning = await loadRecallTuning(true);
    const pinScope = scope?.source === "default";
    const tuningPatch = tuning?.initPatch ?? {};
    const pinTuning = Object.keys(tuningPatch).length > 0;
    if (!pinScope && !pinTuning) return;
    setBusy(true);
    let step: "scope" | "tuning" = "scope";
    try {
      let pending = false;
      if (pinScope) {
        const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: "actor" }),
        }))).value as RecallScopeView;
        setRecallScope(value);
        pending = pending || value.restartPending;
      }
      step = "tuning";
      if (pinTuning) {
        const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(tuningPatch),
        }))).value as RecallTuningView;
        setRecallTuning(value);
        pending = pending || value.restartPending;
      }
      if (pending) {
        setStatus(t("reloading"));
        await runRestart();
      }
    } catch (error) {
      setStatus(step === "scope"
        ? t("isolationSaveFailed")
        : t("tuningSaveFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally { setBusy(false); }
  };

  const restartPlugin = async () => {
    setBusy(true);
    try { await runRestart(); } finally { setBusy(false); }
  };

  /** Env vars currently outranking the file: those fields are read-only with
   * a warning rather than showing a file value that is not effective. */
  const tuningEnvVars = recallTuning === undefined
    ? []
    : [
        recallTuning.scoreThreshold,
        recallTuning.recallLimit,
        recallTuning.recallQueryExpansion,
        recallTuning.recallExcludeUris,
      ].filter((knob) => knob.source === "env").map((knob) => knob.envVar);

  const saveTuning = async (event: React.FormEvent) => {
    event.preventDefault();
    const tuning = recallTuning;
    if (!tuning) return;
    // An empty field restores the default rather than storing an empty value:
    // the product default (0.5) for the pinned threshold, the official default
    // — an absent key — for the item limit and the exclude list.
    const payload = {
      scoreThreshold: tuningDraft.scoreThreshold.trim() === ""
        ? (tuning.scoreThreshold.pinned ? tuning.scoreThreshold.default : null)
        : Number(tuningDraft.scoreThreshold),
      recallLimit: tuningDraft.recallLimit.trim() === "" ? null : Number(tuningDraft.recallLimit),
      recallQueryExpansion: tuningDraft.recallQueryExpansion,
      recallExcludeUris: tuningDraft.recallExcludeUris.split("\n").map((line) => line.trim()).filter(Boolean),
    };
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }))).value as RecallTuningView;
      setRecallTuning(value);
      // The applied plugin only reads these keys through a reload, so a changed
      // file triggers one right away; the banner plus manual button stay as the
      // fallback when it does not complete.
      if (value.restartPending) {
        setStatus(t("reloading"));
        await runRestart();
      } else {
        setStatus(t("tuningSaved"));
      }
    } catch (error) {
      setStatus(t("tuningSaveFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally {
      setBusy(false);
    }
  };

  const repair = async () => {
    setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/repair-permissions`, { method: "POST" }))).value as ConfigResult;
      setConfig(next.config); setPermissionWarning(next.permissionWarning === true); setStatus(t("permissionsRepaired"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("unableRepair")); }
    finally { setBusy(false); }
  };

  const adminCall = async (operation: string, fields: Record<string, string> = {}) => {
    if (rootApiKey.trim() === "") { setAdminStatus(t("rootKeyRequired")); return; }
    if (kind !== "ready") { setAdminStatus(t("endpointRequiredFirst")); return; }
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/admin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation, rootApiKey, ...fields }) }))).value as unknown as { accounts?: Array<{ accountId: string }>; users?: Array<{ userId: string; role: string }>; created?: { accountId: string; userId: string; userKey: string }; userKey?: string };
      if (operation === "accounts") {
        const accounts = (value.accounts ?? []).map((item) => item.accountId);
        setAdminAccounts(accounts); setSelectedAccount(accounts[0] ?? ""); setAdminUsers([]); setSelectedUser(""); setAdminStatus(t("foundAccounts", { count: accounts.length }));
      } else if (operation === "users") {
        const users = value.users ?? [];
        setAdminUsers(users); setSelectedUser(users[0]?.userId ?? ""); setAdminStatus(t("foundUsers", { count: users.length, account: fields.accountId ?? "" }));
      } else if (value.created) {
        setConfig({ ...config, account: value.created.accountId, user: value.created.userId }); setApiKey(value.created.userKey); setSelectedAccount(value.created.accountId); setSelectedUser(value.created.userId); setRootApiKey(""); setAdminStatus(t("adminOperationComplete", { operation }));
      } else if (value.userKey) {
        setApiKey(value.userKey); setRootApiKey(""); setAdminStatus(t("keyRotated"));
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      setAdminStatus(code === ENDPOINT_NOT_CONFIGURED ? t("endpointRequiredFirst") : error instanceof Error ? error.message : t("adminFailed"));
    }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const probe = (await responseJson(await fetchFn(`${apiPrefix}/probe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) }))).value as unknown as { reachable: boolean; ready: boolean; authenticated: boolean; identity?: { account: string; user: string } };
      if (!probe.reachable) setStatus(t("unreachable")); else if (!probe.ready) setStatus(t("notReady")); else if (!probe.authenticated) setStatus(t("keyNotAccepted")); else setStatus(t("connectedAs", { account: probe.identity?.account ?? "", user: probe.identity?.user ?? "" }));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("unreachable")); }
    finally { setBusy(false); }
  };

  const studioUrl = `${config.url.replace(/\/$/, "")}/studio`;
  return <main className="ovm-shell">
    <header className="ovm-header">
      <div className="ovm-headerMain">
        <p className="ovm-eyebrow">{t("eyebrow")}</p>
        <div className="ovm-titleRow"><h1>{t("title")}</h1>{version?.current !== undefined ? <span className="ovm-versionTag">v{version.current}</span> : null}</div>
        <p className="ovm-intro">{t("intro")}</p>
      </div>
      <aside className="ovm-about" aria-label={t("aboutTitle")}>
        <div className="ovm-aboutActions">
          {version?.repositoryUrl !== undefined ? <a href={version.repositoryUrl} title={version.repositoryUrl} target="_blank" rel="noreferrer">{t("openRepository")}</a> : null}
          <button type="button" className="ovm-secondary" onClick={() => void checkUpdates()} disabled={checkingVersion}>{t("checkUpdates")}</button>
          {version?.updateAvailable && version.releaseUrl !== undefined ? <a href={version.releaseUrl} target="_blank" rel="noreferrer">{t("viewRelease")}</a> : null}
        </div>
        {versionStatus !== "" ? <p className={version?.error !== undefined ? "ovm-warning" : "ovm-aboutStatus"} role="status">{versionStatus}</p> : null}
      </aside>
    </header>
    <section className="ovm-card" aria-busy={busy}>
      <div className="ovm-status" role="status">{status}</div>
      {localServer?.found ? <p className="ovm-hint">{t("localServerFound")} · {t("authMode")}: {localServer.authMode ?? "unknown"} · {localServer.rootKeyAvailable ? t("localManagementAvailable") : t("noLocalRootKey")}</p> : null}
      {localServer?.configError ? <p className="ovm-warning">{localServer.configError}</p> : null}
      {kind === "invalid-json" || kind === "invalid-shape" ? <p className="ovm-warning">{t("invalidConfig")}</p> : null}
      {permissionWarning ? <div className="ovm-warning" role="alert"><span>{t("invalidConfig")}</span><button type="button" onClick={() => void repair()} disabled={busy}>{t("repairPermissions")}</button></div> : null}
      <form onSubmit={(event) => void save(event)}>
        <label>{t("endpoint")}<input required value={config.url} onChange={(event) => setConfig({ ...config, url: event.target.value })} placeholder="http://127.0.0.1:1933" /></label>
        <label>{t("account")}<input value={config.account} onChange={(event) => setConfig({ ...config, account: event.target.value })} /></label>
        <label>{t("user")}<input value={config.user} onChange={(event) => setConfig({ ...config, user: event.target.value })} /></label>
        <label>{t("newUserKey")} <span className="ovm-optional">({t("optional")})</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config.apiKeySet ? t("existingKey", { key: config.apiKeyMasked }) : t("pasteUserKey")} /></label>
        <p className="ovm-hint">{t("keyHint")}</p><div className="ovm-actions"><button type="submit" disabled={busy}>{t("save")}</button><button type="button" className="ovm-secondary" onClick={() => void verify()} disabled={busy}>{t("verify")}</button><a href={studioUrl} target="_blank" rel="noreferrer">{t("openStudio")}</a></div>
      </form>
    </section>
    {recallScope === undefined ? null : (
      <section className="ovm-card" aria-label={t("isolationTitle")}>
        <h2>{t("isolationTitle")}</h2>
        <label className="ovm-switchRow">
          <span className="ovm-switchBox">
            <input
              type="checkbox"
              role="switch"
              className="ovm-switchInput"
              disabled={busy || recallScope.source === "env"}
              checked={recallScope.scope === "actor"}
              onChange={(event) => void setScope(event.target.checked)}
            />
            <span className="ovm-switchTrack" aria-hidden="true" />
          </span>
          <span>{t("isolateByTopicLabel")}</span>
        </label>
        <p className="ovm-hint ovm-isolationHint">{t("isolationHint")}</p>
        <p className="ovm-hint ovm-isolationHint">{t("reloadNotice")}</p>
        {recallScope.source === "env" ? <p className="ovm-warning" role="alert">{t("envOverrideWarning")}</p> : null}
        {recallScope.restartPending ? (
          <div className="ovm-restartRow">
            <p className="ovm-warning" role="alert">{t("restartRequired")}</p>
            <button type="button" onClick={() => void restartPlugin()} disabled={busy}>{t("restartPlugin")}</button>
          </div>
        ) : null}
      </section>
    )}
    {recallTuning === undefined ? null : (
      <section className="ovm-card" aria-label={t("tuningTitle")}>
        <h2>{t("tuningTitle")}</h2>
        <p className="ovm-hint ovm-tuningIntro">{t("tuningIntro")}</p>
        <form onSubmit={(event) => void saveTuning(event)}>
          <div className="ovm-tuningGrid">
            <div className="ovm-tuningField">
              <label>{t("scoreThresholdLabel")}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="any"
                  value={tuningDraft.scoreThreshold}
                  placeholder={t("defaultPlaceholder", { value: String(recallTuning.scoreThreshold.default) })}
                  disabled={busy || recallTuning.scoreThreshold.source === "env"}
                  onChange={(event) => setTuningDraft({ ...tuningDraft, scoreThreshold: event.target.value })}
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
                  value={tuningDraft.recallLimit}
                  placeholder={t("defaultPlaceholder", { value: String(recallTuning.recallLimit.default) })}
                  disabled={busy || recallTuning.recallLimit.source === "env"}
                  onChange={(event) => setTuningDraft({ ...tuningDraft, recallLimit: event.target.value })}
                />
              </label>
              <p className="ovm-hint">{t("recallLimitHint")}</p>
            </div>
            <div className="ovm-tuningField">
              <label>{t("queryExpansionLabel")}
                <select
                  value={tuningDraft.recallQueryExpansion}
                  disabled={busy || recallTuning.recallQueryExpansion.source === "env"}
                  onChange={(event) => setTuningDraft({ ...tuningDraft, recallQueryExpansion: event.target.value === "off" ? "off" : "auto" })}
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
                  value={tuningDraft.recallExcludeUris}
                  placeholder="viking://"
                  disabled={busy || recallTuning.recallExcludeUris.source === "env"}
                  onChange={(event) => setTuningDraft({ ...tuningDraft, recallExcludeUris: event.target.value })}
                />
              </label>
              <p className="ovm-hint">{t("excludeUrisHint")}</p>
            </div>
          </div>
          <p className="ovm-hint">{t("tuningReloadNotice")}</p>
          <div className="ovm-actions"><button type="submit" disabled={busy}>{t("saveTuning")}</button></div>
        </form>
        {tuningEnvVars.length > 0 ? <p className="ovm-warning" role="alert">{t("tuningEnvWarning", { vars: tuningEnvVars.join(", ") })}</p> : null}
        {recallTuning.restartPending ? (
          <div className="ovm-restartRow">
            <p className="ovm-warning" role="alert">{t("restartRequired")}</p>
            <button type="button" onClick={() => void restartPlugin()} disabled={busy}>{t("restartPlugin")}</button>
          </div>
        ) : null}
      </section>
    )}
    <section className="ovm-card"><details className="ovm-recovery"><summary><h2>{t("recoverTitle")}</h2></summary><div className="ovm-recoveryContent"><p className="ovm-hint">{t("recoverHint")}</p>
      {kind !== "ready" ? <p className="ovm-warning" role="alert">{t("endpointRequiredFirst")}</p> : null}
      <label>{t("temporaryRootKey")}<input type="password" value={rootApiKey} onChange={(event) => setRootApiKey(event.target.value)} placeholder={t("pasteRootKey")} /></label>
      {rootApiKey !== "" ? <div className="ovm-actions"><button type="button" className="ovm-secondary" disabled={busy} onClick={() => { setRootApiKey(""); setAdminStatus(t("rootKeyCleared")); }}>{t("clearRootKey")}</button></div> : null}
      {adminStatus !== "" ? <p className="ovm-status" role="status">{adminStatus}</p> : null}
      <div className="ovm-adminTabs" role="tablist" aria-label={t("recoverTitle")}>{adminTabs.map((tab) => <button key={tab.id} id={`ovm-tab-${tab.id}`} type="button" role="tab" aria-selected={activeAdminTab === tab.id} aria-controls={`ovm-panel-${tab.id}`} className={activeAdminTab === tab.id ? "ovm-adminTab ovm-adminTabActive" : "ovm-adminTab"} onClick={() => setActiveAdminTab(tab.id)}>{t(tab.title)}</button>)}</div>
      <div id="ovm-panel-list-accounts" role="tabpanel" aria-labelledby="ovm-tab-list-accounts" hidden={activeAdminTab !== "list-accounts"}><form className="ovm-adminForm" onSubmit={(event) => event.preventDefault()}>
        <h3>{t("listAccountsTitle")}</h3>
        <p className="ovm-hint">{t("listAccountsHint")}</p>
        <button type="button" className="ovm-secondary" disabled={busy} onClick={() => void adminCall("accounts")}>{t("listAccounts")}</button>
        {adminAccounts.length > 0 ? <label>{t("selectAccount")}<select aria-label={t("selectAccount")} value={selectedAccount} onChange={(event) => { const accountId = event.target.value; setSelectedAccount(accountId); void adminCall("users", { accountId }); }}><option value="">{t("chooseAccount")}</option>{adminAccounts.map((account) => <option key={account} value={account}>{account}</option>)}</select></label> : null}
        {adminUsers.length > 0 ? <label>{t("selectUser")}<select aria-label={t("selectUser")} value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">{t("chooseUser")}</option>{adminUsers.map((user) => <option key={user.userId} value={user.userId}>{user.userId} ({user.role})</option>)}</select></label> : null}
      </form></div>
      <div id="ovm-panel-create-account" role="tabpanel" aria-labelledby="ovm-tab-create-account" hidden={activeAdminTab !== "create-account"}><AdminIdentityForm title={t("createAccountTitle")} hint={t("createAccountHint")} submit={t("createAccount")} accountLabel={t("accountId")} userLabel={t("userId")} disabled={busy} onSubmit={(accountId, userId) => void adminCall("create-account", { accountId, userId })} /></div>
      <div id="ovm-panel-create-user" role="tabpanel" aria-labelledby="ovm-tab-create-user" hidden={activeAdminTab !== "create-user"}><AdminIdentityForm title={t("createUserTitle")} hint={t("createUserHint")} submit={t("createUser")} accountLabel={t("accountId")} userLabel={t("userId")} disabled={busy} accountOptions={adminAccounts} chooseAccountLabel={t("chooseAccount")} noAccountsLabel={t("noAccountsLoaded")} loadAccountsLabel={t("listAccounts")} onLoadAccounts={() => void adminCall("accounts")} defaultAccount={selectedAccount} onSubmit={(accountId, userId) => void adminCall("create-user", { accountId, userId })} /></div>
      <div id="ovm-panel-rotate-user-key" role="tabpanel" aria-labelledby="ovm-tab-rotate-user-key" hidden={activeAdminTab !== "rotate-user-key"}><AdminIdentityForm title={t("regenerateTitle")} hint={t("regenerateHint")} submit={t("regenerateKey")} accountLabel={t("accountId")} userLabel={t("userId")} disabled={busy} defaultAccount={selectedAccount || config.account} defaultUser={selectedUser || config.user} danger onSubmit={(accountId, userId) => void adminCall("rotate-user-key", { accountId, userId })} /></div>
    </div></details></section>
  </main>;
}
