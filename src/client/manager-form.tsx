import { useEffect, useRef, useState } from "react";
import { SegmentedControl } from "@deepseek-ai/dsh-client-ui-primitives";
import { browserLocale, createTranslation, type Translation } from "./i18n.js";
import { PeerSourceCard, type PeerSourceView } from "./peer-source-card.js";
import { TuningCard, type RecallTuningDraft, type RecallTuningView } from "./tuning-card.js";
import { WorkspaceCard, type WorkspacesView } from "./workspace-card.js";
import { PeerIdCard, type PeerIdView } from "./peer-id-card.js";
import { IsolationCard, type RecallScopeView } from "./isolation-card.js";
import { setShowInputToggle } from "./ui-preferences.js";

export interface ConfigView { url: string; account: string; user: string; apiKeySet: boolean; apiKeyMasked: string; }
interface ConfigResult { kind: "missing" | "invalid-json" | "invalid-shape" | "ready"; config: ConfigView; permissionWarning?: boolean; message?: string; keyCleared?: boolean; }
interface DiscoveryResult { ovcli: ConfigResult; suggestedEndpoint: string; localServer: { found: boolean; authMode?: string; rootKeyAvailable: boolean; configError?: string }; }
interface ApiEnvelope { ok: boolean; value?: unknown; error?: string; code?: string; }
interface VersionView { current: string; repositoryUrl?: string; latest?: string; updateAvailable: boolean; releaseUrl?: string; checkedRemote: boolean; error?: string; }
interface RestartView { restarted: boolean; count: number; reason?: string; error?: string; }
/** The `/probe` route always writes every field; keep the shape explicit so a
 * new probe state cannot be silently ignored here. */
interface ProbeView {
  reachable: boolean;
  ready: boolean;
  authenticated: boolean;
  keyRejected: boolean;
  keyMissing: boolean;
  identity?: { account: string; user: string };
  /** Optional: older servers do not report a version from `/health`. */
  version?: string;
}
export interface ManagerFormProps { apiPrefix?: string; fetchFn?: typeof fetch; t?: Translation; }

/** The composer pill control's two choices, in render order: each owns a panel id. */
const INPUT_PILL_MODES = ["hide", "show"] as const;
/** Mirrors ENDPOINT_NOT_CONFIGURED_CODE in src/manager-api.ts across the client boundary. */
const ENDPOINT_NOT_CONFIGURED = "endpoint-not-configured";

const fallback: ConfigView = { url: "http://127.0.0.1:1933", account: "", user: "", apiKeySet: false, apiKeyMasked: "" };

type AdminTab = "list-accounts" | "create-account" | "create-user" | "rotate-user-key";

/** Shapes returned by the `/admin` route's `value` field, one per operation.
 * Each field is optional because a single handler reads whichever the current
 * operation produced. */
interface AdminResponse {
  accounts?: Array<{ accountId: string }>;
  users?: Array<{ userId: string; role: string }>;
  created?: { accountId: string; userId: string; userKey: string };
  userKey?: string;
}

const adminTabs: Array<{ id: AdminTab; title: "listAccounts" | "createAccount" | "createUser" | "regenerateKey" }> = [
  { id: "list-accounts", title: "listAccounts" },
  { id: "create-account", title: "createAccount" },
  { id: "create-user", title: "createUser" },
  { id: "rotate-user-key", title: "regenerateKey" },
];

async function responseJson(response: Response): Promise<ApiEnvelope> {
  // A proxy or a crashed route can answer with HTML. Parse the text once and
  // turn that into the status-bearing error the panel already displays,
  // instead of a JSON parse error that hides the status.
  const text = await response.text();
  let value: ApiEnvelope;
  try {
    value = JSON.parse(text) as ApiEnvelope;
  } catch {
    throw new Error(`OpenViking Manager request failed (${response.status})`);
  }
  if (!response.ok || !value.ok) {
    const error = new Error(value.error ?? "OpenViking Manager request failed") as Error & { code?: string };
    if (typeof value.code === "string") error.code = value.code;
    throw error;
  }
  return value;
}

