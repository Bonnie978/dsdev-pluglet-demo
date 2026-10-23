---
name: dsdev-bootstrap
description: 新仓库或旧仓库首次接入 dsdev 方法时使用：生成分层 AGENTS.md、Agent Note 树与规则、postmortem/defensive-patterns/cookbook/upgrade-guide 入口、PR 与 Issue 模板、零依赖的 gate 脚本（run-gates、change-scope、verify-*）、窄钩子，并用负向对照验证每个 gate 能变红。
---

# 接入 dsdev 方法：脚手架

把 [templates/](templates/) 复制进目标仓库并填空。这是指导不是脚本：按项目语言与规模裁剪，但不要删掉"根 AGENTS.md + Agent Note 树 + 至少一个被执行的文档聚合 + 负向对照"这四件事。模板是**起点**：对本仓库为假的每一句都要删或改，HEAD 处的读者必须能解析每一句。

先把 skill 本身复制进仓库（`.claude/skills/dsdev-*`，不是软链），因为后面生成的 AGENTS.md 与文档会把它们当作规则的家来链接。

## 1. 盘点现状

读目标仓库的 README、现有 CLAUDE.md/AGENTS.md、CI 配置、测试命令。记下：语言与包管理器、测试 runner、现有 lint/typecheck 命令、是否已有 docs/ 目录与 ADR。已有 ADR 的仓库把它们迁入 `.agents/notes/implemented/<class>/`（补齐格式）而不是并存两套。

## 2. 复制模板

```text
templates/AGENTS.md                     → AGENTS.md（并 ln -s AGENTS.md CLAUDE.md）
templates/docs/AGENTS.md                → docs/AGENTS.md
templates/docs/architecture.md          → docs/architecture.md
templates/docs/development.md           → docs/development.md
templates/docs/testing.md               → docs/testing.md
templates/docs/defensive-patterns/*     → docs/defensive-patterns/
templates/docs/postmortem/README.md     → docs/postmortem/README.md
templates/docs/cookbook/README.md       → docs/cookbook/README.md
templates/docs/upgrade-guide/.gitkeep   → docs/upgrade-guide/
templates/notes/.                       → .agents/notes/（README.md、AGENTS.md、implemented/AGENTS.md、archived/AGENTS.md 与六个 class 目录；用 `cp -R templates/notes/. .agents/notes/` 才会带上 .gitkeep）
templates/github/*                      → .github/（pull_request_template.md、ISSUE_TEMPLATE/）
templates/scripts/*                     → scripts/（gate 脚本、每个 gate 的 `*.spec.mjs` 自测、gates.config.mjs、doc-budgets.manifest.json、install-hooks.mjs）
                                          自测与脚本同住 scripts/（像 DS 的 scripts/*.spec.ts），由 `gate-selftest` gate 用 `node --test 'scripts/*.spec.mjs'` 运行，零依赖，不进你的业务测试目录
```

模板里的 `{{PROJECT}}`、`{{PKG_MANAGER}}`、`{{TEST_CMD}}`、`{{TYPECHECK_CMD}}`、`{{LINT_CMD}}` 全部替换；找不到对应命令的占位符删掉整行，不留空命令。命令存在但永远绿（例如 `lint: echo … && exit 0` 这类占位脚本）等同于不存在：不写进 AGENTS.md 的命令表、不登记为 gate、不列为证据，在 development.md 写一句"占位，接入条件是……"。

模板还带着给填空者看的残留，接入时一并清掉：表格里的占位行（如 `| <项目特有工件> | <对应页> |`）、二选一的句子（"`package.json`（或 Makefile）"留下适用的一个）、`gates.config.mjs` 里 "examples; delete or adapt" 之类描述模板状态而非仓库状态的注释。HEAD 处的读者必须能解析每一句（[dsdev-doc-standard](../dsdev-doc-standard/SKILL.md) 的"一个测试"）。

## 3. 接脚本

Node 项目在 `package.json` 加：

