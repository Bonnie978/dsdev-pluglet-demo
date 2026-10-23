# dsdev skills — 还原 DeepSeek Harness 开发方式的 skill 套件

这套 skill 把 `deepseek-ai/deepseek-harness` 仓库里 Agent 主导的开发方式抽成可移植的工作流。领域规则（Cordis、会话格式等）不在这里；进入这里的是**方法**：分层常备指令、一事一家的文档层级、Agent Note 生命周期、postmortem→护栏、gate+负向对照、测试四原则、最小相关证据、PR 三段+Proof、文档与代码同 PR、散文标准。研究依据是 dsdev 项目里的 `research/ds-harness-dev-method.md`（不随 skill 复制进仓库）。

每个 skill 都是**指导而非脚本**：它告诉 Agent 读什么、判断什么、交付什么，不替代仓库自己的 `AGENTS.md`。

## 安装

把本目录下的 `dsdev-*` 文件夹**复制**进目标仓库的 `.claude/skills/`（Claude Code）或 `.agents/skills/`（通用），和代码一起提交。不要软链到仓库外：仓库文档把 skill 当作规则的家来链接，HEAD 处的读者（包括新 clone 和 CI）必须能解析这些链接。更新 skill 时再复制一次并在 PR 里说明版本（本目录的 `VERSION`）。新仓库先运行 `dsdev-bootstrap` 生成脚手架。

## 路由表：什么时候用哪个

| 场景 | skill |
|---|---|
| 新仓库 / 旧仓库首次接入这套方法 | [dsdev-bootstrap](dsdev-bootstrap/SKILL.md) |
| 做一个功能、修一个 bug、任何会进 PR 的改动（端到端主循环） | [dsdev-feature-loop](dsdev-feature-loop/SKILL.md) |
| 要做一个有持久理由的决策；写/移动/拒绝/归档 Agent Note | [dsdev-agent-note](dsdev-agent-note/SKILL.md) |
| 推送前、标记 ready 前、声称"检查通过"前 | [dsdev-pre-push-checks](dsdev-pre-push-checks/SKILL.md) |
| 评审一个 PR，或回应评审意见 | [dsdev-code-review](dsdev-code-review/SKILL.md) |
| 设计测试、写测试、处理 flaky 测试 | [dsdev-testing-policy](dsdev-testing-policy/SKILL.md) |
| 写/改 README、docs、JSDoc、注释、提示词、可见字符串 | [dsdev-doc-standard](dsdev-doc-standard/SKILL.md) |
| 把一条规则变成可执行的 gate | [dsdev-gate-authoring](dsdev-gate-authoring/SKILL.md) |
| 一个 bug 逃到了用户/合并/发布 | [dsdev-postmortem](dsdev-postmortem/SKILL.md) |
| 找可删的代码、API、配置、测试、文档 | [dsdev-find-simplifications](dsdev-find-simplifications/SKILL.md) |
| 设计失败路径、重试、后台任务、错误报告 | [dsdev-error-handling](dsdev-error-handling/SKILL.md) |
| 改动破坏了外部可感知的面（CLI、配置键、持久化数据、API） | [dsdev-upgrade-guide](dsdev-upgrade-guide/SKILL.md) |
| 开分支、提交、开 PR、打标签、stacked PR、force push | [dsdev-pr-workflow](dsdev-pr-workflow/SKILL.md) |
| 写模型可见的工具定义、系统提示词、skill 描述 | [dsdev-agent-experience](dsdev-agent-experience/SKILL.md) |

## 这套方法的五个不变量

1. **一事一家**：每个事实只有一个家，别处放链接。
2. **决策留痕**：持久的决策写 Agent Note，并记录被打败的备选方案。
3. **能机械检查的就是 gate**，并且每个 gate 要证明能对无效输入变红。
4. **代码、文档、证据同一个 PR**：没有"稍后补文档"。
5. **只报告跑过的命令**：pending 不是 passing，覆盖率不是正确性。