interface AdminIdentityFormProps {
  title: string;
  submit: string;
  accountLabel: string;
  userLabel: string;
  disabled: boolean;
  defaultAccount?: string;
  defaultUser?: string;
  danger?: boolean;
  hint?: string;
  accountOptions?: string[];
  chooseAccountLabel?: string;
  noAccountsLabel?: string;
  loadAccountsLabel?: string;
  onLoadAccounts?: () => void;
  onSubmit: (accountId: string, userId: string) => void;
}

function AdminIdentityForm(props: AdminIdentityFormProps) {
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
  const [tuningDraft, setTuningDraft] = useState<RecallTuningDraft>({ scoreThreshold: "", recallLimit: "", recallQueryExpansion: "auto", recallExcludeUris: "", recallEventsDecayProtection: "", timeoutMs: "", recallContextTimeoutMs: "" });
  const [peerId, setPeerId] = useState<PeerIdView>();
  const [peerIdDraft, setPeerIdDraft] = useState("");
  // The knobs the user actually edited. Saving only these keeps an env- or
  // workspace-overridden value out of plugin.dsh: those fields are read-only,
  // but a save used to submit every draft and persist the override anyway.
  const [tuningDirty, setTuningDirty] = useState<Partial<Record<keyof RecallTuningDraft, true>>>({});
  // "" means "the directory the DSH host runs in", which is what the official
  // plugin resolved at apply. Any other value is a project the user wants to
  // inspect: peer derivation is per session, so it is exact for any path.
  const [projectCwd, setProjectCwd] = useState("");
  // The synchronous value behind projectCwd. A response for a directory the
  // user has already navigated away from must not overwrite the new project's
  // view, which is what the first-load pass did when a resolve raced it.
  const projectCwdRef = useRef("");
  const [projectDraft, setProjectDraft] = useState("");
  const [peerSource, setPeerSource] = useState<PeerSourceView>();
  const [workspaces, setWorkspaces] = useState<WorkspacesView>();
  /** Whether the composer shows the OpenViking pill; undefined hides the card
   * on hosts without the preferences route. */
  const [inputPill, setInputPill] = useState<boolean>();
  const [inputPillBusy, setInputPillBusy] = useState(false);
  const [inputPillStatus, setInputPillStatus] = useState("");
  /** Whether the host denies explicit mcp__openviking__remember calls; undefined
   * hides the card on hosts that do not serve the new preference yet. */
  const [rememberBlocked, setRememberBlocked] = useState<boolean>();
  const [rememberBusy, setRememberBusy] = useState(false);
  const [rememberStatus, setRememberStatus] = useState("");
  // The first-load pass pins product defaults and may reload the official
  // plugin. It runs on its own state: a slow or stuck reload must not leave the
  // connection form disabled, which is what a single shared `busy` did.
  const [initializing, setInitializing] = useState(false);
  // Verifying owns its own flag so the button reports work immediately instead
  // of looking dead while the request is in flight.
  const [verifying, setVerifying] = useState(false);
  /** Where "Verify connection" answers: beside its own button, not on the card's
   * status line, which the reload notices also write to. */
  const [verifyResult, setVerifyResult] = useState("");
  /** Server version from the same /health call that fed the probe. */
  const [verifyVersion, setVerifyVersion] = useState("");
  /** The rule dropdown is the platform Menu, which is controlled. */
  const [ruleMenuOpen, setRuleMenuOpen] = useState(false);
  // The status line has two kinds of writer: what the user just did, and the
  // first-load pass reloading the plugin behind their back. The background one
  // records the generation it started at and stays quiet if a foreground report
  // has landed since, so a slow reload cannot replace "Connected as …".
  const statusGeneration = useRef(0);

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
  const cwdQuery = (cwd: string): string => (cwd === "" ? "" : `?cwd=${encodeURIComponent(cwd)}`);
  const loadRecallScope = async (hideOnFailure = true, cwd = projectCwd): Promise<RecallScopeView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope${cwdQuery(cwd)}`))).value as RecallScopeView;
      if (projectCwdRef.current !== cwd) return undefined;
      setRecallScope(value);
      return value;
    } catch { if (hideOnFailure) setRecallScope(undefined); return undefined; }
  };
  // Same contract as the isolation section: a host without the route keeps its
  // previous page shape, and a failure after an action keeps the current view.
  const loadRecallTuning = async (hideOnFailure = true, cwd = projectCwd): Promise<RecallTuningView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning${cwdQuery(cwd)}`))).value as RecallTuningView;
      if (projectCwdRef.current !== cwd) return undefined;
      setRecallTuning(value);
      return value;
    } catch { if (hideOnFailure) setRecallTuning(undefined); return undefined; }
  };
  // Same contract again: a host without the route keeps its previous page
  // shape, and a failure after an action keeps the current view.
  const loadPeerId = async (hideOnFailure = true, cwd = projectCwd): Promise<PeerIdView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-peer${cwdQuery(cwd)}`))).value as PeerIdView;
      if (projectCwdRef.current !== cwd) return undefined;
      setPeerId(value);
      return value;
    } catch { if (hideOnFailure) setPeerId(undefined); return undefined; }
  };

  const loadPreferences = async () => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/ui-preferences`))).value as {
        showInputToggle?: boolean;
        disableMcpRemember?: boolean;
      };
      setInputPill(typeof value.showInputToggle === "boolean" ? value.showInputToggle : undefined);
      setRememberBlocked(typeof value.disableMcpRemember === "boolean" ? value.disableMcpRemember : undefined);
    } catch {
      setInputPill(undefined);
      setRememberBlocked(undefined);
    }
  };
  const saveInputPill = async (show: boolean) => {
    const previous = inputPill;
    setInputPill(show);
    setInputPillBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/ui-preferences`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ showInputToggle: show }),
      }))).value as { showInputToggle: boolean };
      setInputPill(value.showInputToggle);
      // The composer pill reads the same page-wide value, so it follows at once.
      setShowInputToggle(value.showInputToggle);
      setInputPillStatus(t("inputPillSaved"));
    } catch {
      setInputPill(previous);
      setInputPillStatus(t("inputPillSaveFailed"));
    } finally { setInputPillBusy(false); }
  };
  const saveRememberBlocked = async (blocked: boolean) => {
    const previous = rememberBlocked;
    setRememberBlocked(blocked);
    setRememberBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/ui-preferences`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disableMcpRemember: blocked }),
      }))).value as { disableMcpRemember?: boolean };
      if (typeof value.disableMcpRemember !== "boolean") throw new Error("invalid preferences response");
      setRememberBlocked(value.disableMcpRemember);
      setRememberStatus(t("rememberSaved"));
    } catch {
      setRememberBlocked(previous);
      setRememberStatus(t("rememberSaveFailed"));
    } finally { setRememberBusy(false); }
  };

  useEffect(() => {
    void load();
    void loadVersion();
    void loadPreferences();
    // The init pass reads the isolation switch, the tuning knobs and the
    // peer-source rule itself; reading the rule again here would race it, and a
    // late read could overwrite the value a save just wrote.
    void initializeRecallSettings();
    void loadPeerId();
    void loadWorkspaces();
  }, []);

  // The peer id draft follows the loaded view: an empty box means "no
  // plugin.peerId", which restores the automatic per-repository derivation.
  useEffect(() => {
    if (!peerId) return;
    setPeerIdDraft(peerId.source === "plugin" || peerId.source === "plugin.dsh" ? peerId.peerId : "");
  }, [peerId]);

  // The draft follows the loaded view: an empty field means the key is absent,
  // so "clear the box" restores that knob's default — the product one when it
  // is pinned, the official one otherwise.
  useEffect(() => {
    if (!recallTuning) return;
    setTuningDirty({});
    setTuningDraft({
      scoreThreshold: recallTuning.scoreThreshold.configured ? String(recallTuning.scoreThreshold.value) : "",
      recallLimit: recallTuning.recallLimit.configured ? String(recallTuning.recallLimit.value) : "",
      recallQueryExpansion: recallTuning.recallQueryExpansion.value,
      recallExcludeUris: recallTuning.recallExcludeUris.value.join("\n"),
      recallEventsDecayProtection: recallTuning.recallEventsDecayProtection.configured ? recallTuning.recallEventsDecayProtection.value : "",
      timeoutMs: recallTuning.timeoutMs.configured ? String(recallTuning.timeoutMs.value) : "",
      recallContextTimeoutMs: recallTuning.recallContextTimeoutMs.configured ? String(recallTuning.recallContextTimeoutMs.value) : "",
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
      setConfig(next.config); setApiKey(""); setKind(next.kind); setPermissionWarning(false); reportForeground(next.keyCleared === true ? t("endpointKeyCleared") : t("configurationSaved"));
    } catch (error) { reportForeground(error instanceof Error ? error.message : t("unableSave")); }
    finally { setBusy(false); }
  };

  /** A report the user asked for: it takes the status line over, and any
   * background notice still in flight stays quiet instead of replacing it. */
  const reportForeground = (text: string) => {
    statusGeneration.current += 1;
    setStatus(text);
  };

  /** POST the reload and settle the status line. Busy is owned by the caller:
   * this runs from every path that changed a key: the save handlers and the
   * first-load initialisation; a reload that does not complete is reported on
   * the status line. A background run reports only while nothing the user did
   * has taken the line over since it started. */
  const runRestart = async (background = false) => {
    const startedAt = statusGeneration.current;
    const report = (text: string) => {
      if (background && statusGeneration.current !== startedAt) return;
      if (background) setStatus(text); else reportForeground(text);
    };
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope/restart`, { method: "POST" }))).value as RestartView;
      if (value.restarted) report(t("restartSucceeded"));
      else if (value.reason === "plugin-unavailable") report(t("restartUnavailable"));
      else if (value.reason === "restart-timeout") report(t("restartTimeout"));
      else report(t("restartFailed", { error: value.error ?? value.reason ?? "unknown" }));
    } catch (error) {
      report(t("restartFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally {
      await loadRecallScope(false);
      await loadRecallTuning(false);
      await loadPeerId(false);
      await loadPeerSource(false);
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
      // changed file triggers one right away; a reload that does not complete
      // is reported on the status line.
      if (value.restartPending) {
        reportForeground(t("reloading"));
        await runRestart();
      } else {
        reportForeground(t("isolationSaved"));
      }
    } catch {
      if (previous) setRecallScope(previous);
      reportForeground(t("isolationSaveFailed"));
    } finally { setBusy(false); }
  };

  /** First open of a config that still carries the official defaults pins the
   * product ones: the isolation switch's `actor`, the tuning knobs' 0.5 and
   * off. Both writes land before a single reload — two independent
   * initialisations would race the restart guard and reload the official
   * plugin twice — and a key some layer already supplied is never touched. */
  const initializeRecallSettings = async () => {
    const scope = await loadRecallScope(true, projectCwd);
    const tuning = await loadRecallTuning(true, projectCwd);
    const source = await loadPeerSource(true, projectCwd);
    const pinScope = scope?.source === "default";
    const tuningPatch = tuning?.initPatch ?? {};
    const pinTuning = Object.keys(tuningPatch).length > 0;
    // The peer-source rule decides whether a workspace that is not a git
    // repository gets a namespace at all, so it is pinned like the other
    // product defaults rather than left to the official `git` default.
    const pinSource = source?.origin === "default";
    if (!pinScope && !pinTuning && !pinSource) return;
    setInitializing(true);
    let step: "scope" | "tuning" | "peer-source" = "scope";
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
      step = "peer-source";
      if (pinSource) {
        // One write only: the reload below picks every key up at once.
        const value = (await responseJson(await fetchFn(`${apiPrefix}/peer-source`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ peerSource: source?.recommended }),
        }))).value as PeerSourceView;
        setPeerSource(value);
        pending = true;
      }
      if (pending) {
        setStatus(t("reloading"));
        await runRestart(true);
        await loadWorkspaces();
      }
    } catch (error) {
      reportForeground(step === "scope"
        ? t("isolationSaveFailed")
        : step === "peer-source"
          ? t("peerSourceSaveFailed", { error: error instanceof Error ? error.message : "unknown" })
          : t("tuningSaveFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally { setInitializing(false); }
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
        recallTuning.recallEventsDecayProtection,
        recallTuning.timeoutMs,
        recallTuning.recallContextTimeoutMs,
      ].filter((knob) => knob.source === "env").map((knob) => knob.envVar);

  /** Workspace layers currently outranking this file, for the warning line. */
  const tuningWorkspaceLayers = recallTuning === undefined
    ? []
    : [...new Set([
        recallTuning.scoreThreshold,
        recallTuning.recallLimit,
        recallTuning.recallQueryExpansion,
        recallTuning.recallExcludeUris,
        recallTuning.recallEventsDecayProtection,
        recallTuning.timeoutMs,
        recallTuning.recallContextTimeoutMs,
      ].filter((knob) => knob.source === "workspace").map((knob) => knob.workspaceLayer).filter(Boolean))];

  /** Mark one knob as edited. Only these keys are submitted, so a value that
   * an env var or a workspace file currently overrides never gets copied into
   * plugin.dsh by an unrelated save. */
  const markTuning = (key: keyof RecallTuningDraft): void => {
    setTuningDirty((current) => (current[key] === true ? current : { ...current, [key]: true }));
  };

  const changeTuning = (key: keyof RecallTuningDraft, value: string): void => {
    markTuning(key);
    setTuningDraft((current) => ({ ...current, [key]: value }));
  };

  const saveTuning = async (event: React.FormEvent) => {
    event.preventDefault();
    const tuning = recallTuning;
    if (!tuning) return;
    const dirty = Object.keys(tuningDirty) as Array<keyof RecallTuningDraft>;
    if (dirty.length === 0) return;
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
      recallEventsDecayProtection: tuningDraft.recallEventsDecayProtection.trim() === ""
        ? null
        : tuningDraft.recallEventsDecayProtection.trim(),
      timeoutMs: tuningDraft.timeoutMs.trim() === ""
        ? (tuning.timeoutMs.pinned ? tuning.timeoutMs.default : null)
        : Number(tuningDraft.timeoutMs),
      recallContextTimeoutMs: tuningDraft.recallContextTimeoutMs.trim() === "" ? null : Number(tuningDraft.recallContextTimeoutMs),
    };
    const submitted = Object.fromEntries(dirty.map((key) => [key, payload[key]]));
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submitted),
      }))).value as RecallTuningView;
      setRecallTuning(value);
      // The applied plugin only reads these keys through a reload, so a changed
      // file triggers one right away; a reload that does not complete is
      // reported on the status line.
      if (value.restartPending) {
        reportForeground(t("reloading"));
        await runRestart();
      } else {
        reportForeground(t("tuningSaved"));
      }
    } catch (error) {
      reportForeground(t("tuningSaveFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally {
      setBusy(false);
    }
  };

  /** Env or a top-level credential currently outranks plugin.peerId: the field
   * is read-only then, with a warning, rather than showing a value that would
   * not take effect. */
  const peerIdLocked = peerId !== undefined && (peerId.source === "env" || peerId.source === "ovcli" || peerId.source === "workspace");

  const savePeerIdValue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!peerId) return;
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-peer`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ peerId: peerIdDraft.trim() }),
      }))).value as PeerIdView;
      setPeerId(value);
      // The applied plugin only reads the peer through a reload, so a changed
      // file triggers one right away; an incomplete reload is reported on the
      // status line.
      if (value.restartPending) {
        reportForeground(t("reloading"));
        await runRestart();
      } else {
        reportForeground(t("peerIdSaved"));
      }
    } catch (error) {
      reportForeground(t("peerIdSaveFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally {
      setBusy(false);
    }
  };

  /** The `peer.source` rule and the sidebar workspaces it applies to: a policy
   * plus a read-only inspection, neither of them per-session state. */
  const loadPeerSource = async (hideOnFailure = true, cwd = projectCwd): Promise<PeerSourceView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/peer-source${cwdQuery(cwd)}`))).value as PeerSourceView;
      if (projectCwdRef.current !== cwd) return undefined;
      setPeerSource(value);
      return value;
    } catch { if (hideOnFailure) setPeerSource(undefined); return undefined; }
  };
  const loadWorkspaces = async (): Promise<WorkspacesView | undefined> => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/workspaces`))).value as WorkspacesView;
      setWorkspaces(value);
      return value;
    } catch { setWorkspaces(undefined); return undefined; }
  };
  const savePeerSource = async (choice: PeerSourceView["recommended"]) => {
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/peer-source`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ peerSource: choice }),
      }))).value as PeerSourceView;
      setPeerSource(value);
      // A rule change only reaches the running plugin through a reload.
      reportForeground(t("reloading"));
      await runRestart();
      await loadWorkspaces();
    } catch (error) {
      reportForeground(t("peerSourceSaveFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally { setBusy(false); }
  };

  /** Re-resolve every project-scoped view for another directory. The peer
   * rule is a policy, but its workspace declaration is project-scoped too, so
   * it follows the same path. */
  const applyProject = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const next = projectDraft.trim();
    setBusy(true);
    try {
      projectCwdRef.current = next;
      setProjectCwd(next);
      await Promise.all([
        loadRecallScope(false, next),
        loadRecallTuning(false, next),
        loadPeerId(false, next),
        loadPeerSource(false, next),
      ]);
      reportForeground(t("projectResolved"));
    } finally { setBusy(false); }
  };

  const fillCurrentRepo = async () => {
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-peer/derive${cwdQuery(projectCwd)}`))).value as { peerId: string; origin?: string };
      if (value.peerId === "") reportForeground(t("peerIdNotInRepo"));
      else { setPeerIdDraft(value.peerId); reportForeground(t("peerIdDetected", { peerId: value.peerId })); }
    } catch (error) {
      reportForeground(error instanceof Error ? error.message : t("peerIdNotInRepo"));
    } finally { setBusy(false); }
  };

  const repair = async () => {
    setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/repair-permissions`, { method: "POST" }))).value as ConfigResult;
      setConfig(next.config); setPermissionWarning(next.permissionWarning === true); reportForeground(t("permissionsRepaired"));
    } catch (error) { reportForeground(error instanceof Error ? error.message : t("unableRepair")); }
    finally { setBusy(false); }
  };

  const adminCall = async (operation: string, fields: Record<string, string> = {}) => {
    if (rootApiKey.trim() === "") { setAdminStatus(t("rootKeyRequired")); return; }
    if (kind !== "ready") { setAdminStatus(t("endpointRequiredFirst")); return; }
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/admin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation, rootApiKey, ...fields }) }))).value as AdminResponse;
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
    setVerifying(true);
    // A click must always change the page: the request below can take as long
    // as the server's own timeout, and the button renames itself meanwhile.
    // The previous answer is cleared so a stale one never sits beside "Verifying…".
    setVerifyResult("");
    setVerifyVersion("");
    try {
      const probe = (await responseJson(await fetchFn(`${apiPrefix}/probe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) }))).value as unknown as ProbeView;
      if (typeof probe.version === "string" && probe.version !== "") setVerifyVersion(probe.version);
      if (!probe.reachable) setVerifyResult(t("unreachable"));
      // Missing or rejected credentials are credential problems, not readiness
      // problems: the service answered the probe, so do not make the user wait
      // for /ready before telling them what to fix.
      else if (probe.keyMissing) setVerifyResult(t("keyRequired"));
      else if (probe.keyRejected) setVerifyResult(t("keyNotAccepted"));
      else if (probe.authenticated) {
        // A successful /status is the authoritative authentication result.
        // Hosted gateways may not expose /ready to user keys; report the
        // connection and warn about readiness instead of failing the whole
        // verification.
        const account = probe.identity?.account || config.account;
        const user = probe.identity?.user ?? "";
        // Neither half can be assumed present: joining blindly rendered
        // "personal/" when the data plane reported only a user.
        const identity = [account, user].filter((part) => part !== "").join("/");
        if (identity === "") setVerifyResult(t("connectedNoIdentity"));
        else if (probe.ready) setVerifyResult(t("connectedAs", { identity }));
        else setVerifyResult(t("connectedNotReady", { identity }));
      }
      // Reachable and ready, yet the key could not be confirmed: /status failed
      // or answered without JSON. Saying "key not accepted" would send the user
      // to rotate a key that was never rejected.
      else if (!probe.ready) setVerifyResult(t("notReady"));
      else setVerifyResult(t("verifyInconclusive"));
    } catch (error) { setVerifyResult(error instanceof Error ? error.message : t("unreachable")); }
    finally { setVerifying(false); }
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
      {localServer?.found ? <p className="ovm-hint">{t("localServerFound")} · {t("authMode")}: {localServer.authMode ?? t("authModeUnknown")} · {localServer.rootKeyAvailable ? t("localManagementAvailable") : t("noLocalRootKey")}</p> : null}
      {localServer?.configError ? <p className="ovm-warning">{localServer.configError}</p> : null}
      {kind === "invalid-json" || kind === "invalid-shape" ? <p className="ovm-warning">{t("invalidConfig")}</p> : null}
      {permissionWarning ? <div className="ovm-warning" role="alert"><span>{t("invalidConfig")}</span><button type="button" onClick={() => void repair()} disabled={busy}>{t("repairPermissions")}</button></div> : null}
      <form onSubmit={(event) => void save(event)}>
        <label>{t("endpoint")}<input required value={config.url} onChange={(event) => setConfig({ ...config, url: event.target.value })} placeholder="http://127.0.0.1:1933" /></label>
        <label>{t("account")}<input value={config.account} onChange={(event) => setConfig({ ...config, account: event.target.value })} /></label>
        <label>{t("user")}<input value={config.user} onChange={(event) => setConfig({ ...config, user: event.target.value })} /></label>
        <label>{t("newUserKey")} <span className="ovm-optional">({t("optional")})</span><input type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setVerifyResult(""); setVerifyVersion(""); }} placeholder={config.apiKeySet ? t("existingKey", { key: config.apiKeyMasked }) : t("pasteUserKey")} /></label>
        <p className="ovm-hint">{t("keyHint")}</p>
        <div className="ovm-actions">
          <button type="submit" disabled={busy}>{t("save")}</button>
          <button type="button" className="ovm-secondary" onClick={() => void verify()} disabled={verifying} aria-busy={verifying}>{verifying ? t("verifying") : t("verify")}</button>
          {/* The answer stays beside the button that asked: on the card's status
              line it competes with the reload notices above. `aria-live`
              announces it as it lands. */}
          <span className="ovm-verifyGroup">
            <span className="ovm-verifyResult" aria-live="polite">{verifyResult}</span>
            {verifyVersion !== "" ? <span className="ovm-verifyVersion">{t("serverVersion", { version: verifyVersion })}</span> : null}
          </span>
          <a href={studioUrl} target="_blank" rel="noreferrer">{t("openStudio")}</a>
        </div>
      </form>
    </section>
    {inputPill === undefined ? null : (
      <section className="ovm-card" aria-label={t("inputPillTitle")}>
        <h2>{t("inputPillTitle")}</h2>
        <SegmentedControl
          id="ovm-inputPill"
          label={t("inputPillLabel")}
          value={inputPill ? "show" : "hide"}
          disabled={inputPillBusy}
          options={[
            { value: "hide", label: t("inputPillHide") },
            { value: "show", label: t("inputPillShow") },
          ]}
          onChange={(next: string) => void saveInputPill(next === "show")}
        />
        {INPUT_PILL_MODES.map((mode) => (
          <div
            key={mode}
            id={`ovm-inputPill-${mode}-panel`}
            role="tabpanel"
            aria-labelledby={`ovm-inputPill-${mode}`}
            hidden={(inputPill ? "show" : "hide") !== mode}
          >
            <p className="ovm-hint ovm-isolationHint">{t("inputPillHint")}</p>
          </div>
        ))}
        {inputPillStatus !== "" ? <p className="ovm-status" role="status">{inputPillStatus}</p> : null}
      </section>
    )}
    {rememberBlocked === undefined ? null : (
      <section className="ovm-card" aria-label={t("rememberTitle")}>
        <h2>{t("rememberTitle")}</h2>
        <SegmentedControl
          id="ovm-remember"
          label={t("rememberLabel")}
          value={rememberBlocked ? "blocked" : "allowed"}
          disabled={rememberBusy}
          options={[
            { value: "allowed", label: t("rememberAllow") },
            { value: "blocked", label: t("rememberBlock") },
          ]}
          onChange={(next: string) => void saveRememberBlocked(next === "blocked")}
        />
        <p className="ovm-hint ovm-isolationHint">{t("rememberHint")}</p>
        {rememberStatus !== "" ? <p className="ovm-status" role="status">{rememberStatus}</p> : null}
      </section>
    )}
    {recallScope === undefined ? null : (
      <IsolationCard
        scope={recallScope}
        busy={busy}
        initializing={initializing}
        draft={projectDraft}
        onDraft={setProjectDraft}
        onResolve={applyProject}
        onScopeChange={(isolate) => void setScope(isolate)}
        t={t}
      />
    )}
    {peerSource === undefined ? null : (
      <PeerSourceCard
        view={peerSource}
        busy={busy}
        initializing={initializing}
        open={ruleMenuOpen}
        onOpenChange={setRuleMenuOpen}
        onSelect={(choice) => void savePeerSource(choice)}
        t={t}
      />
    )}
    {workspaces === undefined || workspaces.available === false ? null : <WorkspaceCard view={workspaces} t={t} />}
    {peerId === undefined ? null : (
      <PeerIdCard
        view={peerId}
        draft={peerIdDraft}
        locked={peerIdLocked}
        busy={busy}
        onSave={savePeerIdValue}
        onDraft={setPeerIdDraft}
        onFill={() => void fillCurrentRepo()}
        t={t}
      />
    )}
    {recallTuning === undefined ? null : (
      <TuningCard
        view={recallTuning}
        draft={tuningDraft}
        dirtyCount={Object.keys(tuningDirty).length}
        busy={busy}
        initializing={initializing}
        envVars={tuningEnvVars}
        workspaceLayers={tuningWorkspaceLayers}
        onChange={changeTuning}
        onSave={saveTuning}
        t={t}
      />
    )}
    <section className="ovm-card"><details className="ovm-recovery ovm-collapse"><summary><h2>{t("recoverTitle")}</h2></summary><div className="ovm-collapseContent"><p className="ovm-hint">{t("recoverHint")}</p>
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
