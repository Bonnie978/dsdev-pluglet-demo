---
name: dsdev-agent-note
description: 新建、更新、移动（proposed→implemented）、拒绝或归档 Agent Note（Agent 写的 RFC/ADR）。用在一个改动包含代码和现有文档解释不了的持久决策理由时，或审计 .agents/notes 树时。定义路径编码、文件格式、强制的备选方案章节、取代检查和冻结归档规则。
---

# Agent Note：决策记录

Agent Note 记录一个影响代码库的决策或提案：**为什么**、**放弃了什么**、**需要什么验证**。这些是代码和文档承载不了的部分。这是指导不是脚本；格式部分由 `verify-agent-note-format` gate 机械检查。

## 什么时候写

同一个 PR 内写或更新 note，仅当存在代码、测试、现有文档解释不了的**持久决策理由**。机械/局部改动（包括局部 UI 调整）免写。已有 note 拥有这个决策时更新它，不要重复建。

- 对未来大块工作的提案 → `proposed/`。
- 已经做出的决策 → 直接写 `implemented/`。
- note 永远不被"改成另一个决策"：反转需新 note 并互链。

## 路径编码两个轴

`.agents/notes/{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`

生命周期（顶层目录）：

- `proposed/`：实现前评审的提案，尚未落地或只落了一部分。
- `implemented/`：决策已上线；文件记录决定了什么、拒绝了什么，并**随实际上线的事实保持更新**（路径、名字、默认值改了就同 PR 更新，只改事实不改决策）。
- `rejected/`：考虑过并否决。只在它的理由仍能阻止一个诱人的错误时保留，否则删除。
- `archived/{class}/`：冻结的历史快照，永不编辑，不作为当前行为的依据。

类别（嵌套目录，封闭集合）：

| class | 覆盖 |
|---|---|
| `feature` | 新的用户或模型可见能力 |
| `bug-fix` | 修正缺陷或补 postmortem 发现的缺口 |
| `simplification` | 删除代码/行为/面而不新增能力（`refactor` 故意不存在，被此类覆盖） |
| `architecture` | 关于**交付源码**的结构决策：模块关系、运行时词汇 |
| `process` | 代码**周围**的工具、策略、流程：gate、包管理、vendoring |
| `testing` | 测试基础设施与策略 |

文件名日期 = 首次提出的日期。note 之间用相对 Markdown 链接互引，不用裸文字或编号。不要建中心化 `INDEX.md`：路径就是索引。

## 文件格式（gate 检查）

前三行精确为：

```markdown
# Agent Note: <title>

Status: <status>
```

然后一个空行。`Status:` 三种：`Status: proposed`、`Status: implemented`、`Status: rejected — <一行原因>`，必须与所在目录一致。状态行不带日期或括号。

正文以 `## Problem` 开头（动机，脱离方案也能读）。各生命周期的必需章节：

| proposed | implemented | rejected |
|---|---|---|
| `## Problem` | `## Problem` | `## Problem` |
| `## Proposal` | `## Decision`（现在时） | `## Proposal` |
| …自定义章节… | …自定义章节… | 保留提案期章节 |
| `## Alternatives considered` | `## Alternatives considered` | `## Alternatives considered` |
| `## Acceptance criteria` | `## Consequences`（代价与收益） | |
| `## Risks` | | |

implemented 禁止出现 `## Proposal`、`## Plan`、`## Migration plan`、`## Acceptance criteria`：那是 spec 口吻。`## Testing`、`## Deferred`、`## Related` 可以，只要陈述现在时的事实。

**`## Alternatives considered` 强制**：每个真实备选方案及其为何落败，一个加粗开头的段落或一个 `### Why not <X>?` 小节。没有记录"打败了谁"的决策会被反复重提——这正是 Agent Note 要防止的失败。备选方案只记录、不编造。

## 生命周期间移动

移动 = 改 `Status:` 行 + 同一变更里满足目标目录的骨架：

- `proposed → implemented`：`## Proposal` 重写为现在时 `## Decision`；`## Acceptance criteria` 与 `## Risks` 折叠进 `## Consequences`（或现在时的 `## Testing`）；删掉计划，写已上线的东西。
- `proposed → rejected`：只在 `Status:` 行加原因，冻结文件。
- 永不归档 proposed：过时的提案拒绝它。

## 每个新 note 触发取代检查

写新 note 前搜索活跃树里覆盖同一决策、机制或被拒方案的旧 note，分类：

- **完全取代** → 同 PR 归档该 implemented 三件套（或按合并规则删除）。
- **部分取代** → 两边都保留并互链，更新仍然成立的事实。
- 不要把已知匹配推给"以后的语料审计"。

## 归档与删除（按未来价值判断，不按字数或年龄）

- **implemented — 删除**：只描述小 UI 调整或纯机械变更的 note，整三件套删掉并修复入链。局部 bug 修复、性能变更、新能力、实质行为决策不因实现小而删。
- **implemented — 保留活跃**：其理由、备选、负向保证、持久/线上语义、所有权边界、安全规则、重新引入条件可能指导未来变更。
- **implemented — 归档**：决策完整、不太可能指导未来工作，但历史理由值得保留。
- **rejected — 保留**：被拒的想法仍是诱人且有意义的错误。
- **rejected — 删除**：想法已过时、被取代、不再可信。

归档一条 note：移动到 `archived/{class}/`（维护译文的仓库连同译文与配对记录一起移）；不改正文，只在 `Status: implemented` 下一行插入 `Archived: YYYY-MM-DD`；修复活跃文档的入链（指向当前权威，或有意引用历史时指向归档路径）；运行 `node scripts/verify-archived-agent-notes.mjs --write` 把它的哈希追加进 `.agents/notes/archived/manifest.json`——`--write` 只追加，先证明已有封存全部成立，永不更新或删除已有哈希。封存后永不编辑、移动、删除；默认模式的校验器对改动过的、未封存的、被删除的归档文件都变红。

## 验证与报告

运行 note 相关 gate（格式、分类、链接、文档聚合）。报告：新建/更新/移动/拒绝/归档了哪些 note，取代检查的结果，以及真正的边界案例及其选择。不要宣称归档 note 的出链有效：归档校验器故意不检查它们。
