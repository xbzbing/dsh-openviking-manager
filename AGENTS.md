# AGENTS.md

## 项目定位

`dsh-openviking-manager` 是 OpenViking 的 DSH 配置管理 UI。产品能力、安装方式和界面说明以 README.md / README.en.md 为准；本文件只记录修改本仓库必须遵守的约束。

## 关键约束

- `ovcli.conf` 是官方配置真源：读写必须与 `@openviking/dsh-memory-plugin` 的 config-schema 兼容。只写官方声明的 `plugin.dsh` 键，保留未知键与共享 `plugin` 段，不发明自有键。
- 本插件不实现记忆同步/召回，不修改 `ov.conf`，不编排 OpenViking 服务，也不修改官方插件代码；官方插件只通过宿主 Cordis 公开机制重载。
- 密钥：`root_api_key` 只用于一次性 Admin API 操作，不得写入 `ovcli.conf`、日志、错误文本、浏览器存储或测试快照；`user_key` 不得从服务端回传给浏览器，已有 key 只掩码展示，新 key 只在当前表单内等待保存。
- 路由：新增 HTTP 路由必须同源检查、`no-store`、输入验证。Host 白名单只接受回环地址、宿主 `webServer.getOrigin()` 的绑定源和 `DSH_OPENVIKING_MANAGER_ALLOWED_HOSTS` 追加项；端点源变化时不得把旧 `api_key` 转发给新源。
- 隔离以项目（peer）为单位，默认 `actor`，peer 由官方按 workspace 的 git 身份推导；不得用机器级 pin 实现隔离，目录不在 git 仓库时必须提示 peer 为空。
- 工作区层（`.openviking/config.json`、`config.local.json`、`~/.openviking/workspaces/<slot>.json`）只读展示，不写入，也不自行重写合并规则。env 层优先级最高，UI 必须标注真实来源。
- 本插件偏好写 `$DSH_HOME/plugin-data/dsh-openviking-manager/preferences.json`，不进 `ovcli.conf`。`disableMcpRemember` 默认禁止：通过 agent scope 的 `tools.restrict({ deny: ["mcp__openviking__remember"] })` 把工具从模型可见列表摘除（不是只拒绝调用）；自动捕获不受影响。会话开关是进程内存、默认开启、重启复位，关闭只影响之后的 step。
- 隔离开关写 `plugin.dsh.recallPeerScope`（显式值，不靠删键回落）和可选的 `plugin.dsh.peerId`；召回调优只暴露官方声明的七个键。`scoreThreshold` 0.5、`recallQueryExpansion` off、`timeoutMs` 15000 是产品默认，只在没有任何层定义该键时写入，不改变官方默认；恢复默认时清理共享段同名残留键是唯一例外。

## 技术约定

- Node.js ESM + TypeScript；`src/` 是运行时源码，`lib/` 是构建产物，**不入库**。
- 浏览器入口在 `src/client/index.tsx`（包导出 `./client`）；CSS 在 `src/client/styles.ts`，沿用 DSH 设计 token、原生可访问控件和响应式栅格。
- UI 文案必须走 `src/client/i18n.ts` 的 `TranslationKey`。字典按语言拆分：`zh.ts` 是 key 唯一真源（`TranslationKey = keyof typeof zh`），`en.ts` 必须覆盖同一组 key；新增 key 先改 `zh.ts` 再补 `en.ts`。在 DSH 中跟随 `ctx.locale`。
- `npm run build` 先清空再生成 `lib/`；不要提交 `lib/` 或 `.tgz`。

## 分发与安装

- 安装渠道只有 npm 包和 GitHub Release 附件 tgz；**不支持 `github:` 安装**（仓库树没有 `lib/`）。README、Release 正文和 AI 回答都不得写 `github:`。
- 不添加 `prepare`、`prepublishOnly` 等安装期构建脚本：pnpm 会阻塞等待 `allowBuilds`。`scripts/assert-pack.mjs` 和 `test/unit/release-notes.test.mjs` 负责把关产物与正文格式。
- 发版只由 workflow 执行（main 改 `package.json` 或 `workflow_dispatch`）：门禁 → tag →（仅正式版）npm publish → Release 附 tgz。不要手工打 tag 或 publish。正文模板见 `.github/RELEASE_TEMPLATE.md`；正式版正文归档到 `docs/releases/v<v>.md`，预发布不归档。
- 版本号用 `npm version <v> --no-git-tag-version`；发布说明里的单测 / e2e 数字必须取当次 `npm run check` 的真实结果。

## 测试与验证

- 修改行为前先补或调整测试。UI 改动至少跑 Playwright；服务端改动至少跑单测 + E2E；不得跳过或删除测试换取绿色。
- `npm run check`（= `npm test`）是本地与 CI 等价的门禁，会先重建 `lib/`。

## Git 约定

- 每个可验证的功能切片一个原子提交。
- 不提交 `lib/`、`node_modules/`、`playwright-report/`、`test-results/`、`.tgz` 或真实密钥。
- 发版提交 `chore: release vX.Y.Z` 只含 `package.json`、`package-lock.json`（正式版另含 `docs/releases/v<v>.md`）。
- 提交前运行 `npm run check` 并检查 `git diff --check`。
