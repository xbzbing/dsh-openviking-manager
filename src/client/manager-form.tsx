import { useEffect, useState } from "react";

export interface ConfigView {
  url: string;
  account: string;
  user: string;
  apiKeySet: boolean;
  apiKeyMasked: string;
}

interface ConfigResult {
  kind: "missing" | "invalid-json" | "invalid-shape" | "ready";
  config: ConfigView;
  permissionWarning?: boolean;
  message?: string;
}

interface DiscoveryResult {
  ovcli: ConfigResult;
  suggestedEndpoint: string;
  localServer: { found: boolean; authMode?: string; rootKeyAvailable: boolean; configError?: string };
}

interface ApiEnvelope {
  ok: boolean;
  value?: ConfigResult;
  error?: string;
}

export interface ManagerFormProps {
  apiPrefix?: string;
  fetchFn?: typeof fetch;
}

const fallback: ConfigView = { url: "http://127.0.0.1:1933", account: "", user: "", apiKeySet: false, apiKeyMasked: "" };

async function responseJson(response: Response): Promise<ApiEnvelope> {
  const value = (await response.json()) as ApiEnvelope;
  if (!response.ok || !value.ok) throw new Error(value.error ?? "OpenViking Manager request failed");
  return value;
}

function AdminIdentityForm(props: { label: string; submitLabel: string; disabled: boolean; defaultAccount?: string; defaultUser?: string; danger?: boolean; onSubmit: (accountId: string, userId: string) => void }) {
  const [accountId, setAccountId] = useState(props.defaultAccount ?? "");
  const [userId, setUserId] = useState(props.defaultUser ?? "");
  useEffect(() => { setAccountId(props.defaultAccount ?? ""); }, [props.defaultAccount]);
  useEffect(() => { setUserId(props.defaultUser ?? ""); }, [props.defaultUser]);
  return <form className="ovm-adminForm" onSubmit={(event) => { event.preventDefault(); props.onSubmit(accountId, userId); }}>
    <h3>{props.label}</h3>
    <label>Account ID<input required value={accountId} onChange={(event) => setAccountId(event.target.value)} /></label>
    <label>User ID<input required value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
    <button type="submit" className={props.danger ? "ovm-danger" : ""} disabled={props.disabled}>{props.submitLabel}</button>
  </form>;
}

