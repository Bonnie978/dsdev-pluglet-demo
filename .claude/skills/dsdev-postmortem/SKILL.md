---
name: dsdev-postmortem
description: 一个 bug 到达了它不该到的地方（真实用户、已合并的 PR、发布版本）时使用，判断是否值得写 postmortem、按固定结构写，并把它催生的护栏（测试、规则、Agent Note）与它互链。
---

# Postmortem：从逃逸的 bug 到护栏

postmortem 是向后看的失败记录：什么坏了、机制、为何每层安全网都漏了、加了哪些具体护栏让同类 bug 下次大声失败。有意思的部分是**我们的流程为何放过了它**，不是那行修复。它不是 Agent Note（那记录有意的设计决策与被拒方案）。这是指导不是脚本。

## 什么时候写

三个条件同时满足：

- **subtle**：机制不显然，认真的工程师会再花大力气重新推导。
- **systemic**：逃逸原因是测试/工具/约定的缺口，不是一次性拼写错误。
- **costly to rediscover**：花了真实的调试时间，再来一次还会花。

不满足就修 bug、补测试、必要时更新 README，不写 postmortem。

## 结构

文件 `docs/postmortem/NNNN-<slug>.md`，四位递增编号，在 `docs/postmortem/README.md` 的表格登记一行。

```markdown
# Post-mortem NNNN: <一句话标题：症状 — 根因>

Status: resolved (fix in PR #N) | open

## Executive summary
一个短段落，忙碌的读者三十秒读完：什么坏了、根因（直白）、为何逃逸、持久的教训。

## Summary
症状、影响范围、几个 bug、它们为何藏在同一个错误字符串后面。

## Impact
谁受影响、能不能用、有没有数据损失、成本是什么。

## Timeline
事实顺序：落地 → 发现 → 调查（包括走错的方向）→ 根因。证据，不是教学顺序。

## Root cause #1 — <机制>
精确到代码：引用关键行、解释机制、为什么表面合理。有第二个 bug 就 `## Root cause #2`。

## Why every test missed it
逐层：每个本应抓住的安全网为什么没抓住。这是最重要的一节。

## Guardrails added
列出每个护栏并链接：删除/修改的代码、新测试（说明它如何在 bug 恢复时变红）、AGENTS.md/defensive-patterns 新规则、Agent Note。

## Lessons
两到四条可迁移的规则，写成将来可直接遵守的形式。
```

## 写作要点

- Timeline 记录走错的方向："先追了优雅的 X 理论，再用一行 console.error 找到了一行导出错误"——这是教训的一部分。
- "100% 覆盖率全程满足"这类事实要写：它击穿"绿即正确"的错觉。
- 每个护栏要能单独验证："恢复 `export default` 后该 e2e 失败"。
- 叙事只在这一层允许；不要把故事复制到 README 或 AGENTS.md，那里放一行规则加链接回这里。

## 护栏落地

- 测试：按 [dsdev-testing-policy](../dsdev-testing-policy/SKILL.md)，优先真实入口路径、无密钥、能在 CI 跑；做负向对照。
- 规则：机械可查的 → [dsdev-gate-authoring](../dsdev-gate-authoring/SKILL.md)；需判断的 → `docs/defensive-patterns/` 一条（规则 + 防止的缺陷 + 判定条件 + 边界 + 正反例）；Agent 每次要记得的 → 根/子树 `AGENTS.md` 一行加链接。
- 护栏与 postmortem 互链：`## Guardrails added` 链接每个护栏文件（测试、规则页、AGENTS.md、Agent Note），其中至少一个 Markdown 护栏或规则行链回 postmortem；规则处写 `([postmortem](../docs/postmortem/NNNN-….md))`。`verify-postmortems` 执行这两条。

## 报告

报告：是否满足三条件、文件路径、护栏清单与各自的验证方式、实际运行的命令。
