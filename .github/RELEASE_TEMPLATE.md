# Release notes template

本文件是**正式版** GitHub Release 正文的**唯一格式来源**。发版时照抄下面的骨架填写，不要再去翻历史 release 反推格式。

- Release 标题 = tag 名 = `v<package.json version>`；tag 必须与 manifest 的 version 一致。
- 正文**必须中英双语**：中文段在前，`---` 分隔，英文段在后；两段内容一一对应，不是摘要。
- 两段都以 compare 链接收尾：`https://github.com/xbzbing/dsh-openviking-manager/compare/<PREV>...<TAG>`，`<PREV>` 是上一个**正式版** tag，跳过中间的 rc / alpha（`v0.5.0` 配 `v0.4.2`，不是配 `v0.5.0-rc.1`）——完整变更记录必须覆盖「上一次稳定版之后」的全部内容。
- 不要保留 GitHub 自动生成的 `## What's Changed` 段落，它和这里的结构冲突。
- **归档只收正式版**：`docs/releases/` 只存正式版正文，rc / alpha 不写、也不留存正文文件。预发布的 Release 页面**照常写完整变更记录**，但不入库：workflow 先用 `.github/PRERELEASE_BODY.md` 的固定说明建页面（含本版附件地址），发布后用 `gh release edit --notes-file <本地文件>` 把正文写上去；重跑 workflow 不会覆盖它。
- 历史 release 页面只读不改；仓库里只随正式版新增正文文件。

## 写作规则

**主要变更**

- 一条一个用户可感知的结果，标题加粗，冒号后写「现在是什么样 / 为什么值得升级」，不是实现流水账。
- 末尾用 `（#N）` 关联 issue 或 PR；没有关联就不写。
- 顺序：面向用户的能力与修复在前，`**内部**` 类的约定 / 门禁 / 重构放最后一条。
- 不要写：版本号变更、`lib/` 重建、纯格式调整、仅测试内部改名且不改变任何保证的改动。

**验证**

- 写**当次** `npm run check` 的真实输出：单测数、e2e 数。数字不得沿用上一版。
- 再写 1–3 条最有判别力的回归：修了什么、哪条测试会在去掉修复后转红。
- 没有新验证内容时，宁可只留 `npm run check` 一行，也不要编。

**安装**

- 两条都给——npm 一条（`dsh-openviking-manager@<VERSION>`）+ 同版本 GitHub Release 附件一条。
- npm 那行**钉到本版的具体版本**，不写 `@latest`：这一页讲的是本版怎么装，`@latest` 会在下一个版本发布后指向别的产物，与页面上的 tag / 附件对不上。
- URL 里的 tag 用本版真实 tag；命令必须带 `--profile <profile>`，示例统一用 `web`。
- **不要写 `github:` 安装**：`lib/` 不入库，`dsh plugin add github:xbzbing/dsh-openviking-manager` 会装到一棵没有编译产物的树，插件加载不起来。
- 预发布不发 npm：它的正文是 `.github/PRERELEASE_BODY.md` 里的固定说明，只给附件一条。

**篇幅**

| 版本类型 | 中文条目数 |
| --- | --- |
| patch（修 bug / 文档） | 1–4 |
| minor（新能力） | 5–10 |
| major | 按需分组，每组一个小标题 |

预发布也用同样的四段结构，篇幅参照上面的 patch / minor；它只用于自测，把影响安装与升级的部分写清即可。

## 骨架

<!-- 从下一行开始复制到 release 正文 -->

## 主要变更

- **<用户可感知的标题>**：<现在是什么样、为什么值得升级>（#<issue 或 PR>）
- **<标题>**：<说明>
- **修复**：<修掉的现象与影响面>（#<N>）
- **内部**：<约定 / 门禁 / 结构性改动>

## 安装

<!-- 正式版两条都给：npm + 同版本 Release 附件 -->

```bash
# 正式版（npm）
dsh plugin --profile web add dsh-openviking-manager@<VERSION>

# 同一版本的 GitHub Release 附件
dsh plugin --profile web add https://github.com/xbzbing/dsh-openviking-manager/releases/download/<TAG>/dsh-openviking-manager-<VERSION>.tgz
```

