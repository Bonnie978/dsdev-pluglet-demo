# Post-mortems

事故记录：一个 bug 到达了它不该到的地方（真实用户、已合并的 PR、发布），有意思的部分是**我们的流程为何放过了它**，不只是那行修复。写法见 [dsdev-postmortem](../../.claude/skills/dsdev-postmortem/SKILL.md)。

postmortem 不是 Agent Note（那记录有意的设计决策与被拒方案）。写它的条件：subtle（机制不显然）、systemic（逃逸原因是测试/工具/约定缺口）、costly to rediscover。链接它催生的护栏。

每篇以 **Executive summary** 开头：忙碌读者三十秒读完的一段。

| # | 标题 |
|---|---|
| 0001 | [默认导出函数的插件使 CLI 以裸 TypeError 崩溃 — 校验把 `Function.prototype.apply` 当成了插件的 `apply`](0001-default-exported-function-passes-plugin-validation.md) |