export function ManagerForm({ apiPrefix = "/plugins/dsh-openviking-manager/api", fetchFn = fetch }: ManagerFormProps) {
  const [config, setConfig] = useState<ConfigView>(fallback);
  const [apiKey, setApiKey] = useState("");
  const [kind, setKind] = useState<ConfigResult["kind"] | "loading">("loading");
  const [permissionWarning, setPermissionWarning] = useState(false);
  const [localServer, setLocalServer] = useState<DiscoveryResult["localServer"] | undefined>();
  const [status, setStatus] = useState("Loading local OpenViking configuration…");
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
      const envelope = await responseJson(await fetchFn(`${apiPrefix}/discovery`));
      const discovery = envelope.value as unknown as DiscoveryResult;
      const next = discovery.ovcli;
      setConfig(next.kind === "ready" ? next.config : { ...next.config, url: discovery.suggestedEndpoint });
      setKind(next.kind);
      setPermissionWarning(next.permissionWarning === true);
      setLocalServer(discovery.localServer);
      setStatus(next.kind === "ready" ? "Configuration loaded." : next.message ?? "No usable ovcli.conf was found.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load configuration.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const envelope = await responseJson(
        await fetchFn(`${apiPrefix}/config`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...config, ...(apiKey === "" ? {} : { apiKey }) }),
        }),
      );
      const next = envelope.value!;
      setConfig(next.config);
      setApiKey("");
      setKind(next.kind);
      setPermissionWarning(false);
      setStatus("Configuration saved. The stored user key remains masked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save configuration.");
    } finally {
      setBusy(false);
    }
  };

  const repair = async () => {
    setBusy(true);
    try {
      const envelope = await responseJson(await fetchFn(`${apiPrefix}/repair-permissions`, { method: "POST" }));
      const next = envelope.value!;
      setConfig(next.config);
      setPermissionWarning(next.permissionWarning === true);
      setStatus("File permissions repaired.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to repair file permissions. Fix ~/.openviking/ovcli.conf manually.");
    } finally {
      setBusy(false);
    }
  };

  const adminCall = async (operation: string, fields: Record<string, string> = {}) => {
    if (rootApiKey.trim() === "") {
      setAdminStatus("Enter the root API key for this one-time management operation.");
      return;
    }
    setBusy(true);
    try {
      const envelope = await responseJson(await fetchFn(`${apiPrefix}/admin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation, rootApiKey, ...fields }),
      }));
      const value = envelope.value as unknown as { accounts?: Array<{ accountId: string }>; users?: Array<{ userId: string; role: string }>; created?: { accountId: string; userId: string; userKey: string }; userKey?: string };
      if (operation === "accounts") {
        const accounts = (value.accounts ?? []).map((item) => item.accountId);
        setAdminAccounts(accounts);
        setSelectedAccount(accounts[0] ?? "");
        setAdminUsers([]);
        setSelectedUser("");
        setAdminStatus(`Found ${accounts.length} account(s).`);
      } else if (operation === "users") {
        const users = value.users ?? [];
        setAdminUsers(users);
        setSelectedUser(users[0]?.userId ?? "");
        setAdminStatus(`Found ${users.length} user(s) in ${fields.accountId}.`);
      } else if (value.created) {
        setConfig({ ...config, account: value.created.accountId, user: value.created.userId });
        setApiKey(value.created.userKey);
        setSelectedAccount(value.created.accountId);
        setSelectedUser(value.created.userId);
        setRootApiKey("");
        setAdminStatus(`${operation} completed. The new user key is ready to save.`);
      } else if (value.userKey) {
        setApiKey(value.userKey);
        setRootApiKey("");
        setAdminStatus("Key rotated. Save the new user key on this device and update other devices.");
      }
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : "OpenViking admin request failed.");
    } finally {
      setBusy(false);
    }
  };

  const studioUrl = `${config.url.replace(/\/$/, "")}/studio`;
  const verify = async () => {
    setBusy(true);
    try {
      const envelope = await responseJson(
        await fetchFn(`${apiPrefix}/probe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey }),
        }),
      );
      const probe = envelope.value as unknown as { reachable: boolean; ready: boolean; authenticated: boolean; identity?: { account: string; user: string } };
      if (!probe.reachable) setStatus("OpenViking is unreachable at this endpoint.");
      else if (!probe.ready) setStatus("OpenViking is reachable but not ready.");
      else if (!probe.authenticated) setStatus("Service is ready, but the supplied user key was not accepted.");
      else setStatus(`Connected as ${probe.identity?.account}/${probe.identity?.user}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to verify OpenViking connection.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="ovm-shell">
      <header>
        <p className="ovm-eyebrow">OpenViking Manager</p>
        <h1>Connect your memory workspace</h1>
        <p className="ovm-intro">Manage the client configuration used by the official OpenViking memory plugin. Your existing API key is never shown here.</p>
      </header>
      <section className="ovm-card" aria-busy={busy}>
        <div className="ovm-status" role="status">{status}</div>
        {localServer?.found ? <p className="ovm-hint">Local server config found · auth mode: {localServer.authMode ?? "unknown"} · {localServer.rootKeyAvailable ? "local management is available" : "no local root key detected"}</p> : null}
        {localServer?.configError ? <p className="ovm-warning">{localServer.configError}</p> : null}
        {kind === "invalid-json" || kind === "invalid-shape" ? <p className="ovm-warning">The file needs repair before it can be safely reused. Enter the correct values and save a compatible configuration.</p> : null}
        {permissionWarning ? (
          <div className="ovm-warning" role="alert">
            <span>Configuration file permissions are broader than recommended.</span>
            <button type="button" onClick={() => void repair()} disabled={busy}>Repair file permissions</button>
          </div>
        ) : null}
        <form onSubmit={(event) => void save(event)}>
          <label>OpenViking endpoint<input required value={config.url} onChange={(event) => setConfig({ ...config, url: event.target.value })} placeholder="http://127.0.0.1:1933" /></label>
          <label>Account<input value={config.account} onChange={(event) => setConfig({ ...config, account: event.target.value })} /></label>
          <label>User<input value={config.user} onChange={(event) => setConfig({ ...config, user: event.target.value })} /></label>
          <label>New user key <span className="ovm-optional">(optional)</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config.apiKeySet ? `Existing key: ${config.apiKeyMasked}` : "Paste a user_key"} /></label>
          <p className="ovm-hint">Leave the key blank to preserve the existing key. This field accepts a user key, never a root API key.</p>
          <div className="ovm-actions"><button type="submit" disabled={busy}>Save configuration</button><button type="button" className="ovm-secondary" onClick={() => void verify()} disabled={busy}>Verify connection</button><a href={studioUrl} target="_blank" rel="noreferrer">Open Studio</a></div>
        </form>
      </section>
      <section className="ovm-card">
        <h2>Recover or initialize access</h2>
        <p className="ovm-hint">Use a root API key only for this management session. It is never saved to <code>ovcli.conf</code>.</p>
        <label>Temporary root API key<input type="password" value={rootApiKey} onChange={(event) => setRootApiKey(event.target.value)} placeholder="Paste root_api_key for this operation only" /></label>
        <div className="ovm-actions"><button type="button" className="ovm-secondary" disabled={busy} onClick={() => void adminCall("accounts")}>List accounts</button>{rootApiKey !== "" ? <button type="button" className="ovm-secondary" disabled={busy} onClick={() => { setRootApiKey(""); setAdminStatus("Temporary root API key cleared."); }}>Clear temporary root key</button> : null}</div>
        {adminAccounts.length > 0 ? <label>Existing account<select aria-label="Existing account" value={selectedAccount} onChange={(event) => { const accountId = event.target.value; setSelectedAccount(accountId); void adminCall("users", { accountId }); }}><option value="">Choose an account</option>{adminAccounts.map((account) => <option key={account} value={account}>{account}</option>)}</select></label> : null}
        {adminUsers.length > 0 ? <label>Existing user<select aria-label="Existing user" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Choose a user</option>{adminUsers.map((user) => <option key={user.userId} value={user.userId}>{user.userId} ({user.role})</option>)}</select></label> : null}
        {adminStatus !== "" ? <p className="ovm-status" role="status">{adminStatus}</p> : null}
        <div className="ovm-adminGrid">
          <AdminIdentityForm label="Create account and first user" submitLabel="Create account" disabled={busy} onSubmit={(accountId, userId) => void adminCall("create-account", { accountId, userId })} />
          <AdminIdentityForm label="Create user in current account" submitLabel="Create user" disabled={busy} defaultAccount={selectedAccount || config.account} onSubmit={(accountId, userId) => void adminCall("create-user", { accountId, userId })} />
          <AdminIdentityForm label="Regenerate an existing user key" submitLabel="Regenerate key" disabled={busy} defaultAccount={selectedAccount || config.account} defaultUser={selectedUser || config.user} danger onSubmit={(accountId, userId) => void adminCall("rotate-user-key", { accountId, userId })} />
        </div>
      </section>
    </main>
  );
}