## 验证

- `npm run check` 全绿：<N> 单测 + <M> 个 e2e 用例
- <关键回归：修了什么；去掉该修复后哪条测试转红>

[完整变更记录 <PREV>...<TAG>](https://github.com/xbzbing/dsh-openviking-manager/compare/<PREV>...<TAG>)

---

## English

- **<Title>**: <what it does now and why it is worth upgrading> (#<issue or PR>)
- **<Title>**: <description>
- **Fixes**: <the symptom and its blast radius> (#<N>)
- **Internal**: <conventions / gates / structural changes>

## Install

<!-- Stable only: both lines. Never `github:` — `lib/` is not committed. -->

```bash
# Stable (npm)
dsh plugin --profile web add dsh-openviking-manager@<VERSION>

# The same version as a GitHub Release asset
dsh plugin --profile web add https://github.com/xbzbing/dsh-openviking-manager/releases/download/<TAG>/dsh-openviking-manager-<VERSION>.tgz
```

## Verification

- `npm run check` green: <N> unit tests + <M> e2e tests
- <key regression: what was fixed and which test turns red without it>

[Full changelog <PREV>...<TAG>](https://github.com/xbzbing/dsh-openviking-manager/compare/<PREV>...<TAG>)

<!-- 复制到上一行结束 -->

## 填写素材

```bash
# 上一个正式版 tag 到 HEAD 的提交（合并提交已排除，release 里不列）
PREV=$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
git log --oneline --no-merges "$PREV"..HEAD

# 上一个正式版 tag（compare 链接的 <PREV> 也用它）
echo "$PREV"

# 当次门禁的真实数字
npm run check
```

## 发布流程

发布由 `.github/workflows/release.yml` 在「version bump 合入 main」时执行。正式版正文**随发版提交一起入库**；预发布没有正文文件，Release 页面由 workflow 用固定说明生成：

```bash
# 1. 版本号：同时更新 package.json 与 package-lock.json 的两处 version
#    预发布用带 - 的版本（0.6.0-rc.1）：只发 GitHub，不发 npm，不写正文
#    正式版用纯 semver（0.6.0）：发 npm + 稳定 Release，并照上面的骨架写正文
npm version <v> --no-git-tag-version

# 2. 正式版正文（预发布跳过这步）：和代码一起提交、一起 review
$EDITOR docs/releases/v<v>.md
git add package.json package-lock.json docs/releases/v<v>.md && git commit -m "chore: release v<v>"
```

`lib/` 不入库：产物由 workflow 的 `npm pack` 在门禁后生成，不需要也不应该提交构建产物。

合入 main 后 workflow 自动完成：门禁 → 打 tag →（仅正式版）`npm publish` → GitHub Release（附同一个 tgz；预发布带 `--prerelease`，正文先用 `.github/PRERELEASE_BODY.md` 的固定说明）。不要手工在 main 上打 tag。

预发布页面不归档正文，但**照常写完整变更记录**：workflow 建好页面后，把整理好的正文写进本地文件（如 `docs/local/releases/v<v>.md`，不进仓库）再推上页面；之后重跑 workflow 不会覆盖它：

```bash
gh release edit "v<v>" --notes-file docs/local/releases/v<v>.md
```

workflow 在动手之前先校验：正式版的 `docs/releases/v<v>.md` 必须存在、`npm run check` 必须全绿；任何一条不满足就停在发布之前。npm 已存在同版本、远端已有 tag、已有 Release 时相应步骤自动跳过（Release 改为更新正文），所以失败后可以直接重跑：

```bash
gh workflow run release.yml
```

手工在网页上改正文而不改文件，下次重跑会被文件内容覆盖——正式版来自 `docs/releases/v<v>.md`，预发布来自 `.github/PRERELEASE_BODY.md`。预发布版本号含 `-`，GitHub 会标为 prerelease、`releases/latest` 不返回它，版本条不会提示「有新版本」；正式版发布后 npm 与稳定 Release 同时上线。
