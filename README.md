# dsh-openviking-manager

[English](README_EN.md) | 简体中文

`dsh-openviking-manager` 是一个 DSH Web UI 插件，用于管理已有 OpenViking 服务的客户端连接、用户 Key 和本机配置诊断。它只管理客户端配置；记忆同步、提交和召回仍由官方 [`@openviking/dsh-memory-plugin`](https://www.npmjs.com/package/@openviking/dsh-memory-plugin) 负责。

## 功能

- 读取、导入和原子更新 `~/.openviking/ovcli.conf`；
- 保留已有 `user_key`，页面仅显示掩码而不回传明文；
- 检查 OpenViking 的 `/health`、`/ready` 与用户身份；
- 检查 `ovcli.conf` 的 JSON 格式和文件权限，并提供经确认的权限修复；
- 本机发现：读取 `~/.openviking/ov.conf` 的非敏感状态，例如认证模式、是否存在 root key；`ovcli.conf` 始终优先；
- 临时使用 `root_api_key` 调用官方 Admin API：列账号、列用户、创建账号/用户、重新生成用户 Key；
- 根据当前 endpoint 推导 Studio 地址（`<endpoint>/studio`），允许用户手工改为反向代理地址；
- UI 跟随 DSH 系统语言设置，支持简体中文和英文。

## 安全边界

- `root_api_key` 只在浏览器表单和一次同源管理请求期间使用，绝不写入 `ovcli.conf`；创建/轮换完成后插件会清空该输入。
- 现有 `user_key` 从服务端本地读取，浏览器只收到掩码；连接验证可在不回显旧 key 的情况下完成。
- 多数管理路由仅接受同源请求，响应使用 `no-store`，且不在日志中记录请求头。
- 本插件不启动、停止或修改 OpenViking 服务端，也不替换官方记忆插件。

## 环境要求

- Node.js `>= 24`
- DSH `>= 0.1.6-alpha.2 < 0.2.0`
- 一个可访问的 OpenViking 服务

## 开发

```bash
npm ci
npm run build       # 仅生成 lib/ 编译产物，不会生成 .tgz
npm test            # 单元测试 + Playwright E2E
```

编译产物在 `lib/`；仓库不会在构建流程中生成或保留 `.tgz` 安装包。如需发布，由发布流水线按需执行打包。

## 测试

```bash
npm run test:unit
npm run test:e2e
```

Playwright E2E 覆盖导入并保存 `ovcli.conf`、非法 endpoint 保护、服务端 user key 验证、临时 root key 的账号/用户选择，以及中文浏览器语言渲染。

## 项目结构

```text
src/
  ovcli-config.ts       ovcli.conf 读取、校验、原子写入和权限修复
  local-discovery.ts    ov.conf 非敏感发现
  openviking-client.ts  数据面连通性与身份验证
  openviking-admin.ts   官方 Admin API 适配
  manager-api.ts        DSH 同源 HTTP 路由
  client/               DSH Web 页面、样式和 i18n
```

## 许可证

本项目采用 [MIT License](LICENSE)。
