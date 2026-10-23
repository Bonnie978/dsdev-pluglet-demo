# Post-mortems

事故记录：一个 bug 到达了它不该到的地方（真实用户、已合并的 PR、发布），有意思的部分是**我们的流程为何放过了它**，不只是那行修复。写法见 [dsdev-postmortem](../../.claude/skills/dsdev-postmortem/SKILL.md)。

postmortem 不是 Agent Note（那记录有意的设计决策与被拒方案）。写它的条件：subtle（机制不显然）、systemic（逃逸原因是测试/工具/约定缺口）、costly to rediscover。链接它催生的护栏。

每篇以 **Executive summary** 开头：忙碌读者三十秒读完的一段。

## 护栏互链

`## Guardrails added` 至少含一个相对 Markdown 链接，解析到仓库内现有的文件（测试、文档页、AGENTS.md、Agent Note；图片链接与代码块内的链接不算）。至少一个被链接的 Markdown 文件、根 `AGENTS.md` 或 `docs/defensive-patterns/` 页面链回这篇 postmortem；非 Markdown 的护栏（测试、源码）是合法目标但不承担回链，注释写契约不写理由。`verify-postmortems` 执行两条；取舍见 [Agent Note](../../.agents/notes/implemented/process/2026-10-23-postmortem-guardrail-cross-link-gate.md)。

## 目录

| # | 标题 |
|---|---|
| 0001 | [默认导出函数的插件使 CLI 以裸 TypeError 崩溃 — 校验把 `Function.prototype.apply` 当成了插件的 `apply`](0001-default-exported-function-passes-plugin-validation.md) |
