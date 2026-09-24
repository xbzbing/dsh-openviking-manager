import { useEffect, useState } from "react";
import { browserLocale, createTranslation, type Translation } from "./i18n.js";

export interface ConfigView { url: string; account: string; user: string; apiKeySet: boolean; apiKeyMasked: string; }
interface ConfigResult { kind: "missing" | "invalid-json" | "invalid-shape" | "ready"; config: ConfigView; permissionWarning?: boolean; message?: string; }
interface DiscoveryResult { ovcli: ConfigResult; suggestedEndpoint: string; localServer: { found: boolean; authMode?: string; rootKeyAvailable: boolean; configError?: string }; }
interface ApiEnvelope { ok: boolean; value?: unknown; error?: string; code?: string; }
interface VersionView { current: string; repositoryUrl?: string; latest?: string; updateAvailable: boolean; releaseUrl?: string; checkedRemote: boolean; error?: string; }
interface RecallScopeView { scope: "all" | "actor"; source: "env" | "plugin.dsh" | "plugin" | "default"; envOverride: string; restartPending: boolean; }
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
  // without the route (older fixtures) keep their previous page shape.
  const loadRecallScope = async () => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`))).value as RecallScopeView;
      setRecallScope(value);
    } catch { setRecallScope(undefined); }
  };
  useEffect(() => { void load(); void loadVersion(); void loadRecallScope(); }, []);

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

  const setScope = async (allowSharing: boolean) => {
    // Optimistic flip: a controlled checkbox whose prop only changes after
    // the round-trip snaps back to its old state under the click, which reads
    // as "the toggle does nothing". Revert on failure instead.
    const previous = recallScope;
    setBusy(true);
    if (previous) setRecallScope({ ...previous, scope: allowSharing ? "all" : "actor" });
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: allowSharing ? "all" : "actor" }),
      }))).value as RecallScopeView;
      setRecallScope(value);
      setStatus(value.restartPending ? t("isolationSavedRestart") : t("isolationSaved"));
    } catch {
      if (previous) setRecallScope(previous);
      setStatus(t("isolationSaveFailed"));
    } finally { setBusy(false); }
  };

  const restartPlugin = async () => {
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope/restart`, { method: "POST" }))).value as RestartView;
      if (value.restarted) setStatus(t("restartSucceeded"));
      else if (value.reason === "plugin-unavailable") setStatus(t("restartUnavailable"));
      else setStatus(t("restartFailed", { error: value.error ?? value.reason ?? "unknown" }));
      await loadRecallScope();
    } catch (error) {
      setStatus(t("restartFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally { setBusy(false); }
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
              checked={recallScope.scope === "all"}
              onChange={(event) => void setScope(event.target.checked)}
            />
            <span className="ovm-switchTrack" aria-hidden="true" />
          </span>
          <span>{t("allowCrossTopicLabel")}</span>
        </label>
        <p className="ovm-hint ovm-isolationHint">{t("isolationHint")}</p>
        {recallScope.source === "env" ? <p className="ovm-warning" role="alert">{t("envOverrideWarning")}</p> : null}
        {recallScope.restartPending ? (
          <div className="ovm-restartRow">
            <p className="ovm-warning" role="alert">{t("restartRequired")}</p>
            <p className="ovm-hint">{t("restartSideEffects")}</p>
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
