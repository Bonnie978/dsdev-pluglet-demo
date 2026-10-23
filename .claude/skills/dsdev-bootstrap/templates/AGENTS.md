# AGENTS.md

{{PROJECT}} 的 Agent 常备命令。改核心模块前读 [docs/architecture.md](docs/architecture.md)；写文档按 [docs/AGENTS.md](docs/AGENTS.md)。

## 仓库布局

```text
src/          源码（按模块分目录，模块 README 是该模块的契约）
tests/        测试，与它锻炼的模块同名
docs/         文档（docs/AGENTS.md 定义层级）
.agents/      Agent Note（.agents/notes）
.claude/      skill（.claude/skills，随代码提交）
scripts/      gate 与生成器
```

## 命令

```sh
{{PKG_MANAGER}} install
{{TEST_CMD}}                 # 单元测试
{{TYPECHECK_CMD}}            # 类型检查
{{LINT_CMD}}                 # lint
{{PKG_MANAGER}} run test:docs    # 无需构建的文档 gate（doc-quick 聚合）
{{PKG_MANAGER}} run doc-sync     # 全部文档 gate
{{PKG_MANAGER}} run hygiene      # 包/依赖/发布布局检查
node scripts/change-scope.mjs --base <ref>   # 变更范围报告（JSON）；不要经 `run … --` 透传
```

### 本地只跑相关检查

push 前按 [dsdev-pre-push-checks](.claude/skills/dsdev-pre-push-checks/SKILL.md) 选最窄的、会因回归变红的检查；只报告跑过的命令。永不默认跑全量；CI 拥有全量矩阵。钩子故意很窄：pre-commit 查 staged 空白与 Markdown 换行，pre-push 只跑类型检查。

## 约定

### 方法约定（保留）

- **文档与代码同一提交**：受影响的 README、JSDoc、架构页一起改。注释写完整契约不写推理过程（[标准](docs/AGENTS.md)）。
- **守卫必须能变红**：每个新 gate 或新测试在同 PR 里做一次负向对照（[gate 写法](.claude/skills/dsdev-gate-authoring/SKILL.md)）。
- **测试描述行为不描述正确性**：过时的行为连同其测试一起改，PR 里说明原因（[测试策略](docs/testing.md)）。
- **Agent Note 只为持久的决策理由**；机械/局部改动免写；归档的 note 是冻结历史（[规则](.agents/notes/README.md)）。
- **外部可感知的破坏立即写升级指南**（[skill](.claude/skills/dsdev-upgrade-guide/SKILL.md)）。
- **PR 历史**：拆独立变更；在引入问题的 PR 修复再向上传播；`--force-with-lease` 永不 raw `--force`（[流程](.claude/skills/dsdev-pr-workflow/SKILL.md)）。
- **标签**：一个 `kind/*`，所有相关 `area/*`。
- TODO 标记按紧急度：`FIXME`（阻塞发布）/ `TODO`（尽快）/ `XXX`（也许某天）。
- 文件以恰好一个换行结尾；`git diff --cached --check` 守门。

### 项目约定（示例，替换为本仓库真实的规则，每条 1–3 行并链接理由）

- **注册即效果**：每个注册返回释放函数；registry 有释放测试。
- **配置错误大声失败**：加载时能自检的在加载时失败，否则在最早可解析点失败；永不静默跳过缺失的引用。
- **边界上显式优于隐式**：默认值是显式的 `resolve(request)` 步，不是 `run()` 里的 `?? default`。
- **类型化、结构化的失败**：不靠解析消息路由；空 catch 命名错误与原因（[错误处理](.claude/skills/dsdev-error-handling/SKILL.md)）。
- **真实入口路径**：产品可见的模块有非 unit 的真实组合测试；验证世界不验证自述（[测试策略](docs/testing.md)）。

## 防御模式

改模块对外面、生命周期、并发、子进程、拆卸代码前读 [docs/defensive-patterns/README.md](docs/defensive-patterns/README.md)。

## 类型安全与文档

一切在 strict 模式下编译；每个导出有简洁的 JSDoc 说明非显然契约，函数式导出带 `@param`/`@returns`。能机械检查的不变量接进被执行的顶层 gate，并证明每条改动的接受路径会拒绝一个无效案例（[gate 写法](.claude/skills/dsdev-gate-authoring/SKILL.md)）。

## 编辑本文件

`CLAUDE.md` 是本文件的符号链接；改真实文件。skill 复制在 `.claude/skills/`，随代码提交；升级 skill 时整组替换并在 PR 里写版本。每条规则自包含并链接高层文档。字数预算在 `scripts/doc-budgets.manifest.json`；超了先搬迁再压缩，确有必要才提高。
