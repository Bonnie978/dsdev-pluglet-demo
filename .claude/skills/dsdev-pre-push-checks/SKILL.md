---
name: dsdev-pre-push-checks
description: 在 push、force push、标记 ready for review、或声称"检查通过"之前使用；也用在 stacked PR 同步重写分支之后。目的是选出能覆盖本次 diff 的最小测试与检查集合，而不是反射性地跑全量套件；并规定如何处理失败、如何保护历史重写、如何报告。
---

# 推送前检查：最小相关证据

在一次 push 之前运行**一次**相关的本地证据。Git 钩子故意很窄（pre-commit 修 staged lint、查空白；pre-push 只跑增量类型检查）；CI 拥有全量覆盖与平台矩阵。这是指导不是脚本。

## 1. 看清出站变更

```sh
git status --short --branch
git rev-parse --show-toplevel
```

确认 PR 的真实 base（或 stack 的父分支），fetch 它，然后生成变更范围报告：

```sh
node scripts/change-scope.mjs --base <verified-base-ref>
```

该命令不猜测也不 fetch base；输出 committed / staged / unstaged / untracked 四类路径。合并了新 base 后重跑报告，重新评估合并后的范围能影响哪些行为，只重跑被合并作废的检查。

## 2. 按变更面选证据

没有钩子之外的"通用本地基线"。每个行为变更需要**最窄的、会因它的回归而变红**的测试或专用检查；更宽的检查只为 diff 真正触及的面增加。

| 变更面 | 证据 |
|---|---|
| 包/模块行为 | 拥有该行为的测试文件或聚焦的测试名；共享契约变了再加相邻模块的测试 |
| 文档、Agent Note、目录、文档链接的注释 | 文档聚合 gate（`doc-sync` 或等价） |
| 模型/编辑器/CLI/终端可见输出 | 拥有该输出的录制快照或期望输出场景 |
| manifest、公开导出、构建配置、bin 入口、构建产物路径 | 构建 + 卫生检查 + 已构建产物的冒烟测试 |
| 测试/脚本本身的类型 | 构建后的类型检查（源码产物和构建产物两个平面别混） |
| 资源占用、异步、flaky 风险的测试 | 先按 [dsdev-testing-policy](../dsdev-testing-policy/SKILL.md) 判断是否需要恢复/负向对照/静止拆卸/并发进程证据 |
| 真实外部 provider 行为 | 有凭据时跑对应 e2e；永不打印密钥 |

不要仅因为接下来要 commit/push 就重复一个已通过的检查；尤其不要在 push 前手动跑一遍 pre-push 钩子已经会跑的类型检查。

过滤测试时检查报告的"选中测试数"再把它当聚焦证据；参数透传语法按各启动器的规则，别让一个多余的 `--` 把过滤器吃掉。

### 把覆盖率聚焦到受影响的源码

测试选择与覆盖选择是两件事。相关时同时指定拥有的测试和必须被证明覆盖的源码范围（如 `--coverage.include='<path>/src/**'`）。不要用 `--passWithNoTests`、降低阈值或缩小 include 来藏起一个未覆盖的受影响文件。

## 3. 全量本地演练

只在用户明确要求、诊断 CI 失败、或变更广到没有更窄集合可信时跑全量。用当前的脚本清单作为库存，不要重建已删除的"pre-push 全量聚合"。

## 4. 保护历史重写

standalone 或 stacked 分支允许 rebase（包括评审后）。重写前 fetch 远端分支并记录精确 OID，用 `--force-with-lease=<branch>:<observed-oid>` 发布，让并发更新中止推送。原始 `--force` 永远不允许。

重写推送后重新 fetch 远端头，重新审计未解决的评审线程、批准、可合并性与检查：重写前的提交哈希和行内评论锚点不是当前证据。

### stack 同步后的验证

`gh stack sync` 把 fetch、级联 rebase、push 合成一步，无法在重写与发布之间插入本地验证。运行前要求干净工作树并记录 stack 顺序与远端头；返回后：重查每个分支头与官方顺序 → 对每个重写层对其真实 base 检查范围 → 对每层跑本 skill 选出的证据 → 所有检查通过前每个 PR 保持未合并、报告"验证中"。失败则保留已发布的 lease 保护头，修复、验证、发布修正。不要因为命令成功就宣称 stack 就绪。

## 5. 处理失败

相关检查失败 → 停下，修复或解释阻塞；不要 push 后"看 CI 会不会不一样"。

失败看起来是环境特有的 → 证明它：记录精确命令、失败测试、平台差异；确认非平台相关的证据通过；检查是必需的就优先修跨平台的不确定性。只在用户明确同意时绕过本地钩子，并报告失败的是什么、为何预期 CI 不同。

## 6. 推送流程

1. 跑一次选出的相关检查。
2. 正常 commit；检查 pre-commit 修复器改动的文件再继续。
3. 正常 push，或对授权的重写分支用精确 lease。
4. 校验远端 ref 等于本地 HEAD：`git rev-parse HEAD origin/$(git branch --show-current)`。
5. 对 GitHub PR 查看远端 CI：`gh pr checks`。pending 报告为 pending；先看失败原因再归因于分支或环境。

"no checks reported" 且 `/actions/runs?head_sha=<sha>` 为 0 → 先读 `gh pr view <n> --json mergeable,mergeStateStatus`：PR 处于 CONFLICTING/DIRTY 时 GitHub 不创建 workflow run，缺失的信号是冲突不是基础设施。解冲突是唯一修法；空提交、draft/ready 切换、revert 再恢复都只会留下垃圾历史。

## 报告

只报告实际运行的命令及其观察到的结果。不要把重试、跳过的测试、pending 的 CI 描述为通过。
