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
  | "toggleLabelOff"
  | "toggleAction"
  | "toggleFailed"
  | "aboutTitle"
  | "currentVersion"
  | "githubRepository"
  | "openRepository"
  | "checkUpdates"
  | "checkingUpdates"
  | "updateAvailable"
  | "upToDate"
  | "updateCheckFailed"
  | "viewRelease";

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
  toggleLabel: "OpenViking on",
  toggleLabelOff: "OpenViking off",
  toggleAction: "Toggle OpenViking memory for this session",
  toggleFailed: "Unable to update the OpenViking toggle.",
  aboutTitle: "About this plugin",
  currentVersion: "Installed version: {version}",
  githubRepository: "GitHub repository",
  openRepository: "Open on GitHub",
  checkUpdates: "Check for updates",
  checkingUpdates: "Checking for updates…",
  updateAvailable: "A new version {latest} is available (installed {current}).",
  upToDate: "You are on the latest version ({current}).",
  updateCheckFailed: "Unable to check for updates: {error}",
  viewRelease: "View release",
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
  toggleLabel: "OpenViking 开",
  toggleLabelOff: "OpenViking 关",
  toggleAction: "切换本会话的 OpenViking 记忆开关",
  toggleFailed: "无法更新 OpenViking 开关。",
  aboutTitle: "关于本插件",
  currentVersion: "已安装版本：{version}",
  githubRepository: "GitHub 仓库",
  openRepository: "在 GitHub 打开",
  checkUpdates: "检查新版本",
  checkingUpdates: "正在检查新版本…",
  updateAvailable: "发现新版本 {latest}（当前 {current}）。",
  upToDate: "当前已是最新版本（{current}）。",
  updateCheckFailed: "无法检查更新：{error}",
  viewRelease: "查看版本",
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