```json
{
  "scripts": {
    "change-scope": "node scripts/change-scope.mjs",
    "doc-sync": "node scripts/run-gates.mjs doc-sync",
    "test:docs": "node scripts/run-gates.mjs doc-quick",
    "hygiene": "node scripts/run-gates.mjs hygiene",
    "check:all": "node scripts/run-gates.mjs check-all",
    "verify-agent-note-format": "node scripts/verify-agent-note-format.mjs",
    "verify-doc-budgets": "node scripts/verify-doc-budgets.mjs",
    "verify-md-wrap": "node scripts/verify-md-wrap.mjs",
    "verify-md-links": "node scripts/verify-md-links.mjs",
    "verify-postmortems": "node scripts/verify-postmortems.mjs",
    "verify-upgrade-guides": "node scripts/verify-upgrade-guides.mjs",
    "postinstall": "node scripts/install-hooks.mjs"
  }
}
```

pnpm ≥ 10 只运行 `pnpm-workspace.yaml` 里 `allowBuilds: { <pkg>: true }` 放行的依赖构建脚本（例如 vitest 带来的 `esbuild`），否则 `pnpm run` 会拒绝启动；把放行写进文件并提交，不要依赖交互式 `pnpm approve-builds` 的本地结果。

### 非 Node 项目

脚本本身零依赖，只需 Node ≥ 20，用 Makefile 包起来：

```make
.PHONY: test-docs doc-sync hygiene check-all change-scope install-hooks
test-docs:     ; node scripts/run-gates.mjs doc-quick
doc-sync:      ; node scripts/run-gates.mjs doc-sync
hygiene:       ; node scripts/run-gates.mjs hygiene
check-all:     ; node scripts/run-gates.mjs check-all
change-scope:  ; node scripts/change-scope.mjs --base $(BASE)
install-hooks: ; node scripts/install-hooks.mjs
```

然后按语言裁剪：删掉 `verify-lockfile`、`verify-export-jsdoc`（Node 专用）；`hygiene` 换成本语言的卫生检查——Python 仓库可直接用模板里的 `verify-py-layout.mjs`（pytest 能收集到每个测试文件、每个包有 `__init__.py`），其他语言按 [dsdev-gate-authoring](../dsdev-gate-authoring/SKILL.md) 写一个。`install-hooks.mjs` 在没有 package.json 时让 pre-push 跑 Makefile 的 `typecheck:`（没有则 `lint:`）目标。`make` 把 gate 的退出码 1 包装成 2，CI 判非零即可。`docs/development.md` 模板里关于 postinstall 与 node_modules 的句子对非 Node 仓库作废，整段重写。

工具缺失（例如 Makefile 有 `typecheck:` 但 mypy 没装）：不把它登记进聚合或钩子，在 development.md 写明"可选，接入条件是把工具声明为开发依赖"，并在 Agent Note 记录。一个会因缺工具而红的 gate 和一个永远绿的 gate 一样坏。

`.gitignore` 里构建输出用锚定的 `/lib/`、`/dist/`，不要写 `lib/`：后者会把 `scripts/lib/` 一起忽略，新 checkout 的 gate 会因缺共享库而崩。

`scripts/gates.config.mjs` 登记 gate 与聚合；语言特有的 gate（typecheck、lint、export-jsdoc、unit tests）在这里追加并标 `needs`。模板的 `hygiene` 聚合默认只有 `verify-lockfile`（按 lockfile 探测包管理器做一致性检查）；非 Node 仓库换成自己的卫生检查或删掉该聚合及其在 package.json、AGENTS.md、development.md 里的所有引用——`run-gates` 对空聚合直接报错，因为永远绿的聚合什么都没守。

`verify-doc-budgets --list` 显示每个常备文档的当前用量，填 AGENTS.md 时随手看。文档 gate 的遍历器只跳过**根目录**的 `lib/`、`dist/`、`build/`（构建输出）以及任何层级的 `node_modules`、`vendor`、缓存目录；源码放在 `src/lib/` 的仓库不受影响。`verify-export-jsdoc` 默认检查 `src/` 下的 `.ts/.tsx/.mts/.js/.mjs`；源码不在 `src/` 的仓库改脚本顶部的 `SRC` 判定。`verify-doc-budgets` 把每个 CJK 字符算一词，中文 AGENTS.md 不会"免费"。写 `.mjs` 的头注释时注意 `src/**/*.mjs` 里的 `*/` 会提前结束注释块。

