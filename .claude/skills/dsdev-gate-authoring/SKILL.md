---
name: dsdev-gate-authoring
description: 把一条规则变成可执行的检查（gate）时使用：写 verify-* 脚本、给生成器加 --check 新鲜度模式、把 gate 接进聚合（doc-sync/hygiene/check-all），并用负向对照证明它能变红。也用于决定一条规则该是 gate、review 规则还是 AGENTS.md 常备命令。
---

# 把规则变成 gate

原则（来自根 AGENTS.md）：**能机械检查的不变量接进一个被执行的顶层 gate，并证明每条改动的接受路径会拒绝一个无效案例。** 用窄而有理由的例外代替全局禁用一条规则。这是指导不是脚本。

## 先决定规则的归属

| 规则性质 | 归属 |
|---|---|
| 能用脚本确定判定 | gate（`scripts/verify-<rule>.mjs` + 聚合） |
| 需要人判断但 review 必查 | `docs/defensive-patterns/` 一条，含判定条件与正反例 |
| Agent 每次会话都要记得 | 根 `AGENTS.md` 一到三行 + 链接理由 |
| 为什么这样定 | Agent Note |

一条规则可能同时有 gate（机械部分）和 defensive pattern（判断部分）。

## 写一个 verify 脚本

- 零依赖或仅用仓库已有依赖；用 Node ESM `.mjs`（或项目语言），从仓库根解析路径。
- 输出：成功一行摘要（检查了多少对象、依据哪条规则）；失败列出**每条**违规：文件、位置、违反的规则、修正方向；非零退出。
- 失败信息指向规则的家（`docs/AGENTS.md § …`），不复述整条规则。
- 不要静默跳过缺失的输入：清单里列了但不存在的文件是失败（"重命名或删除了？同一变更更新清单"）。
- 排除冻结/vendor 树要显式，并写在脚本头注释里。
- 提供 `--list` 或 `--write` 模式时，默认模式永远只读。

生成器与它的检查是一对：`gen-x` 写文件，`verify-x` = `gen-x --check`，比对生成结果与已提交文件，不同即失败。生成的英文源永不手改。

## 负向对照（必做）

每条新的或改动的接受规则：

1. 临时引入一个应被拒绝的案例（坏的标题行、超预算的文件、硬换行的段落）。
2. 通过真实的 runner（`node scripts/verify-x.mjs` 或聚合命令）观察它变红，确认错误信息命名了那个案例。
3. 还原。
4. 把这个无效案例固化为 `scripts/verify-x.spec.*` 里的测试（临时目录 fixture），让守卫自身有回归保护。

两边都绿的 gate 什么都没守。

## 接进聚合

gate 不接进被执行的聚合就不存在。在 `scripts/gates.config.mjs`（或等价）登记：`id`、`label`、`command`、`needs`（依赖的 gate）、`quick`（是否进入无需构建的快速文档聚合）、`allowFailure`（仅观测）。聚合由 `scripts/run-gates.mjs <aggregate>` 按依赖图调度；`DSDEV_GATE_CONCURRENCY` 控并发，`DSDEV_GATE_FAIL_FAST=1` 首个阻断失败即停，否则失败只跳过它的依赖者并报告所有独立错误。

- `doc-sync`：全部文档 gate（可能需要构建产物）。
- `doc-quick`：无需构建的文档 gate（`test:docs`）。
- `hygiene`：包/依赖/发布布局检查。
- `check-all`：全部。

CI 以聚合为单位组织 lane。本地不要默认跑 `check-all`：按 [dsdev-pre-push-checks](../dsdev-pre-push-checks/SKILL.md) 选相关聚合。

## 钩子保持窄

pre-commit 只做 staged 的快速检查（lint 修复、空白、配对记录）；pre-push 只做增量类型检查。测试、快照、文档 gate、构建、hygiene 都不进钩子——CI 拥有全量。

## 文档

新 gate 在 `docs/development.md`（或 CI 概要处）一句话登记；它执行的规则在规则的家里加一句"由 `verify-x` 执行"。不要在多处复述规则。

## 报告

报告：规则归属判断、脚本路径、负向对照的精确命令与观察到的红、固化的 spec、登记的聚合、实际运行的命令。
