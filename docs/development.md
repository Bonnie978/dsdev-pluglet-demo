# 开发指南

从前置条件到可用 checkout 的教程，之后是贡献者参考（布局、日常流程、CI 概要）。理由在链接的 Agent Note。

## 环境

```sh
pnpm install        # 同时通过 postinstall 安装 git 钩子
pnpm run typecheck
```

`pnpm run typecheck` 成功即环境就绪。pnpm 11 只运行 `pnpm-workspace.yaml` 的 `allowBuilds` 里显式放行的依赖构建脚本（当前只有 `esbuild`）；新增需要构建脚本的依赖时在那里登记，不要用 `pnpm approve-builds` 的交互式结果替代提交。

## 测试命令

```sh
pnpm test                 # 单元 + 期望输出（源码平面）
pnpm run test:coverage    # CI 覆盖率门：src 按文件 100%
pnpm run test:e2e         # 先 build，再用 node 跑 lib/bin.js 的真实入口测试
DSDEV_SNAPSHOT=refresh pnpm test tests/expected   # 有意刷新期望输出，审查 diff
```

## 日常命令

根 [AGENTS.md](../AGENTS.md#命令) 汇总常用命令；`package.json`（或 Makefile）与 `scripts/gates.config.mjs` 拥有当前的脚本与 gate 清单。选覆盖变更面的最小检查；文档改动跑 `test:docs`；模块对外行为变更同时更新 README/JSDoc。

## Git 钩子

`pnpm install` 的 postinstall 在新 checkout 安装窄钩子；node_modules 已是最新时 pnpm 会跳过 postinstall，已有的 checkout 直接运行 `node scripts/install-hooks.mjs`。钩子内容：pre-commit 查 staged 空白与 Markdown 硬换行；pre-push 跑类型检查。测试、快照、文档 gate、构建不进钩子——CI 拥有全量。

## CI gate

[.github/workflows/dsdev-gates.yml](../.github/workflows/dsdev-gates.yml) 在每个 PR 上跑 `doc-quick`、`hygiene`、`check-all` 三个聚合；本地只跑与变更面相关的检查。

`scripts/run-gates.mjs <aggregate>` 按依赖图运行聚合：`doc-quick`（无需构建的文档检查）、`doc-sync`（全部文档检查）、`hygiene`（lockfile 一致性、gate 自测 `node --test 'scripts/*.spec.mjs'`、typecheck、export-jsdoc）、`check-all`。每个 `scripts/verify-*.mjs` 旁有同名 `*.spec.mjs`，用临时 fixture 驱动真实 runner 固化它拒绝的案例。`DSDEV_GATE_CONCURRENCY` 控并发；`DSDEV_GATE_FAIL_FAST=1` 首个阻断失败即停。

## TODO 标记

`FIXME` 阻塞发布；`TODO` 尽快；`XXX` 也许某天。
