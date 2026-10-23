# AGENTS.md

## 项目目标

`dsh-openviking-manager` 是 OpenViking 的 DSH 配置管理 UI。它管理 `~/.openviking/ovcli.conf`、连接诊断和用户 Key 引导，并提供会话级的 OpenViking 记忆开关；它同时是官方配置面的编辑器与状态面板（项目级记忆隔离：默认 `recallPeerScope: actor`，peer 由官方按会话 workspace 的 git 身份推导，保存后自动重载官方插件）。**不**实现记忆同步/召回本身，也不替代 `@openviking/dsh-memory-plugin`。

## 关键边界

- `ovcli.conf` 是日常客户端配置真源。读取、导入和写入必须保持官方插件兼容。
- `root_api_key` 只能用于一次性的 Admin API 操作；不得写入 `ovcli.conf`、日志、错误文本、浏览器持久化存储或测试快照。
- `user_key` 不得从服务端 API 回传给浏览器。已有 key 仅以掩码展示；新建或轮换产生的新 key 只可在当前表单内等待用户保存。
- 任何新增 HTTP 路由都必须保持同源检查、`no-store` 响应和输入验证。
- 会话开关只拦截官方插件在该会话的注入/写入/MCP 请求，不修改其行为定义：开关状态为进程内存（默认开启，重启复位），关闭只对之后的 agent step 生效。
- 本插件不修改 `ov.conf`、不编排 OpenViking 容器/服务，也不复制官方记忆插件能力。
- 持久控制只写官方声明的配置面（`ovcli.conf` 的 `plugin.dsh` 段）；键名与取值域以 `@openviking/dsh-memory-plugin` 的 config-schema 为唯一真源，写入保留未知键与共享 `plugin` 段（它属于本机其他 harness），不发明自有配置键。隔离开关写 `plugin.dsh.recallPeerScope`（显式 `actor`/`all`，不靠删键回落）与可选的 `plugin.dsh.peerId`；召回调优卡片暴露官方已声明的 `scoreThreshold`、`recallLimit`、`recallQueryExpansion`、`recallExcludeUris`、`recallEventsDecayProtection`、`timeoutMs`、`recallContextTimeoutMs` 七个键。其中 `scoreThreshold`（0.5）、`recallQueryExpansion`（off）与 `timeoutMs`（15000）带**产品默认**：首次打开配置页且没有任何层定义该键时自动写入并重载——写的是官方键，不改官方默认，文件/工作区/ env 的取值仍然优先。`timeoutMs` 的官方 dsh harness 默认是 10000，产品默认钉到 15000 是为了在后端 search/rerank 卡死时给单次请求一个明确上限；`recallContextTimeoutMs` 官方默认 0（按 `timeoutMs` 与扩写/改写地板派生），不钉产品默认。留空即回到该键的默认值，恢复默认时同时清理共享段的同名残留键；越界或格式错误的请求被拒绝且不落盘。
- 隔离模型：隔离单元是**项目**（peer），由官方按会话所在 workspace 的 git 身份推导，`actor` 只召回本项目。必须能表达「同项目跨 agent/机器共享、不同项目即使同机同 agent 隔离」；不得用机器级 pin 去实现项目隔离（pin 会让所有项目共用一个 peer，UI 已标注该代价）。目录不在 git 仓库时 peer 为空、写入用户级空间，必须明确提示。
- 工作区层（`<repo>/.openviking/config.json`、`config.local.json`、`~/.openviking/workspaces/<slot>.json`）优先级**高于** `ovcli.conf`：本插件只经官方 `resolveSettings` / `resolveWorkspaceSettings` 读取并展示其声明与风险（`recall.peer_scope: all`、`recall.enabled: false`、`capture.enabled: false`、`peer.id` 钉死、`no-peer`、root key 凭据），**不写入**这些文件，也不自行重写合并规则。
- workspace 层配置由用户与仓库手工管理：本插件只读、只展示，不提供编辑界面。`~/.openviking/workspaces/<slot>.json` 同属该层。
- 官方插件的重载只通过宿主 Cordis 公开机制（先按 `openviking-memory` 显示名扫描 registry，再退回模块身份 `registry.get()`；官方 0.5.29 的入口会 import 宿主包，故不以 import 入口为主路径），使其重新读取配置；不修改官方插件代码与行为定义。隔离与召回调优设置保存后自动执行一次重载，UI 文案提前提示重载及其副作用；重载结果在状态行报告，未完成或官方插件未加载时由状态行给出重启 DSH 实例的指引。
- env 层（如 `OPENVIKING_RECALL_PEER_SCOPE`、`OPENVIKING_PEER_ID` 及各召回调优键的 `OPENVIKING_*` 变量）优先级高于本插件可写的任何文件，且进程启动后不可变；UI 必须显示其覆盖状态，而不是让文件设置假装生效。工作区层介于 env 与 `plugin.<harness>` 之间，同样要在 UI 中如实标注来源。

