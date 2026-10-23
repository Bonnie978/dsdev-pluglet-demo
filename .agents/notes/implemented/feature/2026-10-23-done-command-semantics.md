# Agent Note: `done <id>` 是核心命令，完成操作幂等

Status: implemented

## Problem

pluglet 在 `list` 里把 `Task.done` 渲染为 `[x]`，却没有提供设置它的方式：用户得写一个插件或手改 `tasks.json`。Issue #12 要求一个 `done <id>` 命令。有两个选择光看代码并不显然：`done` 是否属于核心（架构地图说核心只保留 `list`/`add`/`help`，新命令都是插件），以及 id 不存在或任务已完成时 `done` 做什么。

## Decision

`done` 是核心命令，由 `registerCoreCommands()` 注册在 `add` 与 `remove` 之间，底层是 `TaskStore.complete(id)`。

- **未知 id 大声失败**：`complete()` 抛出 `PlugletError('unknown-task')`，这是一个新的判别值，像 `unknown-command` 一样映射到退出码 1。文件不被触碰。消息点名该 id 并指向 `list`。
- **已完成是幂等的成功**：`complete()` 返回 `{ task, changed: false }`，命令打印 `already done <id>: <title>`，以 0 退出，存储文件不被重写（字节相同，没有临时文件）。结果形状同时陈述两个事实（最终状态，以及本次调用是否改变了它），而不是折叠成一个值。
- **格式错误的参数是用法错误**：`done` 要求恰好一个正十进制整数；参数缺失、多余或非整数时抛出 `PlugletError('usage')`（退出 2），在读取存储之前解析。

核心集合是一个待办 CLI 缺了就无法发布的任务生命周期：创建、完成、删除（[`remove`](2026-10-24-remove-command-semantics.md)）、读取、发现。其余一切仍是插件；这条分界作为持续规则由 [核心命令分界的 note](../architecture/2026-10-24-core-commands-limited-to-task-lifecycle.md) 拥有，向核心再加命令需要一条部分取代它的新 note。

## Alternatives considered

- **把 `done` 作为插件而不是核心发布。** 否决：插件只从用户配置里的路径加载，所以一个"内置"插件需要每份配置都引用包内的一个路径，而 `list` 已经渲染 `done` 状态；一个显示了自己无法设置的字段的 CLI 是不完整，不是极简。核心/插件的分界只重画一次，画在任务生命周期上，记录在 [核心命令分界的 note](../architecture/2026-10-24-core-commands-limited-to-task-lifecycle.md) 和 `docs/architecture.md`。
- **已完成 → 错误（退出 1）。** 否决：`done` 声明的是期望的最终状态；该状态已成立时失败，会让部分失败后重跑脚本也失败，而这个错误保护不了任何东西（重复执行不丢数据）。独特的 `already done` 措辞让事实保持可见，又不把它变成失败。
- **已完成 → 打印同样的 `done <id>: <title>` 行。** 否决：它报告了一次没有发生的写入；输出应当每个值陈述一个事实。
- **未知 id → 用法错误（退出 2）。** 否决：argv 是良构的；失败是对缺失数据的引用，与 `unknown-command` 同类。独立的 `unknown-task` 种类让嵌入者无需解析文本就能按它路由。
- **接受多个 id（`done 1 2 3`）。** 推迟，不是否决：issue 要求一个 id，现在拒绝多余参数让面保持小；之后的变更可以放宽解析器而不破坏单 id 调用者。
- **在命令里复用 `TaskStore.publish()` 而不是新增 `complete()`。** 否决：查找、无操作规则和 `unknown-task` 失败属于拥有文件的存储，这样插件通过 `ctx.store.complete()` 得到同样的语义。

## Consequences

- `PlugletErrorKind` 新增 `unknown-task`；`exitCodeFor()` 把它映射到 1，穷尽式 switch 迫使未来每个种类都选择一个退出码。自己对该种类做穷尽式 switch 的嵌入者必须加上这个 case（[升级指南](../../../../docs/upgrade-guide/v0.1.0/done-core-command/guide.md)）。
- 注册了自己的 `done` 的插件现在在启动时以 `duplicate-registration` 失败；升级指南给出修法。
- `help` 的期望输出与 README 命令表是用户可见措辞的两个家；两者一起改。

## Testing

`tests/store.spec.ts` 拥有 `complete()`（变更、字节相同的无操作、未知 id 时文件不被触碰）；`tests/commands.spec.ts` 拥有命令输出与用法拒绝；`tests/cli.spec.ts` 拥有退出码映射；`tests/cli.e2e.ts` 通过构建出的 `lib/bin.js` 跑同一流程；`tests/expected/help.expected.txt` 钉住 help 行。
