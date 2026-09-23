window.__ModuleLoader__.load({
  id: "dsh-openviking-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  ManagerForm: () => ManagerForm,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/i18n.ts
var en = {
  summary: "OpenViking connection configuration and local diagnostics.",
  eyebrow: "OpenViking Manager",
  title: "Connect your memory workspace",
  intro: "Manage the client configuration used by the official OpenViking memory plugin. Your existing API key is never shown here.",
  loading: "Loading local OpenViking configuration\u2026",
  configurationLoaded: "Configuration loaded.",
  noUsableConfig: "No usable ovcli.conf was found.",
  unableLoad: "Unable to load configuration.",
  configurationSaved: "Configuration saved. The stored user key remains masked.",
  unableSave: "Unable to save configuration.",
  permissionsRepaired: "File permissions repaired.",
  repairPermissions: "Repair file permissions",
  unableRepair: "Unable to repair file permissions. Fix ~/.openviking/ovcli.conf manually.",
  localServerFound: "Local server config found",
  authMode: "auth mode",
  localManagementAvailable: "local management is available",
  noLocalRootKey: "no local root key detected",
  invalidConfig: "The file needs repair before it can be safely reused. Enter the correct values and save a compatible configuration.",
  endpoint: "OpenViking endpoint",
  endpointRequiredFirst: "Save the OpenViking endpoint above first, then use the recovery or initialization tools.",
  account: "Account",
  user: "User",
  newUserKey: "New user key",
  optional: "optional",
  existingKey: "Existing key: {key}",
  pasteUserKey: "Paste a user_key",
  keyHint: "Leave the key blank to preserve the existing key. This field accepts a user key, never a root API key.",
  save: "Save configuration",
  verify: "Verify connection",
  openStudio: "Open Studio",
  unreachable: "OpenViking is unreachable at this endpoint.",
  notReady: "OpenViking is reachable but not ready.",
  keyNotAccepted: "Service is ready, but the supplied user key was not accepted.",
  connectedAs: "Connected as {account}/{user}.",
  recoverTitle: "Recover or initialize access",
  recoverHint: "Use a root API key only for this management session. It is never saved to ovcli.conf.",
  temporaryRootKey: "Temporary root API key",
  pasteRootKey: "Paste root_api_key for this operation only",
  listAccounts: "List accounts",
  listAccountsTitle: "Accounts and users on this server",
  listAccountsHint: "Loads what this root API key can manage, then lets you pick an account and one of its users.",
  clearRootKey: "Clear temporary root key",
  rootKeyCleared: "Temporary root API key cleared.",
  selectAccount: "Existing account",
  selectUser: "Existing user",
  chooseAccount: "Choose an account",
  chooseUser: "Choose a user",
  foundAccounts: "Found {count} account(s).",
  foundUsers: "Found {count} user(s) in {account}.",
  rootKeyRequired: "Enter the root API key for this one-time management operation.",
  adminFailed: "OpenViking admin request failed.",
  createAccountTitle: "Create account and first user",
  createAccountHint: "Creates a new account together with its first admin user.",
  createAccount: "Create account",
  createUserTitle: "Create user in current account",
  createUserHint: "Adds a user to an account that already exists.",
  createUser: "Create user",
  noAccountsLoaded: "List accounts first, then pick the account that should receive the new user.",
  regenerateTitle: "Regenerate an existing user key",
  regenerateHint: "Issues a new user key for an existing account and user.",
  regenerateKey: "Regenerate key",
  accountId: "Account ID",
  userId: "User ID",
  adminOperationComplete: "{operation} completed. The new user key is ready to save.",
  keyRotated: "Key rotated. Save the new user key on this device and update other devices.",
  toggleLabel: "OpenViking on",
  toggleLabelOff: "OpenViking off",
  toggleAction: "Toggle OpenViking memory for this session",
  toggleFailed: "Unable to update the OpenViking toggle.",
  aboutTitle: "About this plugin",
  openRepository: "Open on GitHub",
  checkUpdates: "Check for updates",
  checkingUpdates: "Checking for updates\u2026",
  updateAvailable: "A new version {latest} is available (installed {current}).",
  upToDate: "You are on the latest version ({current}).",
  updateCheckFailed: "Unable to check for updates: {error}",
  viewRelease: "View release"
};
var zh = {
  summary: "\u914D\u7F6E OpenViking \u8FDE\u63A5\u5E76\u8BCA\u65AD\u672C\u673A\u72B6\u6001\u3002",
  eyebrow: "OpenViking \u7BA1\u7406\u5668",
  title: "\u8FDE\u63A5\u4F60\u7684\u8BB0\u5FC6\u5DE5\u4F5C\u533A",
  intro: "\u7BA1\u7406\u5B98\u65B9 OpenViking \u8BB0\u5FC6\u63D2\u4EF6\u4F7F\u7528\u7684\u5BA2\u6237\u7AEF\u914D\u7F6E\u3002\u5DF2\u6709 API Key \u4E0D\u4F1A\u5728\u6B64\u9875\u9762\u5C55\u793A\u3002",
  loading: "\u6B63\u5728\u8BFB\u53D6\u672C\u673A OpenViking \u914D\u7F6E\u2026",
  configurationLoaded: "\u914D\u7F6E\u5DF2\u52A0\u8F7D\u3002",
  noUsableConfig: "\u672A\u627E\u5230\u53EF\u7528\u7684 ovcli.conf\u3002",
  unableLoad: "\u65E0\u6CD5\u52A0\u8F7D\u914D\u7F6E\u3002",
  configurationSaved: "\u914D\u7F6E\u5DF2\u4FDD\u5B58\u3002\u5DF2\u5B58\u50A8\u7684\u7528\u6237 Key \u4FDD\u6301\u63A9\u7801\u5C55\u793A\u3002",
  unableSave: "\u65E0\u6CD5\u4FDD\u5B58\u914D\u7F6E\u3002",
  permissionsRepaired: "\u6587\u4EF6\u6743\u9650\u5DF2\u4FEE\u590D\u3002",
  repairPermissions: "\u4FEE\u590D\u6587\u4EF6\u6743\u9650",
  unableRepair: "\u65E0\u6CD5\u4FEE\u590D\u6587\u4EF6\u6743\u9650\u3002\u8BF7\u624B\u5DE5\u4FEE\u590D ~/.openviking/ovcli.conf\u3002",
  localServerFound: "\u5DF2\u53D1\u73B0\u672C\u673A\u670D\u52A1\u914D\u7F6E",
  authMode: "\u8BA4\u8BC1\u6A21\u5F0F",
  localManagementAvailable: "\u53EF\u4F7F\u7528\u672C\u673A\u7BA1\u7406\u80FD\u529B",
  noLocalRootKey: "\u672A\u53D1\u73B0\u672C\u673A root key",
  invalidConfig: "\u8BE5\u6587\u4EF6\u9700\u8981\u4FEE\u590D\u540E\u624D\u80FD\u5B89\u5168\u590D\u7528\u3002\u8BF7\u586B\u5199\u6B63\u786E\u503C\u5E76\u4FDD\u5B58\u517C\u5BB9\u914D\u7F6E\u3002",
  endpoint: "OpenViking \u670D\u52A1\u5730\u5740",
  endpointRequiredFirst: "\u8BF7\u5148\u5728\u4E0A\u65B9\u4FDD\u5B58 OpenViking \u670D\u52A1\u5730\u5740\uFF0C\u4FDD\u5B58\u540E\u518D\u4F7F\u7528\u6062\u590D\u6216\u521D\u59CB\u5316\u5DE5\u5177\u3002",
  account: "\u8D26\u53F7",
  user: "\u7528\u6237",
  newUserKey: "\u65B0\u7684\u7528\u6237 Key",
  optional: "\u53EF\u9009",
  existingKey: "\u5DF2\u6709 Key\uFF1A{key}",
  pasteUserKey: "\u7C98\u8D34 user_key",
  keyHint: "\u7559\u7A7A\u53EF\u4FDD\u7559\u5DF2\u6709 Key\u3002\u6B64\u5B57\u6BB5\u53EA\u63A5\u53D7 user key\uFF0C\u4E0D\u80FD\u586B\u5199 root API key\u3002",
  save: "\u4FDD\u5B58\u914D\u7F6E",
  verify: "\u9A8C\u8BC1\u8FDE\u63A5",
  openStudio: "\u6253\u5F00 Studio",
  unreachable: "\u8BE5\u670D\u52A1\u5730\u5740\u65E0\u6CD5\u8BBF\u95EE OpenViking\u3002",
  notReady: "OpenViking \u53EF\u8BBF\u95EE\uFF0C\u4F46\u5C1A\u672A\u5C31\u7EEA\u3002",
  keyNotAccepted: "\u670D\u52A1\u5DF2\u5C31\u7EEA\uFF0C\u4F46\u63D0\u4F9B\u7684\u7528\u6237 Key \u672A\u83B7\u63A5\u53D7\u3002",
  connectedAs: "\u5DF2\u8FDE\u63A5\u4E3A {account}/{user}\u3002",
  recoverTitle: "\u6062\u590D\u6216\u521D\u59CB\u5316\u8BBF\u95EE",
  recoverHint: "root API key \u4EC5\u7528\u4E8E\u672C\u6B21\u7BA1\u7406\u64CD\u4F5C\uFF0C\u7EDD\u4E0D\u4F1A\u5199\u5165 ovcli.conf\u3002",
  temporaryRootKey: "\u4E34\u65F6 root API key",
  pasteRootKey: "\u4EC5\u4E3A\u672C\u6B21\u64CD\u4F5C\u7C98\u8D34 root_api_key",
  listAccounts: "\u5217\u51FA\u8D26\u53F7",
  listAccountsTitle: "\u672C\u673A\u670D\u52A1\u4E0A\u7684\u8D26\u53F7\u548C\u7528\u6237",
  listAccountsHint: "\u52A0\u8F7D\u8BE5 root API key \u53EF\u7BA1\u7406\u7684\u8D26\u53F7\uFF0C\u7136\u540E\u53EF\u9009\u62E9\u8D26\u53F7\u53CA\u5176\u4E2D\u7684\u7528\u6237\u3002",
  clearRootKey: "\u6E05\u9664\u4E34\u65F6 root key",
  rootKeyCleared: "\u4E34\u65F6 root API key \u5DF2\u6E05\u9664\u3002",
  selectAccount: "\u5DF2\u6709\u8D26\u53F7",
  selectUser: "\u5DF2\u6709\u7528\u6237",
  chooseAccount: "\u8BF7\u9009\u62E9\u8D26\u53F7",
  chooseUser: "\u8BF7\u9009\u62E9\u7528\u6237",
  foundAccounts: "\u53D1\u73B0 {count} \u4E2A\u8D26\u53F7\u3002",
  foundUsers: "\u8D26\u53F7 {account} \u4E2D\u53D1\u73B0 {count} \u4E2A\u7528\u6237\u3002",
  rootKeyRequired: "\u8BF7\u4E3A\u672C\u6B21\u7BA1\u7406\u64CD\u4F5C\u8F93\u5165 root API key\u3002",
  adminFailed: "OpenViking \u7BA1\u7406\u8BF7\u6C42\u5931\u8D25\u3002",
  createAccountTitle: "\u521B\u5EFA\u8D26\u53F7\u548C\u9996\u4F4D\u7528\u6237",
  createAccountHint: "\u521B\u5EFA\u5168\u65B0\u8D26\u53F7\uFF0C\u5E76\u8BBE\u7F6E\u5B83\u7684\u9996\u4F4D\u7BA1\u7406\u5458\u7528\u6237\u3002",
  createAccount: "\u521B\u5EFA\u8D26\u53F7",
  createUserTitle: "\u5728\u5F53\u524D\u8D26\u53F7\u4E2D\u521B\u5EFA\u7528\u6237",
  createUserHint: "\u5411\u5DF2\u5B58\u5728\u7684\u8D26\u53F7\u4E2D\u6DFB\u52A0\u65B0\u7528\u6237\u3002",
  createUser: "\u521B\u5EFA\u7528\u6237",
  noAccountsLoaded: "\u8BF7\u5148\u5217\u51FA\u8D26\u53F7\uFF0C\u518D\u9009\u62E9\u8981\u6DFB\u52A0\u7528\u6237\u7684\u8D26\u53F7\u3002",
  regenerateTitle: "\u91CD\u65B0\u751F\u6210\u5DF2\u6709\u7528\u6237 Key",
  regenerateHint: "\u4E3A\u5DF2\u5B58\u5728\u7684\u8D26\u53F7\u548C\u7528\u6237\u91CD\u65B0\u7B7E\u53D1\u7528\u6237 Key\u3002",
  regenerateKey: "\u91CD\u65B0\u751F\u6210 Key",
  accountId: "\u8D26\u53F7 ID",
  userId: "\u7528\u6237 ID",
  adminOperationComplete: "{operation} \u5DF2\u5B8C\u6210\u3002\u65B0\u7684\u7528\u6237 Key \u5DF2\u51C6\u5907\u597D\u4FDD\u5B58\u3002",
  keyRotated: "Key \u5DF2\u8F6E\u6362\u3002\u8BF7\u5728\u672C\u8BBE\u5907\u4FDD\u5B58\u65B0 Key\uFF0C\u5E76\u66F4\u65B0\u5176\u4ED6\u8BBE\u5907\u3002",
  toggleLabel: "OpenViking \u5F00",
  toggleLabelOff: "OpenViking \u5173",
  toggleAction: "\u5207\u6362\u672C\u4F1A\u8BDD\u7684 OpenViking \u8BB0\u5FC6\u5F00\u5173",
  toggleFailed: "\u65E0\u6CD5\u66F4\u65B0 OpenViking \u5F00\u5173\u3002",
  aboutTitle: "\u5173\u4E8E\u672C\u63D2\u4EF6",
  openRepository: "\u5728 GitHub \u6253\u5F00",
  checkUpdates: "\u68C0\u67E5\u65B0\u7248\u672C",
  checkingUpdates: "\u6B63\u5728\u68C0\u67E5\u65B0\u7248\u672C\u2026",
  updateAvailable: "\u53D1\u73B0\u65B0\u7248\u672C {latest}\uFF08\u5F53\u524D {current}\uFF09\u3002",
  upToDate: "\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C\uFF08{current}\uFF09\u3002",
  updateCheckFailed: "\u65E0\u6CD5\u68C0\u67E5\u66F4\u65B0\uFF1A{error}",
  viewRelease: "\u67E5\u770B\u7248\u672C"
};
var dictionaries = { en, zh };
function localeFrom(value) {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}
function browserLocale() {
  if (typeof document !== "undefined" && document.documentElement.lang !== "") return localeFrom(document.documentElement.lang);
  if (typeof navigator !== "undefined") return localeFrom(navigator.language);
  return "en";
}
function createTranslation(locale) {
  const dictionary = dictionaries[localeFrom(locale)];
  return (key, params) => params === void 0 ? dictionary[key] : dictionary[key].replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

// src/client/manager-form.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var ENDPOINT_NOT_CONFIGURED = "endpoint-not-configured";
var fallback = { url: "http://127.0.0.1:1933", account: "", user: "", apiKeySet: false, apiKeyMasked: "" };
var adminTabs = [
  { id: "list-accounts", title: "listAccounts" },
  { id: "create-account", title: "createAccount" },
  { id: "create-user", title: "createUser" },
  { id: "rotate-user-key", title: "regenerateKey" }
];
async function responseJson(response) {
  const value = await response.json();
  if (!response.ok || !value.ok) {
    const error = new Error(value.error ?? "OpenViking Manager request failed");
    if (typeof value.code === "string") error.code = value.code;
    throw error;
  }
  return value;
}
function AdminIdentityForm(props) {
  const [accountId, setAccountId] = (0, import_react.useState)(props.defaultAccount ?? "");
  const [userId, setUserId] = (0, import_react.useState)(props.defaultUser ?? "");
  (0, import_react.useEffect)(() => {
    setAccountId(props.defaultAccount ?? "");
  }, [props.defaultAccount]);
  (0, import_react.useEffect)(() => {
    setUserId(props.defaultUser ?? "");
  }, [props.defaultUser]);
  const accountsMissing = props.accountOptions !== void 0 && props.accountOptions.length === 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "ovm-adminForm", onSubmit: (event) => {
    event.preventDefault();
    props.onSubmit(accountId, userId);
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: props.title }),
    props.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: props.hint }),
    props.accountOptions === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      props.accountLabel,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { required: true, value: accountId, onChange: (event) => setAccountId(event.target.value) })
    ] }) : accountsMissing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: props.noAccountsLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "ovm-secondary", disabled: props.disabled, onClick: () => props.onLoadAccounts?.(), children: props.loadAccountsLabel })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      props.accountLabel,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { required: true, value: accountId, onChange: (event) => setAccountId(event.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: props.chooseAccountLabel }),
        props.accountOptions.map((account) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: account, children: account }, account))
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
      props.userLabel,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { required: true, value: userId, onChange: (event) => setUserId(event.target.value) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: props.danger ? "ovm-danger" : "", disabled: props.disabled || accountsMissing, children: props.submit })
  ] });
}
function ManagerForm({ apiPrefix = "/plugins/dsh-openviking-manager/api", fetchFn = fetch, t = createTranslation(browserLocale()) }) {
  const [config, setConfig] = (0, import_react.useState)(fallback);
  const [apiKey, setApiKey] = (0, import_react.useState)("");
  const [kind, setKind] = (0, import_react.useState)("loading");
  const [permissionWarning, setPermissionWarning] = (0, import_react.useState)(false);
  const [localServer, setLocalServer] = (0, import_react.useState)();
  const [status, setStatus] = (0, import_react.useState)(t("loading"));
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [rootApiKey, setRootApiKey] = (0, import_react.useState)("");
  const [adminAccounts, setAdminAccounts] = (0, import_react.useState)([]);
  const [adminUsers, setAdminUsers] = (0, import_react.useState)([]);
  const [selectedAccount, setSelectedAccount] = (0, import_react.useState)("");
  const [selectedUser, setSelectedUser] = (0, import_react.useState)("");
  const [adminStatus, setAdminStatus] = (0, import_react.useState)("");
  const [activeAdminTab, setActiveAdminTab] = (0, import_react.useState)("list-accounts");
  const [version, setVersion] = (0, import_react.useState)();
  const [versionStatus, setVersionStatus] = (0, import_react.useState)("");
  const [checkingVersion, setCheckingVersion] = (0, import_react.useState)(false);
  const load = async () => {
    setBusy(true);
    try {
      const discovery = (await responseJson(await fetchFn(`${apiPrefix}/discovery`))).value;
      const next = discovery.ovcli;
      setConfig(next.kind === "ready" ? next.config : { ...next.config, url: discovery.suggestedEndpoint });
      setKind(next.kind);
      setPermissionWarning(next.permissionWarning === true);
      setLocalServer(discovery.localServer);
      setStatus(next.kind === "ready" ? t("configurationLoaded") : next.message ?? t("noUsableConfig"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("unableLoad"));
    } finally {
      setBusy(false);
    }
  };
  const loadVersion = async () => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/version`))).value;
      setVersion(value);
    } catch {
    }
  };
  (0, import_react.useEffect)(() => {
    void load();
    void loadVersion();
  }, []);
  const checkUpdates = async () => {
    setCheckingVersion(true);
    setVersionStatus(t("checkingUpdates"));
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/version?check=1`))).value;
      setVersion(value);
      if (value.error !== void 0) setVersionStatus(t("updateCheckFailed", { error: value.error }));
      else if (value.updateAvailable && value.latest !== void 0) setVersionStatus(t("updateAvailable", { latest: value.latest, current: value.current }));
      else setVersionStatus(t("upToDate", { current: value.current }));
    } catch (error) {
      setVersionStatus(t("updateCheckFailed", { error: error instanceof Error ? error.message : "unknown" }));
    } finally {
      setCheckingVersion(false);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/config`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...config, ...apiKey === "" ? {} : { apiKey } }) }))).value;
      setConfig(next.config);
      setApiKey("");
      setKind(next.kind);
      setPermissionWarning(false);
      setStatus(t("configurationSaved"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("unableSave"));
    } finally {
      setBusy(false);
    }
  };
  const repair = async () => {
    setBusy(true);
    try {
      const next = (await responseJson(await fetchFn(`${apiPrefix}/repair-permissions`, { method: "POST" }))).value;
      setConfig(next.config);
      setPermissionWarning(next.permissionWarning === true);
      setStatus(t("permissionsRepaired"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("unableRepair"));
    } finally {
      setBusy(false);
    }
  };
  const adminCall = async (operation, fields = {}) => {
    if (rootApiKey.trim() === "") {
      setAdminStatus(t("rootKeyRequired"));
      return;
    }
    if (kind !== "ready") {
      setAdminStatus(t("endpointRequiredFirst"));
      return;
    }
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/admin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation, rootApiKey, ...fields }) }))).value;
      if (operation === "accounts") {
        const accounts = (value.accounts ?? []).map((item) => item.accountId);
        setAdminAccounts(accounts);
        setSelectedAccount(accounts[0] ?? "");
        setAdminUsers([]);
        setSelectedUser("");
        setAdminStatus(t("foundAccounts", { count: accounts.length }));
      } else if (operation === "users") {
        const users = value.users ?? [];
        setAdminUsers(users);
        setSelectedUser(users[0]?.userId ?? "");
        setAdminStatus(t("foundUsers", { count: users.length, account: fields.accountId ?? "" }));
      } else if (value.created) {
        setConfig({ ...config, account: value.created.accountId, user: value.created.userId });
        setApiKey(value.created.userKey);
        setSelectedAccount(value.created.accountId);
        setSelectedUser(value.created.userId);
        setRootApiKey("");
        setAdminStatus(t("adminOperationComplete", { operation }));
      } else if (value.userKey) {
        setApiKey(value.userKey);
        setRootApiKey("");
        setAdminStatus(t("keyRotated"));
      }
    } catch (error) {
      const code = error.code;
      setAdminStatus(code === ENDPOINT_NOT_CONFIGURED ? t("endpointRequiredFirst") : error instanceof Error ? error.message : t("adminFailed"));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    try {
      const probe = (await responseJson(await fetchFn(`${apiPrefix}/probe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) }))).value;
      if (!probe.reachable) setStatus(t("unreachable"));
      else if (!probe.ready) setStatus(t("notReady"));
      else if (!probe.authenticated) setStatus(t("keyNotAccepted"));
      else setStatus(t("connectedAs", { account: probe.identity?.account ?? "", user: probe.identity?.user ?? "" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("unreachable"));
    } finally {
      setBusy(false);
    }
  };
  const studioUrl = `${config.url.replace(/\/$/, "")}/studio`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "ovm-shell", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "ovm-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-headerMain", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-eyebrow", children: t("eyebrow") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-titleRow", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: t("title") }),
          version?.current !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "ovm-versionTag", children: [
            "v",
            version.current
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-intro", children: t("intro") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "ovm-about", "aria-label": t("aboutTitle"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-aboutActions", children: [
          version?.repositoryUrl !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: version.repositoryUrl, title: version.repositoryUrl, target: "_blank", rel: "noreferrer", children: t("openRepository") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "ovm-secondary", onClick: () => void checkUpdates(), disabled: checkingVersion, children: t("checkUpdates") }),
          version?.updateAvailable && version.releaseUrl !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: version.releaseUrl, target: "_blank", rel: "noreferrer", children: t("viewRelease") }) : null
        ] }),
        versionStatus !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: version?.error !== void 0 ? "ovm-warning" : "ovm-aboutStatus", role: "status", children: versionStatus }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "ovm-card", "aria-busy": busy, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ovm-status", role: "status", children: status }),
      localServer?.found ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "ovm-hint", children: [
        t("localServerFound"),
        " \xB7 ",
        t("authMode"),
        ": ",
        localServer.authMode ?? "unknown",
        " \xB7 ",
        localServer.rootKeyAvailable ? t("localManagementAvailable") : t("noLocalRootKey")
      ] }) : null,
      localServer?.configError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", children: localServer.configError }) : null,
      kind === "invalid-json" || kind === "invalid-shape" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", children: t("invalidConfig") }) : null,
      permissionWarning ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-warning", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("invalidConfig") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void repair(), disabled: busy, children: t("repairPermissions") })
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (event) => void save(event), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          t("endpoint"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { required: true, value: config.url, onChange: (event) => setConfig({ ...config, url: event.target.value }), placeholder: "http://127.0.0.1:1933" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          t("account"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: config.account, onChange: (event) => setConfig({ ...config, account: event.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          t("user"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: config.user, onChange: (event) => setConfig({ ...config, user: event.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          t("newUserKey"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "ovm-optional", children: [
            "(",
            t("optional"),
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", value: apiKey, onChange: (event) => setApiKey(event.target.value), placeholder: config.apiKeySet ? t("existingKey", { key: config.apiKeyMasked }) : t("pasteUserKey") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("keyHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", disabled: busy, children: t("save") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "ovm-secondary", onClick: () => void verify(), disabled: busy, children: t("verify") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: studioUrl, target: "_blank", rel: "noreferrer", children: t("openStudio") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "ovm-card", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "ovm-recovery", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("recoverTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-recoveryContent", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("recoverHint") }),
        kind !== "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", role: "alert", children: t("endpointRequiredFirst") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          t("temporaryRootKey"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", value: rootApiKey, onChange: (event) => setRootApiKey(event.target.value), placeholder: t("pasteRootKey") })
        ] }),
        rootApiKey !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ovm-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "ovm-secondary", disabled: busy, onClick: () => {
          setRootApiKey("");
          setAdminStatus(t("rootKeyCleared"));
        }, children: t("clearRootKey") }) }) : null,
        adminStatus !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-status", role: "status", children: adminStatus }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ovm-adminTabs", role: "tablist", "aria-label": t("recoverTitle"), children: adminTabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { id: `ovm-tab-${tab.id}`, type: "button", role: "tab", "aria-selected": activeAdminTab === tab.id, "aria-controls": `ovm-panel-${tab.id}`, className: activeAdminTab === tab.id ? "ovm-adminTab ovm-adminTabActive" : "ovm-adminTab", onClick: () => setActiveAdminTab(tab.id), children: t(tab.title) }, tab.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "ovm-panel-list-accounts", role: "tabpanel", "aria-labelledby": "ovm-tab-list-accounts", hidden: activeAdminTab !== "list-accounts", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "ovm-adminForm", onSubmit: (event) => event.preventDefault(), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("listAccountsTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("listAccountsHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "ovm-secondary", disabled: busy, onClick: () => void adminCall("accounts"), children: t("listAccounts") }),
          adminAccounts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            t("selectAccount"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { "aria-label": t("selectAccount"), value: selectedAccount, onChange: (event) => {
              const accountId = event.target.value;
              setSelectedAccount(accountId);
              void adminCall("users", { accountId });
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("chooseAccount") }),
              adminAccounts.map((account) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: account, children: account }, account))
            ] })
          ] }) : null,
          adminUsers.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            t("selectUser"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { "aria-label": t("selectUser"), value: selectedUser, onChange: (event) => setSelectedUser(event.target.value), children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("chooseUser") }),
              adminUsers.map((user) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: user.userId, children: [
                user.userId,
                " (",
                user.role,
                ")"
              ] }, user.userId))
            ] })
          ] }) : null
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "ovm-panel-create-account", role: "tabpanel", "aria-labelledby": "ovm-tab-create-account", hidden: activeAdminTab !== "create-account", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminIdentityForm, { title: t("createAccountTitle"), hint: t("createAccountHint"), submit: t("createAccount"), accountLabel: t("accountId"), userLabel: t("userId"), disabled: busy, onSubmit: (accountId, userId) => void adminCall("create-account", { accountId, userId }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "ovm-panel-create-user", role: "tabpanel", "aria-labelledby": "ovm-tab-create-user", hidden: activeAdminTab !== "create-user", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminIdentityForm, { title: t("createUserTitle"), hint: t("createUserHint"), submit: t("createUser"), accountLabel: t("accountId"), userLabel: t("userId"), disabled: busy, accountOptions: adminAccounts, chooseAccountLabel: t("chooseAccount"), noAccountsLabel: t("noAccountsLoaded"), loadAccountsLabel: t("listAccounts"), onLoadAccounts: () => void adminCall("accounts"), defaultAccount: selectedAccount, onSubmit: (accountId, userId) => void adminCall("create-user", { accountId, userId }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "ovm-panel-rotate-user-key", role: "tabpanel", "aria-labelledby": "ovm-tab-rotate-user-key", hidden: activeAdminTab !== "rotate-user-key", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminIdentityForm, { title: t("regenerateTitle"), hint: t("regenerateHint"), submit: t("regenerateKey"), accountLabel: t("accountId"), userLabel: t("userId"), disabled: busy, defaultAccount: selectedAccount || config.account, defaultUser: selectedUser || config.user, danger: true, onSubmit: (accountId, userId) => void adminCall("rotate-user-key", { accountId, userId }) }) })
      ] })
    ] }) })
  ] });
}

