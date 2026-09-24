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
  viewRelease: "View release",
  isolationTitle: "Memory isolation",
  isolateByTopicLabel: "Disallow sharing memories across topics",
  isolationHint: "When on, automatic recall only returns memories from the current project (peer); turning it off allows cross-topic sharing. The user-level profile injection and the shared resources directory are not affected.",
  isolationSaved: "Memory isolation setting saved.",
  isolationSaveFailed: "Unable to save the memory isolation setting.",
  envOverrideWarning: "OPENVIKING_RECALL_PEER_SCOPE is set and overrides this file setting. Remove the variable and restart the DSH process to change it.",
  reloadNotice: "Saving reloads the official memory plugin automatically: it commits and archives every open session once, and briefly rebuilds the OpenViking MCP tools.",
  reloading: "Reloading the official memory plugin\u2026",
  restartRequired: "The automatic reload did not complete, so the new setting is not active yet. Reload manually here or restart the DSH instance.",
  restartPlugin: "Restart official memory plugin",
  restartSucceeded: "The official memory plugin reloaded. The new setting is active.",
  restartUnavailable: "The official memory plugin is not loaded in this process. Restart the DSH instance manually to apply the change.",
  restartFailed: "Unable to restart the official memory plugin: {error}",
  tuningTitle: "Recall tuning",
  tuningIntro: "Fine-tune what the official memory plugin injects into each step. Values are written to ovcli.conf's plugin section; leave a field empty to keep the official default.",
  scoreThresholdLabel: "Recall score threshold",
  scoreThresholdHint: "Memories scoring below this are not injected. Raising it filters out weakly related hits (official default 0.35).",
  recallLimitLabel: "Maximum injected items",
  recallLimitHint: "How many memories one recall may return, 1 to 50. Empty keeps the server's own quotas (official default 10).",
  queryExpansionLabel: "Query expansion",
  queryExpansionHint: "When on, the server rewrites the whole prompt into extra search intents, which is what widens recall to unrelated memories.",
  queryExpansionAuto: "Automatic (official default)",
  queryExpansionOff: "Off",
  excludeUrisLabel: "Excluded URIs",
  excludeUrisHint: "One viking:// URI per line. Matching subtrees are never recalled \u2014 handy for generated directory files such as skills or resources indexes.",
  defaultPlaceholder: "default: {value}",
  saveTuning: "Save recall tuning",
  tuningSaved: "Recall tuning saved.",
  tuningSaveFailed: "Unable to save recall tuning: {error}",
  tuningEnvWarning: "{vars} is set in the environment and outranks this file. Remove the variable and restart the DSH process to change it.",
  tuningReloadNotice: "Saving these keys reloads the official memory plugin the same way the switch above does: every open session is committed and archived once, and the OpenViking MCP tools are rebuilt briefly."
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
  viewRelease: "\u67E5\u770B\u7248\u672C",
  isolationTitle: "\u8BB0\u5FC6\u9694\u79BB",
  isolateByTopicLabel: "\u4E0D\u5141\u8BB8\u8DE8\u4E3B\u9898\u5171\u4EAB\u8BB0\u5FC6",
  isolationHint: "\u5F00\u542F\u65F6\uFF0C\u81EA\u52A8\u53EC\u56DE\u4EC5\u8FD4\u56DE\u5F53\u524D\u9879\u76EE\uFF08peer\uFF09\u7684\u8BB0\u5FC6\uFF1B\u5173\u95ED\u5219\u5141\u8BB8\u8DE8\u4E3B\u9898\u5171\u4EAB\u3002\u7528\u6237\u7EA7\u753B\u50CF\u6CE8\u5165\u548C\u5171\u4EAB\u8D44\u6E90\u76EE\u5F55\u4E0D\u53D7\u6B64\u5F00\u5173\u5F71\u54CD\u3002",
  isolationSaved: "\u8BB0\u5FC6\u9694\u79BB\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002",
  isolationSaveFailed: "\u65E0\u6CD5\u4FDD\u5B58\u8BB0\u5FC6\u9694\u79BB\u8BBE\u7F6E\u3002",
  envOverrideWarning: "\u73AF\u5883\u53D8\u91CF OPENVIKING_RECALL_PEER_SCOPE \u5DF2\u8BBE\u7F6E\u5E76\u8986\u76D6\u6B64\u6587\u4EF6\u914D\u7F6E\u3002\u8BF7\u79FB\u9664\u8BE5\u53D8\u91CF\u5E76\u91CD\u542F DSH \u8FDB\u7A0B\u3002",
  reloadNotice: "\u4FDD\u5B58\u540E\u4F1A\u81EA\u52A8\u91CD\u65B0\u52A0\u8F7D\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\uFF1A\u4F1A\u5BF9\u6240\u6709\u6253\u5F00\u7684\u4F1A\u8BDD\u6267\u884C\u4E00\u6B21\u63D0\u4EA4\u5F52\u6863\uFF0C\u5E76\u77ED\u6682\u91CD\u5EFA OpenViking MCP \u5DE5\u5177\u3002",
  reloading: "\u6B63\u5728\u91CD\u65B0\u52A0\u8F7D\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\u2026",
  restartRequired: "\u81EA\u52A8\u91CD\u65B0\u52A0\u8F7D\u672A\u5B8C\u6210\uFF0C\u65B0\u7684\u8BBE\u7F6E\u5C1A\u672A\u751F\u6548\u3002\u53EF\u5728\u6B64\u624B\u52A8\u91CD\u65B0\u52A0\u8F7D\uFF0C\u6216\u91CD\u542F DSH \u5B9E\u4F8B\u3002",
  restartPlugin: "\u91CD\u542F\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6",
  restartSucceeded: "\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\u5DF2\u91CD\u65B0\u52A0\u8F7D\uFF0C\u65B0\u8BBE\u7F6E\u5DF2\u751F\u6548\u3002",
  restartUnavailable: "\u5F53\u524D\u8FDB\u7A0B\u4E2D\u672A\u52A0\u8F7D\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\u3002\u8BF7\u624B\u52A8\u91CD\u542F DSH \u5B9E\u4F8B\u4F7F\u66F4\u6539\u751F\u6548\u3002",
  restartFailed: "\u65E0\u6CD5\u91CD\u542F\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\uFF1A{error}",
  tuningTitle: "\u53EC\u56DE\u8C03\u4F18",
  tuningIntro: "\u8C03\u6574\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\u6BCF\u6B21\u6CE8\u5165\u7684\u5185\u5BB9\u3002\u53D6\u503C\u5199\u5165 ovcli.conf \u7684 plugin \u6BB5\uFF1B\u5B57\u6BB5\u7559\u7A7A\u5373\u4FDD\u6301\u5B98\u65B9\u9ED8\u8BA4\u503C\u3002",
  scoreThresholdLabel: "\u53EC\u56DE\u5206\u6570\u9608\u503C",
  scoreThresholdHint: "\u4F4E\u4E8E\u8BE5\u5206\u6570\u7684\u8BB0\u5FC6\u4E0D\u4F1A\u6CE8\u5165\u3002\u8C03\u9AD8\u53EF\u8FC7\u6EE4\u5F31\u76F8\u5173\u5185\u5BB9\uFF08\u5B98\u65B9\u9ED8\u8BA4 0.35\uFF09\u3002",
  recallLimitLabel: "\u5355\u6B21\u6CE8\u5165\u6761\u6570\u4E0A\u9650",
  recallLimitHint: "\u4E00\u6B21\u53EC\u56DE\u6700\u591A\u8FD4\u56DE\u591A\u5C11\u6761\u8BB0\u5FC6\uFF0C\u53D6\u503C 1\u201350\u3002\u7559\u7A7A\u5219\u6CBF\u7528\u670D\u52A1\u7AEF\u9ED8\u8BA4\u914D\u989D\uFF08\u5B98\u65B9\u9ED8\u8BA4 10\uFF09\u3002",
  queryExpansionLabel: "\u67E5\u8BE2\u6269\u5199",
  queryExpansionHint: "\u5F00\u542F\u65F6\u670D\u52A1\u7AEF\u4F1A\u628A\u6574\u6BB5 prompt \u6269\u5199\u6210\u591A\u7EC4\u68C0\u7D22\u610F\u56FE\uFF0C\u5F31\u76F8\u5173\u5185\u5BB9\u53D8\u591A\u6B63\u6E90\u4E8E\u6B64\u3002",
  queryExpansionAuto: "\u81EA\u52A8\uFF08\u5B98\u65B9\u9ED8\u8BA4\uFF09",
  queryExpansionOff: "\u5173\u95ED",
  excludeUrisLabel: "\u6392\u9664\u7684 URI",
  excludeUrisHint: "\u6BCF\u884C\u4E00\u4E2A viking:// URI\u3002\u5339\u914D\u5230\u8FD9\u4E9B\u5B50\u6811\u7684\u8BB0\u5FC6\u4E0D\u4F1A\u88AB\u53EC\u56DE\uFF0C\u9002\u5408\u6392\u9664 skills\u3001resources \u4E4B\u7C7B\u81EA\u52A8\u751F\u6210\u7684\u76EE\u5F55\u7D22\u5F15\u3002",
  defaultPlaceholder: "\u9ED8\u8BA4\uFF1A{value}",
  saveTuning: "\u4FDD\u5B58\u53EC\u56DE\u8C03\u4F18",
  tuningSaved: "\u53EC\u56DE\u8C03\u4F18\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002",
  tuningSaveFailed: "\u65E0\u6CD5\u4FDD\u5B58\u53EC\u56DE\u8C03\u4F18\u8BBE\u7F6E\uFF1A{error}",
  tuningEnvWarning: "\u73AF\u5883\u53D8\u91CF {vars} \u5DF2\u8BBE\u7F6E\u5E76\u8986\u76D6\u6B64\u6587\u4EF6\u914D\u7F6E\u3002\u8BF7\u79FB\u9664\u8BE5\u53D8\u91CF\u5E76\u91CD\u542F DSH \u8FDB\u7A0B\u3002",
  tuningReloadNotice: "\u4FDD\u5B58\u8FD9\u4E9B\u952E\u540C\u6837\u4F1A\u81EA\u52A8\u91CD\u65B0\u52A0\u8F7D\u5B98\u65B9\u8BB0\u5FC6\u63D2\u4EF6\uFF0C\u526F\u4F5C\u7528\u4E0E\u4E0A\u65B9\u5F00\u5173\u4E00\u81F4\uFF1A\u4F1A\u5BF9\u6240\u6709\u6253\u5F00\u7684\u4F1A\u8BDD\u6267\u884C\u4E00\u6B21\u63D0\u4EA4\u5F52\u6863\uFF0C\u5E76\u77ED\u6682\u91CD\u5EFA OpenViking MCP \u5DE5\u5177\u3002"
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
  const [recallScope, setRecallScope] = (0, import_react.useState)();
  const [recallTuning, setRecallTuning] = (0, import_react.useState)();
  const [tuningDraft, setTuningDraft] = (0, import_react.useState)({ scoreThreshold: "", recallLimit: "", recallQueryExpansion: "auto", recallExcludeUris: "" });
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
  const loadRecallScope = async (hideOnFailure = true, initializeDefault = false) => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`))).value;
      setRecallScope(value);
      if (initializeDefault && value.source === "default") void setScope(true);
    } catch {
      if (hideOnFailure) setRecallScope(void 0);
    }
  };
  const loadRecallTuning = async (hideOnFailure = true) => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning`))).value;
      setRecallTuning(value);
    } catch {
      if (hideOnFailure) setRecallTuning(void 0);
    }
  };
  (0, import_react.useEffect)(() => {
    void load();
    void loadVersion();
    void loadRecallScope(true, true);
    void loadRecallTuning(true);
  }, []);
  (0, import_react.useEffect)(() => {
    if (!recallTuning) return;
    setTuningDraft({
      scoreThreshold: recallTuning.scoreThreshold.configured ? String(recallTuning.scoreThreshold.value) : "",
      recallLimit: recallTuning.recallLimit.configured ? String(recallTuning.recallLimit.value) : "",
      recallQueryExpansion: recallTuning.recallQueryExpansion.value,
      recallExcludeUris: recallTuning.recallExcludeUris.value.join("\n")
    });
  }, [recallTuning]);
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
  const runRestart = async () => {
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope/restart`, { method: "POST" }))).value;
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
  const setScope = async (isolate) => {
    const previous = recallScope;
    setBusy(true);
    if (previous) setRecallScope({ ...previous, scope: isolate ? "actor" : "all" });
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-scope`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: isolate ? "actor" : "all" })
      }))).value;
      setRecallScope(value);
      if (value.restartPending) {
        setStatus(t("reloading"));
        await runRestart();
      } else {
        setStatus(t("isolationSaved"));
      }
    } catch {
      if (previous) setRecallScope(previous);
      setStatus(t("isolationSaveFailed"));
    } finally {
      setBusy(false);
    }
  };
  const restartPlugin = async () => {
    setBusy(true);
    try {
      await runRestart();
    } finally {
      setBusy(false);
    }
  };
  const tuningEnvVars = recallTuning === void 0 ? [] : [
    recallTuning.scoreThreshold,
    recallTuning.recallLimit,
    recallTuning.recallQueryExpansion,
    recallTuning.recallExcludeUris
  ].filter((knob) => knob.source === "env").map((knob) => knob.envVar);
  const saveTuning = async (event) => {
    event.preventDefault();
    const payload = {
      scoreThreshold: tuningDraft.scoreThreshold.trim() === "" ? null : Number(tuningDraft.scoreThreshold),
      recallLimit: tuningDraft.recallLimit.trim() === "" ? null : Number(tuningDraft.recallLimit),
      recallQueryExpansion: tuningDraft.recallQueryExpansion,
      recallExcludeUris: tuningDraft.recallExcludeUris.split("\n").map((line) => line.trim()).filter(Boolean)
    };
    setBusy(true);
    try {
      const value = (await responseJson(await fetchFn(`${apiPrefix}/recall-tuning`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }))).value;
      setRecallTuning(value);
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
    recallScope === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "ovm-card", "aria-label": t("isolationTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("isolationTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "ovm-switchRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "ovm-switchBox", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              role: "switch",
              className: "ovm-switchInput",
              disabled: busy || recallScope.source === "env",
              checked: recallScope.scope === "actor",
              onChange: (event) => void setScope(event.target.checked)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ovm-switchTrack", "aria-hidden": "true" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("isolateByTopicLabel") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint ovm-isolationHint", children: t("isolationHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint ovm-isolationHint", children: t("reloadNotice") }),
      recallScope.source === "env" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", role: "alert", children: t("envOverrideWarning") }) : null,
      recallScope.restartPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-restartRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", role: "alert", children: t("restartRequired") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void restartPlugin(), disabled: busy, children: t("restartPlugin") })
      ] }) : null
    ] }),
    recallTuning === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "ovm-card", "aria-label": t("tuningTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("tuningTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint ovm-tuningIntro", children: t("tuningIntro") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (event) => void saveTuning(event), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-tuningGrid", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-tuningField", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("scoreThresholdLabel"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  type: "number",
                  min: 0,
                  max: 1,
                  step: "any",
                  value: tuningDraft.scoreThreshold,
                  placeholder: t("defaultPlaceholder", { value: "0.35" }),
                  disabled: busy || recallTuning.scoreThreshold.source === "env",
                  onChange: (event) => setTuningDraft({ ...tuningDraft, scoreThreshold: event.target.value })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("scoreThresholdHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-tuningField", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("recallLimitLabel"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  type: "number",
                  min: 1,
                  max: 50,
                  step: 1,
                  value: tuningDraft.recallLimit,
                  placeholder: t("defaultPlaceholder", { value: "10" }),
                  disabled: busy || recallTuning.recallLimit.source === "env",
                  onChange: (event) => setTuningDraft({ ...tuningDraft, recallLimit: event.target.value })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("recallLimitHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-tuningField", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("queryExpansionLabel"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "select",
                {
                  value: tuningDraft.recallQueryExpansion,
                  disabled: busy || recallTuning.recallQueryExpansion.source === "env",
                  onChange: (event) => setTuningDraft({ ...tuningDraft, recallQueryExpansion: event.target.value === "off" ? "off" : "auto" }),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: t("queryExpansionAuto") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "off", children: t("queryExpansionOff") })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("queryExpansionHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-tuningField", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              t("excludeUrisLabel"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "textarea",
                {
                  rows: 4,
                  value: tuningDraft.recallExcludeUris,
                  placeholder: "viking://",
                  disabled: busy || recallTuning.recallExcludeUris.source === "env",
                  onChange: (event) => setTuningDraft({ ...tuningDraft, recallExcludeUris: event.target.value })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("excludeUrisHint") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-hint", children: t("tuningReloadNotice") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ovm-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", disabled: busy, children: t("saveTuning") }) })
      ] }),
      tuningEnvVars.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", role: "alert", children: t("tuningEnvWarning", { vars: tuningEnvVars.join(", ") }) }) : null,
      recallTuning.restartPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ovm-restartRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "ovm-warning", role: "alert", children: t("restartRequired") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => void restartPlugin(), disabled: busy, children: t("restartPlugin") })
      ] }) : null
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
.ovm-tuningIntro{max-width:660px;margin:0 0 4px}.ovm-tuningGrid{display:grid;gap:14px;margin-top:18px}.ovm-tuningField{display:grid;gap:6px}textarea{width:100%;min-height:84px;border:1px solid var(--dsw-alias-border-l2,#ccd3da);border-radius:7px;padding:8px 10px;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:400;resize:vertical}
`;
var toggleCss = `
.ovm-header{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px 24px}.ovm-headerMain{flex:1 1 320px;min-width:0}.ovm-titleRow{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px}.ovm-titleRow h1{margin:4px 0 10px}.ovm-versionTag{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:999px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);color:#2f6f5e;font-size:12px;font-weight:700;letter-spacing:.02em;padding:2px 9px;line-height:1.5}.ovm-about{flex:0 0 auto;align-self:flex-start;margin-top:26px;display:flex;flex-direction:column;align-items:stretch;gap:8px;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);padding:12px 14px}.ovm-aboutActions{display:flex;flex-direction:column;align-items:stretch;gap:8px}.ovm-aboutActions button,.ovm-aboutActions a{border-radius:7px;font:inherit;font-size:12px;text-decoration:none;white-space:nowrap;text-align:center}.ovm-aboutActions button{border:1px solid #1f4038;background:transparent;color:#1f4038;padding:6px 11px;cursor:pointer}.ovm-aboutActions button:disabled{opacity:.55}.ovm-aboutActions a{color:#1f5d50;font-weight:600;padding:4px 0}.ovm-aboutStatus{margin:0;font-size:12px;line-height:1.5;color:#365b4f;max-width:220px}.ovm-about .ovm-warning{display:block;font-size:12px;max-width:220px}.ovm-header+.ovm-card{margin-top:8px}
.ovm-standaloneToggle{padding:12px 28px 0}.ovm-ovToggle{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,#ccd3da);border-radius:999px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);color:var(--dsw-alias-label-secondary,#59636e);padding:2px 10px;font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer}.ovm-ovToggle:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#202124)}.ovm-ovToggle:focus-visible{outline:2px solid #1f5d50;outline-offset:2px}.ovm-ovToggle:disabled{opacity:.6;cursor:default}.ovm-ovToggleDot{width:7px;height:7px;border-radius:50%;background:#1f8a70;flex:0 0 auto}.ovm-ovToggleOff .ovm-ovToggleDot{background:#9aa5b1}.ovm-ovToggleOff{color:var(--dsw-alias-label-tertiary,#77818b)}
.ovm-restartRow{display:grid;gap:8px;margin-top:12px}.ovm-restartRow .ovm-warning{margin:0}.ovm-restartRow button{justify-self:start;border:0;border-radius:7px;padding:8px 13px;font:inherit;font-size:13px;background:#1f4038;color:#fff;cursor:pointer}.ovm-restartRow button:disabled{opacity:.55}
.ovm-switchRow{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:13px;font-weight:600;cursor:pointer}.ovm-switchBox{position:relative;display:inline-flex;flex:0 0 auto;width:36px;height:20px}.ovm-switchInput{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:999px;opacity:0;cursor:pointer}.ovm-switchInput:disabled{cursor:default}.ovm-switchTrack{position:relative;width:36px;height:20px;border:1px solid var(--dsw-alias-border-l2,#ccd3da);border-radius:999px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);transition:background .15s ease,border-color .15s ease;pointer-events:none}.ovm-switchTrack::after{content:"";position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(32,33,36,.35);transition:transform .15s ease}.ovm-switchInput:checked+.ovm-switchTrack{background:#1f5d50;border-color:#1f5d50}.ovm-switchInput:checked+.ovm-switchTrack::after{transform:translateX(16px)}.ovm-switchInput:disabled+.ovm-switchTrack{opacity:.55}.ovm-switchInput:focus-visible+.ovm-switchTrack{outline:2px solid #1f5d50;outline-offset:2px}.ovm-isolationHint{margin-top:12px}
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
