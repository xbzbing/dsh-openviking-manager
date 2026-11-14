# OpenViking 管理器

OpenViking 管理器是 [OpenViking](https://docs.openviking.ai/zh/agent-integrations/17-dsh) 的 DSH 配置界面，用来管理本机的客户端连接、用户 Key 和记忆相关设置。记忆的同步、提交和召回仍由官方插件 [`@openviking/dsh-memory-plugin`](https://www.npmjs.com/package/@openviking/dsh-memory-plugin) 负责。

## 功能

- **连接配置**：读取、导入并更新 `~/.openviking/ovcli.conf`，验证服务连通性与用户身份。已有 `user_key` 只显示掩码。
- **配置诊断**：检查 `ovcli.conf` 的格式和文件权限，可一键修复权限；读取本机 `ov.conf` 的认证模式等非敏感状态。
- **账号恢复与初始化**：临时输入 root key 调用官方 Admin API，列出账号和用户、创建账号或用户、重新生成用户 Key。root key 不会写入任何文件。
- **会话记忆开关**：输入框里的「OpenViking」胶囊可以关闭单个会话的记忆读写。胶囊默认隐藏，在配置页「输入框胶囊」卡片中打开。
- **MCP remember 开关**：默认禁止 agent 显式调用 `mcp__openviking__remember`；禁止时该工具从每个会话的工具列表中移除，避免它把内容写进用户级空间造成跨项目混淆。可在配置页改回允许，自动捕获不受影响。
- **项目记忆隔离**：默认只召回当前项目的记忆。项目按 git 仓库区分，同一项目跨 agent、跨机器共享记忆，不同项目互相隔离。
- **项目面板**：查看某个目录对应的项目 peer、召回范围的生效值与来源，以及仓库内工作区配置带来的隔离风险。
- **召回调优**：调整召回分数阈值、注入条数、查询扩写、排除目录、事件衰减保护和超时时间。保存后自动重载官方插件。
- **界面语言**：跟随 DSH 语言设置，支持简体中文和英文。

## 仓库

源码、安装方式和完整说明见 GitHub：<https://github.com/xbzbing/dsh-openviking-manager>
