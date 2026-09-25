export type ManagerLocale = "en" | "zh";

export type TranslationKey =
  | "summary"
  | "eyebrow"
  | "title"
  | "intro"
  | "loading"
  | "configurationLoaded"
  | "noUsableConfig"
  | "unableLoad"
  | "configurationSaved"
  | "unableSave"
  | "permissionsRepaired"
  | "repairPermissions"
  | "unableRepair"
  | "localServerFound"
  | "authMode"
  | "localManagementAvailable"
  | "noLocalRootKey"
  | "invalidConfig"
  | "endpoint"
  | "endpointRequiredFirst"
  | "account"
  | "user"
  | "newUserKey"
  | "optional"
  | "existingKey"
  | "pasteUserKey"
  | "keyHint"
  | "save"
  | "verify"
  | "openStudio"
  | "unreachable"
  | "notReady"
  | "keyNotAccepted"
  | "connectedAs"
  | "recoverTitle"
  | "recoverHint"
  | "temporaryRootKey"
  | "pasteRootKey"
  | "listAccounts"
  | "listAccountsTitle"
  | "listAccountsHint"
  | "clearRootKey"
  | "rootKeyCleared"
  | "selectAccount"
  | "selectUser"
  | "chooseAccount"
  | "chooseUser"
  | "foundAccounts"
  | "foundUsers"
  | "rootKeyRequired"
  | "adminFailed"
  | "createAccountTitle"
  | "createAccountHint"
  | "createAccount"
  | "createUserTitle"
  | "createUserHint"
  | "createUser"
  | "noAccountsLoaded"
  | "regenerateTitle"
  | "regenerateHint"
  | "regenerateKey"
  | "accountId"
  | "userId"
  | "adminOperationComplete"
  | "keyRotated"
  | "toggleLabel"
  | "toggleStateOn"
  | "toggleStateOff"
  | "toggleAction"
  | "toggleFailed"
  | "aboutTitle"
  | "openRepository"
  | "checkUpdates"
  | "checkingUpdates"
  | "updateAvailable"
  | "upToDate"
  | "updateCheckFailed"
  | "viewRelease"
  | "isolationTitle"
  | "isolateByTopicLabel"
  | "isolationHint"
  | "isolationSaved"
  | "isolationSaveFailed"
  | "envOverrideWarning"
  | "peerIdLabel"
  | "peerIdPlaceholder"
  | "peerIdHint"
  | "peerIdHintEmpty"
  | "peerIdHintSet"
  | "peerIdMultiRepoNotice"
  | "peerIdEnvWarning"
  | "peerIdCredentialWarning"
  | "fillCurrentRepo"
  | "peerIdDetected"
  | "peerIdNotInRepo"
  | "peerIdSaved"
  | "peerIdSaveFailed"
  | "savePeerId"
  | "peerIdReloadNotice"
  | "reloadNotice"
  | "reloading"
  | "restartSucceeded"
  | "restartUnavailable"
  | "restartFailed"
  | "tuningTitle"
  | "tuningIntro"
  | "scoreThresholdLabel"
  | "scoreThresholdHint"
  | "recallLimitLabel"
  | "recallLimitHint"
  | "queryExpansionLabel"
  | "queryExpansionHint"
  | "queryExpansionAuto"
  | "queryExpansionOff"
  | "excludeUrisLabel"
  | "excludeUrisHint"
  | "defaultPlaceholder"
  | "saveTuning"
  | "tuningSaved"
  | "tuningSaveFailed"
  | "tuningEnvWarning"
  | "tuningReloadNotice";

export type Translation = (key: TranslationKey, params?: Record<string, string | number>) => string;