// src/client/ov-toggle.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var DEFAULT_TOGGLE_API_PREFIX = "/plugins/dsh-openviking-manager/api";
async function requestToggle(fetchFn, url, init) {
  const response = await fetchFn(url, init);
  const json = await response.json();
  if (!response.ok || !json.ok || typeof json.value?.enabled !== "boolean") return void 0;
  return json.value.enabled;
}
function OpenVikingToggle({ sessionId, t, apiPrefix = DEFAULT_TOGGLE_API_PREFIX, fetchFn = fetch }) {
  const [enabled, setEnabled] = (0, import_react2.useState)(true);
  const [busy, setBusy] = (0, import_react2.useState)(true);
  const [failed, setFailed] = (0, import_react2.useState)(false);
  const generation = (0, import_react2.useRef)(0);
  const loadAbort = (0, import_react2.useRef)(void 0);
  (0, import_react2.useEffect)(() => {
    const current = ++generation.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setEnabled(true);
    setBusy(true);
    setFailed(false);
    void (async () => {
      try {
        const value = await requestToggle(fetchFn, `${apiPrefix}/session-toggle?sessionId=${encodeURIComponent(sessionId)}`, {
          signal: controller.signal
        });
        if (generation.current !== current) return;
        if (value === void 0) setFailed(true);
        else setEnabled(value);
      } catch {
        if (generation.current === current && !controller.signal.aborted) setFailed(true);
      } finally {
        if (generation.current === current) setBusy(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [apiPrefix, fetchFn, sessionId]);
  const toggle = async () => {
    if (busy) return;
    const next = !enabled;
    const current = ++generation.current;
    loadAbort.current?.abort();
    setBusy(true);
    setEnabled(next);
    try {
      const value = await requestToggle(fetchFn, `${apiPrefix}/session-toggle`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, enabled: next })
      });
      if (generation.current !== current) return;
      if (value === void 0) throw new Error("toggle rejected");
      setEnabled(value);
      setFailed(false);
    } catch {
      if (generation.current === current) {
        setEnabled(!next);
        setFailed(true);
      }
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      className: `ovm-ovToggle${enabled ? "" : " ovm-ovToggleOff"}`,
      "aria-pressed": enabled,
      "aria-busy": busy,
      "aria-label": t("toggleAction"),
      title: failed ? t("toggleFailed") : t("toggleAction"),
      disabled: busy,
      onClick: () => void toggle(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ovm-ovToggleDot", "aria-hidden": "true" }),
        busy ? "..." : enabled ? t("toggleLabel") : t("toggleLabelOff")
      ]
    }
  );
}

// src/client/styles.ts
var managerCss = `
.ovm-recovery>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0;cursor:pointer;list-style:none}.ovm-recovery>summary::-webkit-details-marker{display:none}.ovm-recovery>summary>h2{margin:0}.ovm-recovery>summary::after{content:"+";flex:0 0 auto;display:grid;place-items:center;width:24px;height:24px;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:7px;color:var(--dsw-alias-label-secondary,#59636e);font-size:15px;line-height:1;transition:background .15s ease}.ovm-recovery>summary:hover::after{background:var(--dsw-alias-bg-layer-1,#f6f8fa)}.ovm-recovery>summary:focus-visible{outline:2px solid #1f5d50;outline-offset:3px;border-radius:8px}.ovm-recovery[open]>summary::after{content:"\u2212"}.ovm-recoveryContent{display:grid;gap:14px;margin-top:18px}.ovm-adminTabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--dsw-alias-border-l2,#dce1e6)}.ovm-adminTab{flex:0 0 auto;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#59636e);padding:8px 10px;font:inherit;font-size:13px}.ovm-adminTab:hover{background:var(--dsw-alias-bg-layer-1,#f6f8fa)}.ovm-adminTabActive{border-bottom-color:#1f5d50;color:#1f4038;font-weight:600}.ovm-adminTabs+div .ovm-adminForm{margin-top:14px}
.ovm-shell{max-width:760px;padding:28px;color:var(--dsw-alias-label-primary,#202124);font-family:ui-sans-serif,system-ui,sans-serif}.ovm-eyebrow{color:#2f6f5e;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.ovm-shell h1{margin:4px 0 10px;font-size:28px;letter-spacing:-.03em}.ovm-intro{max-width:620px;color:var(--dsw-alias-label-secondary,#59636e);line-height:1.65}.ovm-card{margin-top:24px;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);padding:20px}.ovm-status{margin-bottom:16px;color:#365b4f;font-size:13px}.ovm-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;border-left:3px solid #b47d1f;background:#fff8e8;padding:12px;color:#664500;font-size:13px}.ovm-warning button{background:#fff;border:1px solid #b47d1f;color:#664500}form{display:grid;gap:14px;margin-top:18px}label{display:grid;gap:6px;color:var(--dsw-alias-label-primary,#202124);font-size:13px;font-weight:600}input,select{height:36px;border:1px solid var(--dsw-alias-border-l2,#ccd3da);border-radius:7px;padding:0 10px;background:transparent;color:inherit;font:inherit;font-weight:400}.ovm-optional,.ovm-hint{color:var(--dsw-alias-label-tertiary,#77818b);font-weight:400}.ovm-hint{margin:0;font-size:12px;line-height:1.5}.ovm-actions{display:flex;align-items:center;gap:14px;margin-top:8px}.ovm-actions button,.ovm-actions a,.ovm-adminForm button{border-radius:7px;padding:8px 13px;font:inherit;font-size:13px;text-decoration:none}.ovm-actions button,.ovm-adminForm button{border:0;background:#1f4038;color:#fff}.ovm-actions .ovm-secondary,.ovm-adminForm .ovm-secondary{border:1px solid #1f4038;background:transparent;color:#1f4038}.ovm-actions a{color:#1f5d50}.ovm-actions button:disabled,.ovm-adminForm button:disabled{opacity:.55}.ovm-card h2{margin:0 0 8px;font-size:18px}.ovm-adminGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:18px}.ovm-adminForm{border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:8px;padding:14px}.ovm-adminForm h3{margin:0;font-size:14px}.ovm-danger{background:#9d2d2d!important}
`;
var toggleCss = `
.ovm-header{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px 24px}.ovm-headerMain{flex:1 1 320px;min-width:0}.ovm-titleRow{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px}.ovm-titleRow h1{margin:4px 0 10px}.ovm-versionTag{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:999px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);color:#2f6f5e;font-size:12px;font-weight:700;letter-spacing:.02em;padding:2px 9px;line-height:1.5}.ovm-about{flex:0 0 auto;align-self:flex-start;margin-top:26px;display:flex;flex-direction:column;align-items:stretch;gap:8px;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);padding:12px 14px}.ovm-aboutActions{display:flex;flex-direction:column;align-items:stretch;gap:8px}.ovm-aboutActions button,.ovm-aboutActions a{border-radius:7px;font:inherit;font-size:12px;text-decoration:none;white-space:nowrap;text-align:center}.ovm-aboutActions button{border:1px solid #1f4038;background:transparent;color:#1f4038;padding:6px 11px;cursor:pointer}.ovm-aboutActions button:disabled{opacity:.55}.ovm-aboutActions a{color:#1f5d50;font-weight:600;padding:4px 0}.ovm-aboutStatus{margin:0;font-size:12px;line-height:1.5;color:#365b4f;max-width:220px}.ovm-about .ovm-warning{display:block;font-size:12px;max-width:220px}.ovm-header+.ovm-card{margin-top:8px}
.ovm-standaloneToggle{padding:12px 28px 0}.ovm-ovToggle{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,#ccd3da);border-radius:999px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);color:var(--dsw-alias-label-secondary,#59636e);padding:2px 10px;font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer}.ovm-ovToggle:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#202124)}.ovm-ovToggle:focus-visible{outline:2px solid #1f5d50;outline-offset:2px}.ovm-ovToggle:disabled{opacity:.6;cursor:default}.ovm-ovToggleDot{width:7px;height:7px;border-radius:50%;background:#1f8a70;flex:0 0 auto}.ovm-ovToggleOff .ovm-ovToggleDot{background:#9aa5b1}.ovm-ovToggleOff{color:var(--dsw-alias-label-tertiary,#77818b)}
`;
function installManagerStyles() {
  if (typeof document === "undefined" || document.querySelector("style[data-plugin='dsh-openviking-manager']") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-openviking-manager";
  tag.textContent = `${managerCss}
${toggleCss}`;
  document.head.appendChild(tag);
}

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var inject = ["slots", "locale"];
installManagerStyles();
function apply(ctx) {
  ctx.effect(() => ctx.locale.register("openviking-manager", dictionaries), "openviking-manager: dictionaries");
  ctx.slots.inject(
    "plugins.bundle.config",
    () => ctx.slots.register(
      { name: "plugins.bundle.config", key: "dsh-openviking-manager", locale: "openviking-manager" },
      (props) => props.view === "summary" ? props.t("summary") : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ManagerForm, { t: props.t })
    )
  );
  ctx.slots.inject(
    "conversation.input.left",
    () => ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "openviking-toggle",
        order: 10,
        locale: "openviking-manager",
        registrant: "dsh-openviking-manager",
        inject: (sessionId) => ({ sessionId })
      },
      OpenVikingToggle
    )
  );
}
    return module.exports;
  }
});
