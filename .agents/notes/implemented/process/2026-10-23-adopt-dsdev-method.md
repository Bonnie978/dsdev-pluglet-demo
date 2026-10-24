# Agent Note: 采用 dsdev 开发方法

Status: implemented

## Problem

pluglet 是一个小仓库，改动大多由 agent 完成。没有成文的常备命令时，每个会话都要从代码重新推导约定，决策只留在聊天记录里，逃逸的 bug 产出修复却没有持久的护栏。仓库需要一个地方放 agent 必须保持在上下文里的规则，一个地方放决策理由，并对一切可检查的东西做机械执行的检查。

## Decision

pluglet 使用由 `dsdev-bootstrap` 安装的 dsdev 方法：根 `AGENTS.md`（`CLAUDE.md` 是指向它的符号链接）承载常备命令并链接到各自的家；`docs/AGENTS.md` 固定层级分类；决策住在 `.agents/notes/{lifecycle}/{class}/`；逃逸的 bug 在 `docs/postmortem/` 下得到一篇 postmortem；review 执行的规则住在 `docs/defensive-patterns/`；`scripts/run-gates.mjs` 运行 `doc-quick`、`doc-sync`、`hygiene` 与 `check-all` 聚合；git 钩子保持很窄（commit 时查 staged 空白与 Markdown 换行，push 时跑类型检查）。skill 复制到 `.claude/skills/` 并随代码提交（版本在 `.claude/skills/VERSION`）；升级时在一个 PR 里整组替换。

## Alternatives considered

- **一个装下一切的 CLAUDE.md。** 否决：一个文件装不下规则、理由和流程而不超出 agent 每次会话应加载的量；层级分类让常备命令保持简短，其余靠链接。
- **放在 `docs/adr/` 下、没有生命周期目录的传统 ADR。** 否决：没有 `proposed/implemented/rejected` 目录和格式 gate 的 ADR 在上线后会漂移成 spec 口吻；路径编码的生命周期与 `verify-agent-note-format` 让 implemented note 持续描述当前现实。
- **不执行 gate，只靠 review。** 否决：review 抓的是判断题，不是机械漂移（硬换行的段落、失效的链接、格式错误的 note）；从不运行的 gate 等于不存在的规则。

## Consequences

- 每个变更在同一个 PR 里带上它的文档和证据；"文档以后补"不是选项。
- 这套方法每个变更多花几分钟（读规则、跑 `test:docs`）；换来的是一个全新 agent 仅凭文件就能学会规则的仓库。
- 语言相关的 gate（`typecheck`、`verify-export-jsdoc`、单元测试）登记在 `scripts/gates.config.mjs`；新增一个按 `dsdev-gate-authoring` 来，包括负向对照。