## 4. 填充根 AGENTS.md

只放 Agent 每次会话都需要的常备命令：仓库布局、命令、约定（每条 1–3 行 + 链接其家）、"相关检查而非全量"、文档与代码同 PR、Agent Note 何时写。模板的"约定"分两组："方法约定"保留；"项目约定"是插件式架构的示例，整组替换成本仓库真实的规则（单函数库可能只剩一两条），不要让一条对本仓库为假的约定留在文件里。`docs/testing.md` 模板同理："方法要求"保留，"本仓库现状"按实际填，没有的层写"无（原因）"。字数预算默认 2080 词，写进 `scripts/doc-budgets.manifest.json`。项目特有的约定（框架规则、命名）写进去，但理由链接到 Agent Note 或 defensive-patterns。

## 5. 第一批 Agent Note 与 defensive pattern

- 为"采用这套方法"本身写一条 `implemented/process/<date>-adopt-dsdev-method.md`，记录备选（只用 CLAUDE.md、只用 ADR、不写 note）与后果。
- 把仓库已知的、曾经咬过人的坑写成 `docs/defensive-patterns/general.md` 的条目：规则 + 防止的缺陷 + 判定条件 + 边界 + 正反例。模板里的条目是从 DeepSeek Harness 借来的**种子**，讲的是运行时、并发、子进程、释放，用的是 JavaScript 词汇：保留对本仓库成立的规则并换成本语言的例子；对一个纯函数库可能一条都不成立，那就整页按本仓库的真实行为重写，开头那句"实际出过"也改成真话（没有事故记录就写没有）。

## 6. 验证：每个 gate 做负向对照

```sh
node scripts/run-gates.mjs doc-quick          # 应全绿
```

`node --test 'scripts/*.spec.mjs'`（或 `hygiene` 聚合里的 `gate-selftest`）运行每个 gate 的自测。然后对**每个**登记的 gate 制造一个无效案例、通过真实 runner 观察变红、确认错误信息命名了那个案例、还原：

| gate | 注入 |
|---|---|
| verify-md-wrap | docs/ 里一个两行的段落 |
| verify-md-links | 指向不存在文件的链接 |
| verify-doc-budgets | manifest 里把 AGENTS.md 上限改成 10 |
| verify-agent-note-format | note 第 3 行改成 `Status: done` |
| verify-postmortems | 新建只有 `## Root cause` 且未登记的 postmortem |
| verify-upgrade-guides | `docs/upgrade-guide/v1/x/guide.md`（非 semver） |
| verify-archived-agent-notes | 放一条未封存的 note 进 `archived/<class>/` |
| verify-repository-references | 散文里写 `fixed in commit 9f8e7d6`（gate 看的是散文，行内代码不算） |
| verify-export-jsdoc | 删掉一个导出的 JSDoc |
| verify-lockfile | 改 package.json 一个依赖的版本范围 |
| gate-selftest | 把某个 verify 脚本的 `process.exit(1)` 改成 `exit(0)` |
| typecheck / lint / unit | 一个类型错误 / 一个未用 import / 改一个期望值 |

把观察到的命令与输出写进 PR 的 Testing/Proof。

安装钩子：`node scripts/install-hooks.mjs`（postinstall 只在新 checkout 触发，已有 node_modules 时包管理器会跳过它），然后故意提交一个尾随空白确认 pre-commit 拒绝。

## 7. 交付

一个 PR：Motivation 引用接入 Issue；Changes 列出新增的命令与目录；Testing 列出上面的正向与负向对照。之后的改动全部走 [dsdev-feature-loop](../dsdev-feature-loop/SKILL.md)。

## 报告

报告：复制了哪些模板、替换了哪些占位符、登记了哪些 gate 与聚合、每个 gate 的负向对照命令与观察、安装的钩子、未接入的部分及原因。
