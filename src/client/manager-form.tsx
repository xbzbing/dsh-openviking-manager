import { useEffect, useState } from "react";
import { browserLocale, createTranslation, type Translation } from "./i18n.js";

export interface ConfigView { url: string; account: string; user: string; apiKeySet: boolean; apiKeyMasked: string; }
interface ConfigResult { kind: "missing" | "invalid-json" | "invalid-shape" | "ready"; config: ConfigView; permissionWarning?: boolean; message?: string; }
interface DiscoveryResult { ovcli: ConfigResult; suggestedEndpoint: string; localServer: { found: boolean; authMode?: string; rootKeyAvailable: boolean; configError?: string }; }
interface ApiEnvelope { ok: boolean; value?: ConfigResult; error?: string; }
export interface ManagerFormProps { apiPrefix?: string; fetchFn?: typeof fetch; t?: Translation; }

const fallback: ConfigView = { url: "http://127.0.0.1:1933", account: "", user: "", apiKeySet: false, apiKeyMasked: "" };

async function responseJson(response: Response): Promise<ApiEnvelope> {
  const value = (await response.json()) as ApiEnvelope;
  if (!response.ok || !value.ok) throw new Error(value.error ?? "OpenViking Manager request failed");
  return value;
}

function AdminIdentityForm(props: { title: string; submit: string; accountLabel: string; userLabel: string; disabled: boolean; defaultAccount?: string; defaultUser?: string; danger?: boolean; onSubmit: (accountId: string, userId: string) => void }) {
  const [accountId, setAccountId] = useState(props.defaultAccount ?? "");
  const [userId, setUserId] = useState(props.defaultUser ?? "");
  useEffect(() => { setAccountId(props.defaultAccount ?? ""); }, [props.defaultAccount]);
  useEffect(() => { setUserId(props.defaultUser ?? ""); }, [props.defaultUser]);
  return <form className="ovm-adminForm" onSubmit={(event) => { event.preventDefault(); props.onSubmit(accountId, userId); }}>
    <h3>{props.title}</h3>
    <label>{props.accountLabel}<input required value={accountId} onChange={(event) => setAccountId(event.target.value)} /></label>
    <label>{props.userLabel}<input required value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
    <button type="submit" className={props.danger ? "ovm-danger" : ""} disabled={props.disabled}>{props.submit}</button>
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
  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/config`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...config, ...(apiKey === "" ? {} : { apiKey }) }) }))).value!;
      setConfig(next.config); setApiKey(""); setKind(next.kind); setPermissionWarning(false); setStatus(t("configurationSaved"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("unableSave")); }
    finally { setBusy(false); }
  };

  const repair = async () => {
    setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/repair-permissions`, { method: "POST" }))).value!;
      setConfig(next.config); setPermissionWarning(next.permissionWarning === true); setStatus(t("permissionsRepaired"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("unableRepair")); }
    finally { setBusy(false); }
  };

  const adminCall = async (operation: string, fields: Record<string, string> = {}) => {
    if (rootApiKey.trim() === "") { setAdminStatus(t("rootKeyRequired")); return; }
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
    } catch (error) { setAdminStatus(error instanceof Error ? error.message : t("adminFailed")); }
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
    <header><p className="ovm-eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p className="ovm-intro">{t("intro")}</p></header>
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
    <section className="ovm-card"><details className="ovm-recovery"><summary><h2>{t("recoverTitle")}</h2></summary><div className="ovm-recoveryContent"><p className="ovm-hint">{t("recoverHint")}</p>
      <label>{t("temporaryRootKey")}<input type="password" value={rootApiKey} onChange={(event) => setRootApiKey(event.target.value)} placeholder={t("pasteRootKey")} /></label>
      <div className="ovm-actions"><button type="button" className="ovm-secondary" disabled={busy} onClick={() => void adminCall("accounts")}>{t("listAccounts")}</button>{rootApiKey !== "" ? <button type="button" className="ovm-secondary" disabled={busy} onClick={() => { setRootApiKey(""); setAdminStatus(t("rootKeyCleared")); }}>{t("clearRootKey")}</button> : null}</div>
      {adminAccounts.length > 0 ? <label>{t("selectAccount")}<select aria-label={t("selectAccount")} value={selectedAccount} onChange={(event) => { const accountId = event.target.value; setSelectedAccount(accountId); void adminCall("users", { accountId }); }}><option value="">{t("chooseAccount")}</option>{adminAccounts.map((account) => <option key={account} value={account}>{account}</option>)}</select></label> : null}
      {adminUsers.length > 0 ? <label>{t("selectUser")}<select aria-label={t("selectUser")} value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">{t("chooseUser")}</option>{adminUsers.map((user) => <option key={user.userId} value={user.userId}>{user.userId} ({user.role})</option>)}</select></label> : null}
      {adminStatus !== "" ? <p className="ovm-status" role="status">{adminStatus}</p> : null}
      <div className="ovm-adminGrid"><AdminIdentityForm title={t("createAccountTitle")} submit={t("createAccount")} accountLabel={t("accountId")} userLabel={t("userId")} disabled={busy} onSubmit={(accountId, userId) => void adminCall("create-account", { accountId, userId })} /><AdminIdentityForm title={t("createUserTitle")} submit={t("createUser")} accountLabel={t("accountId")} userLabel={t("userId")} disabled={busy} defaultAccount={selectedAccount || config.account} onSubmit={(accountId, userId) => void adminCall("create-user", { accountId, userId })} /><AdminIdentityForm title={t("regenerateTitle")} submit={t("regenerateKey")} accountLabel={t("accountId")} userLabel={t("userId")} disabled={busy} defaultAccount={selectedAccount || config.account} defaultUser={selectedUser || config.user} danger onSubmit={(accountId, userId) => void adminCall("rotate-user-key", { accountId, userId })} /></div>
    </div></details></section>
  </main>;
}