## 技术约定

- Node.js ESM + TypeScript；运行时文件在 `src/`，编译输出为 `lib/`。
- DSH Web 插件浏览器入口由 `src/client/index.tsx` 注册到 `plugins.bundle.config`，包导出为 `./client`。
- UI 的可见文案一律通过 `src/client/i18n.ts` 的 `TranslationKey`。新增 key 时必须同步 `en` 和 `zh` 两个字典。
- 在 DSH 中跟随 `ctx.locale`；独立 E2E 页面通过浏览器语言回退。
- CSS 位于 `src/client/styles.ts`。维持 DSH 设计 token、原生可访问控件和响应式栅格。
- `npm run build` 生成 `lib/`。`lib/` **不入库**，出厂产物由发版 workflow 生成，见「分发与安装」。不要把 `.tgz` 提交到仓库。

## 分发与安装

- **`lib/` 不入库**（`.gitignore` 覆盖整个目录）。产物由 `.github/workflows/release.yml` 在门禁通过后 `npm pack` 生成，同一个 tgz 既作 GitHub Release 附件，也 `npm publish` 到 npm。用户侧只取用现成产物，不会运行 `tsc`/`esbuild`。
- **安装渠道只有两条**：npm 包（`dsh plugin --profile web add dsh-openviking-manager@latest`）与 Release 附件 URL（`.../releases/download/<TAG>/dsh-openviking-manager-<VERSION>.tgz`）。**不支持 `github:` 安装**：仓库树没有 `lib/`，装上去插件加载不起来。README、Release 正文、AI 助手回答都不得把 `github:` 写成可用方式。
- 不要添加 `prepare`、`prepublishOnly` 或其他安装期构建脚本。pnpm 会阻止 git 依赖的构建脚本并等待 `allowBuilds` 授权，那会让直接安装变成需要人工授权才能完成；`scripts/assert-pack.mjs` 与 `test/unit/release-notes.test.mjs` 会拦。
- `lib/standalone.js` 只是 Playwright 使用的浏览器 fixture，不提交、不随包发布；`npm run test:e2e` 会先重新构建它。`npm run build` 先清空 `lib/` 再编译，避免删掉的源码留下过期产物。
- 发版由 workflow 执行（push 到 main 且改动 `package.json`，或 `workflow_dispatch`）：门禁 → 打 tag →（仅正式版）`npm publish` → 建 Release 并附 tgz。**不要手工打 tag 或 publish**。
- 版本号里的 `-` 决定渠道：**预发布**（`0.5.0-rc.1`）只建 GitHub prerelease 并附 tgz，跳过 npm；**正式版**（`0.5.0`）先发 npm 再建稳定 Release。两者共用同一套门禁与幂等逻辑（已存在的 npm 版本 / tag / Release 自动跳过；Release 改为原地更新正文）。
- 正文格式以 `.github/RELEASE_TEMPLATE.md` 为唯一来源：正式版正文 `docs/releases/v<v>.md` 随发版提交入库；预发布正文不归档，页面先用 `.github/PRERELEASE_BODY.md` 的固定说明建好，随后用 `gh release edit --notes-file` 补上。不要用 `--generate-notes`。
- 版本号只用 `npm version <v> --no-git-tag-version`（同步 `package.json` 与 `package-lock.json`）；「验证」段的单测 / e2e 数字取当次 `npm run check` 的真实输出，不得沿用上一版。

## 测试与验证

修改行为前先补充或调整测试：

```bash
npm run test:unit
npm run test:e2e
npm test
```

- 单元测试使用 Node 内建 test runner，覆盖配置、发现、连接和 Admin API 适配。
- E2E 使用 Playwright，覆盖用户可见关键流程、密钥不泄露和中英文渲染。
- 修改 UI 后，至少运行 Playwright；修改服务端逻辑后，至少运行单元测试和 E2E。
- 不跳过或删除测试来获得绿色结果。
- `npm run check`（= `npm test`）是本地与 CI 等价的一键门禁：它先重建 `lib/`，所以测试跑的永远是会出厂的那份产物。
- `test/unit/release-notes.test.mjs` 把发布正文的格式与「不得出现 `github:` 安装」变成测试；`scripts/assert-pack.mjs` 校验真正要出厂的 `npm pack` 树（缺产物、多带测试 fixture、带安装期脚本都会失败）。两者都不在 e2e 里替代，分别是格式与产物的唯一把关点。

## Git 约定

- 每个可验证的功能切片使用一个原子提交。
- 不提交 `lib/`（整个目录已 gitignore）、`node_modules/`、`playwright-report/`、`test-results/`、`.tgz` 或任何真实密钥。
- 发版提交（`chore: release vX.Y.Z`）只含 `package.json`、`package-lock.json`，以及正式版的 `docs/releases/v<v>.md`。
- 提交前运行 `npm run check` 并检查 `git diff --check`。
