# Agent Notes

这里住一种设计文档。**Agent Note** 记录影响本代码库的决策或提案——*为什么*与*放弃了什么*，代码和文档承载不了的部分。本文件定义 note 住哪、何时写、文件格式；流程细则见 [dsdev-agent-note](../../.claude/skills/dsdev-agent-note/SKILL.md)。

## 布局与命名

路径编码两个轴：`{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`。

- **生命周期**（顶层目录）：`proposed/`（实现前评审的提案）、`implemented/`（决策已上线，**随实际上线的事实保持更新**，只改事实不改决策，见 [implemented/AGENTS.md](implemented/AGENTS.md)）、`rejected/`（考虑过并否决；只在理由仍能阻止诱人错误时保留）。
- **类别**（嵌套目录，封闭集合）：`feature`、`bug-fix`、`simplification`、`architecture`（交付源码的结构决策）、`process`（代码周围的工具/策略/流程）、`testing`。`refactor` 故意不存在：`simplification` 的判别"可观察行为变了吗"已覆盖它。

文件名日期是首次提出的日期。note 之间用相对 Markdown 链接。不建中心化 `INDEX.md`：路径就是索引。历史价值高但不再指导未来工作的 implemented note 移入冻结的 [`archived/`](archived/AGENTS.md)。

## 何时写

同 PR 内写或更新，仅当存在代码、测试、现有文档解释不了的持久决策理由。大块未来工作的提案从 `proposed/` 开始；已做出的决策从 `implemented/` 开始。更新已拥有该决策的 note 即满足规则；不建重复。机械/局部改动（含局部 UI）免写。note 永不被改成另一个决策：用新 note 取代并互链。

## 归档与删除

只描述小 UI 调整或纯机械变更的 implemented note 直接删除并修复入链。其他 implemented note 只在决策完整、理由不太可能指导未来工作、仍有历史价值时归档。永不归档 proposed：拒绝过时的提案。rejected 只在仍能阻止一个可信的错误时保留。归档把完整文件移到 `archived/{class}/`，保留 `Status: implemented`，在其下一行插入 `Archived: YYYY-MM-DD`，修复或删除入链。封存后永不编辑。

## 文件格式

`verify-agent-note-format` 执行。前三行精确为：

```markdown
# Agent Note: <title>

Status: <status>
```

然后空行。`Status:` 为 `proposed`、`implemented`、或 `rejected — <一行原因>`，与所在目录一致，不带日期或括号。

正文以 `## Problem` 开头。各生命周期的骨架：

- `proposed/`：`## Problem` → `## Proposal` → 自定义章节 → `## Alternatives considered` → `## Acceptance criteria` → `## Risks`。
- `implemented/`：`## Problem` → `## Decision`（现在时） → 自定义章节 → `## Alternatives considered` → `## Consequences`。禁止 `## Proposal`、`## Plan`、`## Migration plan`、`## Acceptance criteria`。
- `rejected/`：提案冻结；保留提案期章节，裁决在 `Status:` 行。

**`## Alternatives considered` 对每个 note 强制**：每个真实备选与其为何落败。没有记录"打败了谁"的决策会被反复重提。备选只记录不编造。

在生命周期间移动 = 改 `Status:` 行并在同一变更里满足目标骨架。