const en: Record<TranslationKey, string> = {
  summary: "OpenViking connection configuration and local diagnostics.",
  eyebrow: "OpenViking Manager",
  title: "Connect your memory workspace",
  intro: "Manage the client configuration used by the official OpenViking memory plugin. Your existing API key is never shown here.",
  loading: "Loading local OpenViking configuration…",
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
  toggleLabel: "OpenViking",
  toggleStateOn: "OpenViking memory is on for this session",
  toggleStateOff: "OpenViking memory is off for this session",
  toggleAction: "Toggle OpenViking memory for this session",
  toggleFailed: "Unable to update the OpenViking toggle.",
  aboutTitle: "About this plugin",
  openRepository: "Open on GitHub",
  checkUpdates: "Check for updates",
  checkingUpdates: "Checking for updates…",
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
  peerIdLabel: "Actor peer id (advanced)",
  peerIdPlaceholder: "leave empty for automatic per-repository isolation",
  peerIdHint: "Which peer (topic) this DSH process reports. This is process-level and different from the isolation switch above, which only sets the recall range.",
  peerIdHintEmpty: "Empty (recommended): the plugin derives a peer from each session's workspace git identity, so every repository is automatically its own topic. This is what you want when one DSH instance works across multiple repositories.",
  peerIdHintSet: "Set: every session in this process is pinned to this one peer and the automatic per-repository derivation is overridden. Use it only when one DSH instance serves a single repository, or when you deliberately want several repositories to share one topic. It also lets the OpenViking MCP tools scope to this peer instead of falling back to broad recall.",
  peerIdMultiRepoNotice: "For multi-repository isolation, leave this empty. The \"OpenViking MCP: actor-scoped recall needs an explicit peer id\" log line is expected in that case and can be ignored — it only affects the manual MCP tools, not the automatically injected memories.",
  peerIdEnvWarning: "OPENVIKING_PEER_ID is set in the environment and overrides this file. Remove the variable and restart the DSH process to change it.",
  peerIdCredentialWarning: "A top-level actor_peer_id / peer_id in ovcli.conf currently pins the peer. This plugin does not edit that credential key; saving a value here adds a plugin.peerId that outranks it, and clearing this field falls back to that credential rather than to automatic derivation.",
  fillCurrentRepo: "Fill from current repository",
  peerIdDetected: "Detected peer id for the current repository: {peerId}",
  peerIdNotInRepo: "The current workspace has no git remote to derive a peer id from. Leave the field empty for automatic behaviour, or enter one manually.",
  peerIdSaved: "Actor peer id saved.",
  peerIdSaveFailed: "Unable to save the actor peer id: {error}",
  savePeerId: "Save peer id",
  peerIdReloadNotice: "Saving the peer id reloads the official memory plugin the same way the isolation switch does: every open session is committed and archived once, and the OpenViking MCP tools are rebuilt briefly.",
  reloadNotice: "Saving reloads the official memory plugin automatically: it commits and archives every open session once, and briefly rebuilds the OpenViking MCP tools.",
  reloading: "Reloading the official memory plugin…",
  restartSucceeded: "The official memory plugin reloaded. The new setting is active.",
  restartUnavailable: "The official memory plugin is not loaded in this process. Restart the DSH instance manually to apply the change.",
  restartFailed: "Unable to restart the official memory plugin: {error}",
  tuningTitle: "Recall tuning",
  tuningIntro: "Fine-tune what the official memory plugin injects into each step. Values are written to ovcli.conf's plugin section; the threshold and query expansion are initialised to this plugin's defaults (0.5, off), while the item limit and excluded URIs keep the official defaults when left empty.",
  scoreThresholdLabel: "Recall score threshold",
  scoreThresholdHint: "Memories scoring below this are not injected. Raising it filters out weakly related hits. This plugin defaults to 0.5 (official default 0.35).",
  recallLimitLabel: "Maximum injected items",
  recallLimitHint: "How many memories one recall may return, 1 to 50. Empty keeps the server's own quotas (official default 10).",
  queryExpansionLabel: "Query expansion",
  queryExpansionHint: "When on, the server rewrites the whole prompt into extra search intents, which is what widens recall to unrelated memories. This plugin keeps it off.",
  queryExpansionAuto: "Automatic",
  queryExpansionOff: "Off",
  excludeUrisLabel: "Excluded URIs",
  excludeUrisHint: "One viking:// URI per line. Matching subtrees are never recalled — handy for generated directory files such as skills or resources indexes.",
  defaultPlaceholder: "default: {value}",
  saveTuning: "Save recall tuning",
  tuningSaved: "Recall tuning saved.",
  tuningSaveFailed: "Unable to save recall tuning: {error}",
  tuningEnvWarning: "{vars} is set in the environment and outranks this file. Remove the variable and restart the DSH process to change it.",
  tuningReloadNotice: "Saving these keys reloads the official memory plugin the same way the switch above does: every open session is committed and archived once, and the OpenViking MCP tools are rebuilt briefly.",
};

