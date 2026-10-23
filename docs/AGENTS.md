# AGENTS.md — 文档标准

本文件定义文档结构、层级、写作规则与 `verify-doc-budgets` 上限。放置与审计用 [dsdev-doc-standard](../.claude/skills/dsdev-doc-standard/SKILL.md)。

## 文档结构

文档的主题与树中位置决定它的范围：以适当细节描述自己的主题，对直接子项只说目的、职责与高层行为，低层细节链接到拥有它的后代。参考只对自己的主题穷尽。

把每篇面向人的文档分类为教程（有序路径到结果）或参考（定义查找范围与当前行为）；实质混合的分开。

## 层级：一事一家

| 层 | 职责 | 不属于这里 |
|---|---|---|
| 根 `AGENTS.md` | 常备命令，每条 1–3 行 + 链接其家 | 故事、示例、情境流程 |
| 子树 `AGENTS.md` | 该子树特有的命令 | 全仓库规则 |
| [architecture.md](architecture.md) | 有序地图：组合、核心模块、主循环、扩展点 | 类型定义、单模块细节、决策理由、状态标注 |
| [Agent Notes](../.agents/notes/README.md) | 活跃决策记录；implemented 用现在时 | 上线后的迁移计划、验收清单、spec 口吻 |
| [defensive-patterns/](defensive-patterns/README.md) | review 执行的规则，按工件分页 | 类型定义、决策理由 |
| [postmortem/](postmortem/README.md) | 事故故事——唯一允许叙事的层 | — |
| [cookbook/](cookbook/README.md) | 带编号验证步骤的 how-to | 设计理由 |
| 模块 README | 模块契约：配置、语义、限制、扩展点 | JSDoc 复述、别的模块的事 |
| [development.md](development.md) | 贡献者环境、日常流程、CI 概要 | 版本理由、会漂移的逐项清单 |
| [upgrade-guide/](upgrade-guide/) | 外部可感知破坏的迁移步骤 | 内部 API 变更 |
| skills | 可复用工作流与决策标准 | 产品与运行时契约 |

放置：bug → postmortem；理由 → Agent Note；流程 → cookbook；模块契约 → README；常备命令 → 根 AGENTS.md 加理由链接；review 执行的规则 → defensive-patterns。

## 写作规则

- **写当前状态。** 历史留在提交、PR、Agent Note、postmortem。
- **一个段落一个物理行**（`verify-md-wrap`）；代码块、表格、列表保留格式。
- **注释与 JSDoc 陈述完整契约，不是推理记录。**
- **直接写：命名行为者与事实。** 不用隐喻；写 `contract`/`boundary`/`shape`/`surface` 前先问有没有更精确的词。
- **一个仓库一种文档语言**：README、docs、Agent Note、postmortem、注释用同一种语言（本仓库是中文）写正文；机器检查的结构 token（`# Agent Note:`、`Status:`、`## Problem`/`## Decision` 等标题、PR 模板的 `## Motivation` 等）保持英文原样。

## 字数预算

[scripts/doc-budgets.manifest.json](../scripts/doc-budgets.manifest.json) 设常备文档上限；`verify-doc-budgets` 执行，计数为空白分隔的词加每个 CJK 字符各算一词，中英文消耗预算相当。变红时：搬迁 → 压缩 → 有理由才提高。上限是护栏不是削减目标：目标以下保留 ≥5% 余量。

## slop 清单

重复规则；越层的历史；实现状态标注；手抄目录；推理记录；在兄弟方法旁重复的理由；段落墙；强调通胀；implemented note 里的 spec 口吻。

## 仓库引用

当前文件用相对 Markdown 链接（`verify-md-links` 检查）；历史引用用 tag、Issue 或 PR 号，不用提交哈希（`verify-repository-references` 检查；必须引用提交时在该行标 `<!-- commit-ref-ok -->` 并说明原因）。
