# AGENTS.md

## 项目目标

`dsh-openviking-manager` 是 OpenViking 的 DSH 配置管理 UI。它管理 `~/.openviking/ovcli.conf`、连接诊断和用户 Key 引导，并提供会话级的 OpenViking 记忆开关；它同时是官方配置面的编辑器与状态面板（例如 `recallPeerScope` 跨主题共享开关，保存后自动重载官方插件）。**不**实现记忆同步/召回本身，也不替代 `@openviking/dsh-memory-plugin`。

## 关键边界

- `ovcli.conf` 是日常客户端配置真源。读取、导入和写入必须保持官方插件兼容。
- `root_api_key` 只能用于一次性的 Admin API 操作；不得写入 `ovcli.conf`、日志、错误文本、浏览器持久化存储或测试快照。
- `user_key` 不得从服务端 API 回传给浏览器。已有 key 仅以掩码展示；新建或轮换产生的新 key 只可在当前表单内等待用户保存。
- 任何新增 HTTP 路由都必须保持同源检查、`no-store` 响应和输入验证。
- 会话开关只拦截官方插件在该会话的注入/写入/MCP 请求，不修改其行为定义：开关状态为进程内存（默认开启，重启复位），关闭只对之后的 agent step 生效。
- 本插件不修改 `ov.conf`、不编排 OpenViking 容器/服务，也不复制官方记忆插件能力。
- 持久控制只写官方声明的配置面（`ovcli.conf` 的 `plugin` 段）；键名与取值域以 `@openviking/dsh-memory-plugin` 的 config-schema 为唯一真源，写入保留未知键与既有分层，不发明自有配置键。
- `.openviking/config.json` 等 workspace 层配置完全由用户手工管理：本插件不读取、不写入，也不提供其编辑界面。
- 官方插件的重载只通过宿主 Cordis 公开机制（registry 定位官方 fiber 后 `restart()`），使其重新读取配置；不修改官方插件代码与行为定义。隔离设置保存后自动执行一次重载，UI 文案提前提示重载及其副作用；自动重载未完成时回退为手动按钮与手动重启 DSH 实例的提示。
- env 层（如 `OPENVIKING_RECALL_PEER_SCOPE`）优先级高于本插件可写的任何文件，且进程启动后不可变；UI 必须显示其覆盖状态，而不是让文件设置假装生效。

## 技术约定

- Node.js ESM + TypeScript；运行时文件在 `src/`，编译输出为 `lib/`。
- DSH Web 插件浏览器入口由 `src/client/index.tsx` 注册到 `plugins.bundle.config`，包导出为 `./client`。
- UI 的可见文案一律通过 `src/client/i18n.ts` 的 `TranslationKey`。新增 key 时必须同步 `en` 和 `zh` 两个字典。
- 在 DSH 中跟随 `ctx.locale`；独立 E2E 页面通过浏览器语言回退。
- CSS 位于 `src/client/styles.ts`。维持 DSH 设计 token、原生可访问控件和响应式栅格。
- `npm run build` 生成 `lib/`。`lib/` 是要提交的编译产物，见「分发与安装」。不要把 `.tgz` 当成编译产物或提交到仓库。

## 分发与安装

- `lib/` 编译产物必须随 git 提交并保持与 `src/` 同步，同时通过 `files` 字段随 npm 包发布。用户侧只取用现成产物，不会运行 `tsc`/`esbuild`；`lib/` 缺失或过期会让 DSH 加载入口失败或加载到旧行为。
- 不要添加 `prepare`、`prepublishOnly` 或其他安装期构建脚本。pnpm 会阻止 git 依赖的构建脚本并等待 `allowBuilds` 授权，那会让直接安装变成需要人工授权才能完成。
- `lib/standalone.js` 只是 Playwright 使用的浏览器 fixture，不提交、不随包发布；`npm run test:e2e` 会先重新构建它。
- 发布 npm 版本前先运行 `npm run build` 并提交 `lib/`，再执行 `npm publish`，避免发出与 `src/` 不同步的产物。

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

## Git 约定

- 每个可验证的功能切片使用一个原子提交。
- 提交 `lib/` 编译产物：改动 `src/` 后必须重新运行 `npm run build`，并把 `lib/` 与源码放进同一个提交，避免 GitHub 安装到过期入口。
- 不提交 `node_modules/`、`lib/standalone.js`、`playwright-report/`、`test-results/`、`.tgz` 或任何真实密钥。
- 提交前运行相应测试并检查 `git diff --check`。