const zh: Record<TranslationKey, string> = {
  summary: "配置 OpenViking 连接并诊断本机状态。",
  eyebrow: "OpenViking 管理器",
  title: "连接你的记忆工作区",
  intro: "管理官方 OpenViking 记忆插件使用的客户端配置。已有 API Key 不会在此页面展示。",
  loading: "正在读取本机 OpenViking 配置…",
  configurationLoaded: "配置已加载。",
  noUsableConfig: "未找到可用的 ovcli.conf。",
  unableLoad: "无法加载配置。",
  configurationSaved: "配置已保存。已存储的用户 Key 保持掩码展示。",
  unableSave: "无法保存配置。",
  permissionsRepaired: "文件权限已修复。",
  repairPermissions: "修复文件权限",
  unableRepair: "无法修复文件权限。请手工修复 ~/.openviking/ovcli.conf。",
  localServerFound: "已发现本机服务配置",
  authMode: "认证模式",
  localManagementAvailable: "可使用本机管理能力",
  noLocalRootKey: "未发现本机 root key",
  invalidConfig: "该文件需要修复后才能安全复用。请填写正确值并保存兼容配置。",
  endpoint: "OpenViking 服务地址",
  endpointRequiredFirst: "请先在上方保存 OpenViking 服务地址，保存后再使用恢复或初始化工具。",
  account: "账号",
  user: "用户",
  newUserKey: "新的用户 Key",
  optional: "可选",
  existingKey: "已有 Key：{key}",
  pasteUserKey: "粘贴 user_key",
  keyHint: "留空可保留已有 Key。此字段只接受 user key，不能填写 root API key。",
  save: "保存配置",
  verify: "验证连接",
  openStudio: "打开 Studio",
  unreachable: "该服务地址无法访问 OpenViking。",
  notReady: "OpenViking 可访问，但尚未就绪。",
  keyNotAccepted: "服务已就绪，但提供的用户 Key 未获接受。",
  connectedAs: "已连接为 {account}/{user}。",
  recoverTitle: "恢复或初始化访问",
  recoverHint: "root API key 仅用于本次管理操作，绝不会写入 ovcli.conf。",
  temporaryRootKey: "临时 root API key",
  pasteRootKey: "仅为本次操作粘贴 root_api_key",
  listAccounts: "列出账号",
  listAccountsTitle: "本机服务上的账号和用户",
  listAccountsHint: "加载该 root API key 可管理的账号，然后可选择账号及其中的用户。",
  clearRootKey: "清除临时 root key",
  rootKeyCleared: "临时 root API key 已清除。",
  selectAccount: "已有账号",
  selectUser: "已有用户",
  chooseAccount: "请选择账号",
  chooseUser: "请选择用户",
  foundAccounts: "发现 {count} 个账号。",
  foundUsers: "账号 {account} 中发现 {count} 个用户。",
  rootKeyRequired: "请为本次管理操作输入 root API key。",
  adminFailed: "OpenViking 管理请求失败。",
  createAccountTitle: "创建账号和首位用户",
  createAccountHint: "创建全新账号，并设置它的首位管理员用户。",
  createAccount: "创建账号",
  createUserTitle: "在当前账号中创建用户",
  createUserHint: "向已存在的账号中添加新用户。",
  createUser: "创建用户",
  noAccountsLoaded: "请先列出账号，再选择要添加用户的账号。",
  regenerateTitle: "重新生成已有用户 Key",
  regenerateHint: "为已存在的账号和用户重新签发用户 Key。",
  regenerateKey: "重新生成 Key",
  accountId: "账号 ID",
  userId: "用户 ID",
  adminOperationComplete: "{operation} 已完成。新的用户 Key 已准备好保存。",
  keyRotated: "Key 已轮换。请在本设备保存新 Key，并更新其他设备。",
  toggleLabel: "OpenViking",
  toggleStateOn: "本会话 OpenViking 记忆已开启",
  toggleStateOff: "本会话 OpenViking 记忆已关闭",
  toggleAction: "切换本会话的 OpenViking 记忆开关",
  toggleFailed: "无法更新 OpenViking 开关。",
  aboutTitle: "关于本插件",
  openRepository: "在 GitHub 打开",
  checkUpdates: "检查新版本",
  checkingUpdates: "正在检查新版本…",
  updateAvailable: "发现新版本 {latest}（当前 {current}）。",
  upToDate: "当前已是最新版本（{current}）。",
  updateCheckFailed: "无法检查更新：{error}",
  viewRelease: "查看版本",
  isolationTitle: "记忆隔离",
  isolateByTopicLabel: "不允许跨主题共享记忆",
  isolationHint: "开启时，自动召回仅返回当前项目（peer）的记忆；关闭则允许跨主题共享。用户级画像注入和共享资源目录不受此开关影响。",
  isolationSaved: "记忆隔离设置已保存。",
  isolationSaveFailed: "无法保存记忆隔离设置。",
  envOverrideWarning: "环境变量 OPENVIKING_RECALL_PEER_SCOPE 已设置并覆盖此文件配置。请移除该变量并重启 DSH 进程。",
  peerIdLabel: "Actor peer id（高级）",
  peerIdPlaceholder: "留空则按仓库自动隔离",
  peerIdHint: "本 DSH 进程归属哪个 peer（主题）。这是进程级设置，与上方隔离开关不同——隔离开关只决定召回范围。",
  peerIdHintEmpty: "留空（推荐）：插件按每个会话所在 workspace 的 git 身份自动推导 peer，每个仓库自动成为独立主题。当一个 DSH 实例在多个仓库间工作时，这正是你需要的。",
  peerIdHintSet: "填写：本进程的所有会话都被钉死到这一个 peer，自动的按仓库推导被覆盖。仅适用于「一个 DSH 实例只服务单个仓库」，或你有意让多个仓库共享同一主题的情况。填写后 OpenViking MCP 工具也能限定到该 peer，不再退化为广召回。",
  peerIdMultiRepoNotice: "如需多仓库工作时的记忆隔离，请留空。此时出现的「OpenViking MCP: actor-scoped recall needs an explicit peer id」日志属正常现象，可忽略——它只影响手动调用的 MCP 工具，不影响自动注入到上下文的记忆隔离。",
  peerIdEnvWarning: "环境变量 OPENVIKING_PEER_ID 已设置并覆盖此文件配置。请移除该变量并重启 DSH 进程。",
  peerIdCredentialWarning: "ovcli.conf 顶层的 actor_peer_id / peer_id 当前钉住了 peer。本插件不编辑该凭证键；在此保存的值会写入优先级更高的 plugin.peerId，而清空此字段会回落到该凭证键，而不是回到自动推导。",
  fillCurrentRepo: "填入当前仓库",
  peerIdDetected: "已识别当前仓库的 peer id：{peerId}",
  peerIdNotInRepo: "当前工作区没有可用于推导 peer id 的 git 远端。可留空使用自动行为，或手动输入。",
  peerIdSaved: "Actor peer id 已保存。",
  peerIdSaveFailed: "无法保存 actor peer id：{error}",
  savePeerId: "保存 peer id",
  peerIdReloadNotice: "保存 peer id 会像隔离开关一样自动重新加载官方记忆插件：会对所有打开的会话执行一次提交归档，并短暂重建 OpenViking MCP 工具。",
  reloadNotice: "保存后会自动重新加载官方记忆插件：会对所有打开的会话执行一次提交归档，并短暂重建 OpenViking MCP 工具。",
  reloading: "正在重新加载官方记忆插件…",
  restartSucceeded: "官方记忆插件已重新加载，新设置已生效。",
  restartUnavailable: "当前进程中未加载官方记忆插件。请手动重启 DSH 实例使更改生效。",
  restartFailed: "无法重启官方记忆插件：{error}",
  tuningTitle: "召回调优",
  tuningIntro: "调整官方记忆插件每次注入的内容。取值写入 ovcli.conf 的 plugin 段；分数阈值与查询扩写首次打开时按本插件默认写入（0.5、关闭），条数上限与排除 URI 留空则保持官方默认。",
  scoreThresholdLabel: "召回分数阈值",
  scoreThresholdHint: "低于该分数的记忆不会注入。调高可过滤弱相关内容。本插件默认 0.5（官方默认 0.35）。",
  recallLimitLabel: "单次注入条数上限",
  recallLimitHint: "一次召回最多返回多少条记忆，取值 1–50。留空则沿用服务端默认配额（官方默认 10）。",
  queryExpansionLabel: "查询扩写",
  queryExpansionHint: "开启时服务端会把整段 prompt 扩写成多组检索意图，弱相关内容变多正源于此。本插件默认关闭。",
  queryExpansionAuto: "自动",
  queryExpansionOff: "关闭",
  excludeUrisLabel: "排除的 URI",
  excludeUrisHint: "每行一个 viking:// URI。匹配到这些子树的记忆不会被召回，适合排除 skills、resources 之类自动生成的目录索引。",
  defaultPlaceholder: "默认：{value}",
  saveTuning: "保存召回调优",
  tuningSaved: "召回调优设置已保存。",
  tuningSaveFailed: "无法保存召回调优设置：{error}",
  tuningEnvWarning: "环境变量 {vars} 已设置并覆盖此文件配置。请移除该变量并重启 DSH 进程。",
  tuningReloadNotice: "保存这些键同样会自动重新加载官方记忆插件，副作用与上方开关一致：会对所有打开的会话执行一次提交归档，并短暂重建 OpenViking MCP 工具。",
};

export const dictionaries = { en, zh } as const;

export function localeFrom(value: string | undefined): ManagerLocale {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function browserLocale(): ManagerLocale {
  if (typeof document !== "undefined" && document.documentElement.lang !== "") return localeFrom(document.documentElement.lang);
  if (typeof navigator !== "undefined") return localeFrom(navigator.language);
  return "en";
}

export function createTranslation(locale: string | undefined): Translation {
  const dictionary = dictionaries[localeFrom(locale)];
  return (key, params) => (params === undefined ? dictionary[key] : dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`)));
}
