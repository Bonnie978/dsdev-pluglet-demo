---
name: dsdev-feature-loop
description: 任何会进入 PR 的改动（功能、bug 修复、重构、文档）从领任务到合并的端到端主循环。用在开始一个任务时，决定先读什么、要不要写 Agent Note、测试覆盖怎么规划、文档怎么同步、证据怎么选、PR 怎么写。其他 dsdev skill 在循环的各步被它引用。
---

# dsdev 端到端开发循环

把一个任务按下面十步走完。这是指导不是脚本：按变更面裁剪步骤，但不要跳过"读规则""规划覆盖""文档同 PR""选证据"这四步，它们是 DS Harness 方法区别于"写完代码再说"的地方。

## 0. 进入：先读规则再动手

按这个顺序读，读到与变更面相关为止：

1. 根 `AGENTS.md`（常备命令与约定），再读你要改的子树的 `AGENTS.md`。
2. `docs/architecture.md`（或项目的架构地图）——改核心模块之前必读。
3. `docs/defensive-patterns/` 里与你要改的工件对应的页。
4. 与该区域相关的活跃 Agent Note（`.agents/notes/implemented/`、`proposed/`）。不一致时把 Agent Note 当设计讨论的输入，不是自动否决。
5. 相关 postmortem：它们说明哪类 bug 曾在这里逃逸。

凭记忆判断规则是违规漏过评审的主要方式；开页面再读 diff。

## 1. 界定任务与 Issue

- 任务来自 Issue（Bug / Feature / Task 模板）。没有 Issue 的改动先开一个，PR 用 `Fixes #N` 或 `Refs #N` 引用。
- 写下用户、模型或系统**可观察的行为变化**；没有可观察变化的改动是 simplification 或 process 类。
- 判断是否触碰外部可感知面（CLI 标志、配置键、持久化格式、公开 API、包入口）。是 → 稍后按 [dsdev-upgrade-guide](../dsdev-upgrade-guide/SKILL.md) 写升级指南。

## 2. 决策：要不要 Agent Note

写 `proposed/` Agent Note 的条件：这个改动包含代码、测试和现有文档解释不了的**持久决策理由**（为什么这样设计、放弃了什么）。机械/局部改动免写。按 [dsdev-agent-note](../dsdev-agent-note/SKILL.md) 写，含 `## Alternatives considered`，并做取代检查。

已有 note 覆盖同一决策时更新它，不要重复建。

## 3. 规划覆盖：在计划阶段命名每个测试层

实现之前写下：

- 哪个单元测试文件拥有这个行为；
- 是否需要**真实入口路径**测试（通过真实的加载器/CLI/进程启动，而不是手装对象）；
- 是否改变模型可见或用户可见输出 → 需要更新哪个录制快照/期望输出；
- 新增的注册/registry 是否需要释放（dispose）测试；
- 负向对照：哪条断言会在"没有这个修复"时变红。

规则见 [dsdev-testing-policy](../dsdev-testing-policy/SKILL.md)。缺少的测试基础设施在同一个变更里补，不留给"以后"。

## 4. 实现：挂在扩展点上，按本仓库的约定

- 新行为挂在架构文档列出的扩展点（注册、事件、配置）上；改"主流程"本身必须同时更新架构文档。
- 本仓库的项目约定在根 `AGENTS.md` 的"项目约定"一节（命名、注册与释放、配置与默认值、错误类型等）；逐条对照，不要套用别的项目的规则。
- 配置错误在加载时大声失败，不静默跳过；边界上显式优于隐式。
- 失败路径按 [dsdev-error-handling](../dsdev-error-handling/SKILL.md)：类型化失败、明确谁兜底、报告可行动。
- 用维护良好的依赖替代手写实现，当它确实能删掉自己拥有的代码和测试。

## 5. 文档与代码同一个提交

- 受影响的 README、JSDoc、架构/子系统页、cookbook 同一提交更新；注释写完整契约，不写推理过程（[dsdev-doc-standard](../dsdev-doc-standard/SKILL.md)）。
- README 与 JSDoc 只写**现在的**行为：不出现旧名字、版本号、"no longer"、"替代了 X"。变更故事只住升级指南、Agent Note 或 PR 正文；一句 "there is no alias for the 0.1.0 `--config`" 在 JSDoc 里就是泄漏。
- 生成的目录（catalog）用生成器再生，不手改。
- 双语配对的文档两边一起改并重新记录配对。
- Agent Note 从 `proposed/` 移到 `implemented/`，`## Proposal` 改写成现在时的 `## Decision`。
- 破坏外部面 → 升级指南，在认识到破坏的那一刻写，不等发版。

## 6. 证据：最小相关检查 + 负向对照

按 [dsdev-pre-push-checks](../dsdev-pre-push-checks/SKILL.md)：先跑变更范围报告，再按变更面选最窄的能对回归变红的检查。不要默认跑全量，CI 拥有全量矩阵。

对每条新增的守卫（测试、gate、断言）做负向对照：引入回归 → 看红 → 还原。两边都绿的守卫什么都没守。

## 7. PR

按 [dsdev-pr-workflow](../dsdev-pr-workflow/SKILL.md)：Motivation / Changes / Testing（每种方法一条 + Proof 折叠块），一个 `kind/*`、相关 `area/*`，引用 Issue。拆分独立变更；在引入问题的层修复再向上传播。

## 8. 评审

评审他人或回应评审都按 [dsdev-code-review](../dsdev-code-review/SKILL.md)。每条评审意见先对着代码核实再采纳或有理有据地反驳，不表演式同意。委托给子 agent 的修复要自己重跑 gate。

## 9. 逃逸事故

bug 到了用户、合并或发布 → [dsdev-postmortem](../dsdev-postmortem/SKILL.md)。护栏（测试 + 规则）与 postmortem 互链。

## 10. 持续瘦身

定期：[dsdev-find-simplifications](../dsdev-find-simplifications/SKILL.md) 找可删的义务；归档不再指导工作的 implemented note；清理文档里的思维链泄漏；文档预算超了先搬迁再压缩。

## 报告

结束时报告：改了什么面、写/更新了哪些 note 与文档、**实际运行了哪些命令及结果**、哪些检查交给 CI、哪些事项有意推迟及原因。pending 的 CI 报告为 pending。
