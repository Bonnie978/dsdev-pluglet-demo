---
name: dsdev-pr-workflow
description: 开分支、提交、开 PR、打标签、拆分变更、处理 stacked PR、历史重写（rebase/force-with-lease）、回应评审线程、合并时使用。定义 PR 正文三段式（Motivation/Changes/Testing+Proof）、Issue 引用与标签规则、历史策略、stack 的官方对象与合并方式。
---

# PR 工作流

PR 是"代码 + 文档 + 证据"的最小合并单元。这是指导不是脚本。

## Issue 先行

每个 PR 引用至少一个同仓库 Issue：解决性引用用 `Fixes #N` / `Closes #N` / `Resolves #N`，信息性引用用 `Refs #N`。HTML 注释、代码块、行内代码里的引用不算。Issue 用模板：Bug（Summary/Reproduction/Current behavior/Expected behavior/Environment）、Feature（Motivation/Behavior）、Task（Summary/Deliverables）。

## 分支与提交

- 从最新主干开分支；一个 PR 一个关注点。**拆分独立变更**：能单独评审与回滚的就是独立 PR。
- 提交信息陈述做了什么与为什么；文件以恰好一个换行结尾（pre-commit `git diff --cached --check` 守门）。
- 检查 pre-commit 修复器改动的文件后再继续。

## PR 正文：三段 + Proof

```markdown
## Motivation

<!-- 一句话说明要解决的问题；Fixes #NN 或 Refs #NN。 -->

## Changes

<!-- 命令、配置、API、协议或持久化格式的变化；没有写 None。 -->
<!-- 用户、模型或系统可观察行为的变化；没有写 None。 -->

## Testing

<!-- 每种测试方法一个条目。方法保持可见，可复核证据放进 Proof。 -->

- <命令或步骤，以及它覆盖的行为>

  <details>
  <summary>Proof</summary>

  <测试输出、截图、录屏、日志或其他可复核证据>

  </details>
```

Testing 只写**实际运行**的方法；交给 CI 的写"CI: <lane>"。pending 不是通过。产品可见的 GUI 变更附从真实服务与模型流程录制的演示（GIF）。

## 标签

恰好一个 `kind/*`（如 `kind/feature`、`kind/bug`、`kind/docs`、`kind/process`、`kind/simplification`、`kind/testing`）；所有相关的 `area/*`；至多一个优先级 `p0`–`p3`；解决性引用的 PR 优先级与被解决 Issue 的最高优先级一致。

## 历史策略

- **在引入问题的 PR 修复，再向上传播**；下游修会让上游继续交付坏代码并把修复藏起来。
- standalone 与 stack 分支都可 merge-forward 或 rebase（评审后也可）。重写用 `--force-with-lease=<branch>:<observed-oid>`，远端移动则中止；**永不 raw `--force`**。取更新的 base 前保留进行中的 merge-forward 检查点。
- 每个评审修复是独立提交；不要把已评审的修复 amend 掉。只 amend 自己未推送、未评审的工作。
- 重写推送后重新 fetch 头、重审未解决线程/批准/可合并性/检查。

## Stacked PR

依赖链 A ← B ← C 用 GitHub 官方 stack 对象与 `gh stack` 扩展（`github/gh-stack`），不用逐个 `gh pr merge` + `gh pr edit` 重定向模拟。本节只适用于托管在 GitHub 且有官方 stack 的仓库；其他平台按其原生机制，没有原生机制就不做 stack，等依赖合并后对 trunk 开普通 PR。以下命令按 `gh stack` 0.2.1 实测。

- 先 `gh stack --version`；CLI 扩展缺失、服务端未启用、或跨 fork 链 → 硬停止，不退回手工模拟（不开 base 指向未合并分支、日后改 base 的 PR，也不把依赖 PR 的提交夹带进对 trunk 的 PR）。安装扩展属于改动用户环境，先问。硬停止时仍可在依赖分支上实现、验证、推送，并如实报告"没有 PR、没有 CI 运行"。
- **先用 `gh pr create` 按模板开每一层 PR**（底层 base 为 trunk，上层 base 为下层分支），再按 PR 号链接：`gh stack link --base <trunk> <bottom-pr> … <top-pr>`。传分支名时 `link` 会自动建 PR（自动标题、可能是 draft），绕过 PR 模板。stack 号与 Issue/PR 共用编号空间（例如 stack 可能是 #8）；`link` 的第一个数字若匹配到已有 stack 会被当作"追加到该 stack"，所以先确认编号含义。
- 用 GraphQL `PullRequest.stack { number size }` 与 `stackEntry.position` 确认成员资格与顺序；base 分支只建立预期顺序。作者不同 → 先问再链接。永不自动解散、重排、重建已有 stack。
- `link` 建立的 stack 在本地没有跟踪状态：`gh stack view/sync/push/rebase` 会报 "not part of a stack"。需要本地级联 rebase 时，先 `gh stack init <bottom-branch> … <top-branch>` 接管分支。刷新只在合并状态或规则要求时做：`gh stack sync` 一步完成 fetch、级联 rebase、`--force-with-lease --atomic` 发布，发布先于验证，必须立即按 [dsdev-pre-push-checks](../dsdev-pre-push-checks/SKILL.md) 验证每一层；或增量 merge-forward。
- 合并前重查官方 stack；每个选中 PR 开放、非 draft、顺序正确、每层 CI 的 head SHA 与当前 head 一致且全部通过、每层评审闭环（见"合并前"）。`gh stack merge` 只预检 open/非 draft，分支保护在服务端合并时才评估；仓库没有分支保护（例如免费私有仓库读取规则返回 403）时，"满足评审与检查"完全由你核对。
- `gh stack merge <stack-number> --yes --merge`（部分落地传边界 PR 号）。**显式传合并方式**：不传时非交互模式沿用上次用过的方式。不逐 PR 合并，不手工重定向。阻塞 → 在拥有的 PR 解决或停下报告。
- 落地形态：整个选中范围生成**一个**合并提交，各 PR 的 `mergeCommit` 相同；上层 PR 的 base 不会被重定向，但其 `Fixes #N` 仍会关闭 Issue。等每个 PR 报告 `MERGED`、每个被解决的 Issue 报告 `CLOSED`。
- `gh stack merge` 不删分支。之后单独一步：对每个分支先确认 `gh pr list --state open --base <branch>` 为 0，再 `git push origin --delete <branch>`。
- 每个 PR 分支一个 worktree；并行修复不共享 checkout。

## 回应评审

见 [dsdev-code-review](../dsdev-code-review/SKILL.md) "收到评审时"：逐条核实、修在引入层、独立提交、线程内回复（说明修复与携带它的当前 head）、重写后重审。

## 合并前

- **评审闭环**：等仓库配置的每个评审者（人或 bot，例如 Codex review）对**当前 head** 给出结论；每个评审线程都有回复——修复（回复里写携带修复的提交）或有技术理由的反驳——并已 resolve。CI 全绿但评审未完成或有未回复线程时不合并。合并后才落下的评审意见当作新 Issue 或跟进 PR 处理，不能忽略。
- 相关检查按 [dsdev-pre-push-checks](../dsdev-pre-push-checks/SKILL.md) 通过且报告。
- 文档、Agent Note（移到 implemented）、升级指南、快照都在这个 PR 里。
- 不绕过合并要求。

## 报告

报告：PR 编号与链接、引用的 Issue、标签、拆分决定、实际运行的检查、交给 CI 的检查、任何历史重写及其 lease。
