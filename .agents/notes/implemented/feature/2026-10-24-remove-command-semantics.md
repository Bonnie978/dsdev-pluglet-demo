# Agent Note: `remove <id>` 是核心命令，未知 id 失败，不重排 id

Status: implemented

## Problem

pluglet 能创建（`add`）和完成（`done`）任务，却不能删除任务：用户只能手改 `tasks.json`，经 [工具清单](2026-10-23-static-tool-manifest-for-agents.md) 工作的 agent 则完全做不到。[核心命令分界的 note](../architecture/2026-10-24-core-commands-limited-to-task-lifecycle.md) 把核心集合定为封闭列表 `list`/`add`/`done`/`help`，向核心加命令需要一条部分取代它并说明为什么不能做成插件的新 note。除了放在哪里，还有两个选择代码本身看不出来：没有任务匹配给定 id 时 `remove` 怎么做，以及其余任务保留原 id 还是重新编号以填补空位。用户从 `list` 读 id 并记下来，所以第二个选择决定了一个记下的 id 会不会悄悄指向另一个任务。

## Decision

`remove` 是核心命令，由 `registerCoreCommands()` 注册在 `done` 与 `help` 之间，底层是 `TaskStore.remove(id)`，返回被删除的任务。`tools/pluglet.tools.json` 相应地有 `pluglet_remove` 工具。

- **未知 id 大声失败**：`remove()` 抛出 `PlugletError('unknown-task')`（退出 1），与 `done` 同一种类。文件不被触碰。消息点名该 id 并指向 `list`。
- **其余 id 稳定**：存储发布同样的记录减去被删除的那条；没有任务改变 id，其余任务保持存储顺序。`add` 仍分配已有最大 id 加一，所以中间留下的空位永不被填补。
- **格式错误的参数是用法错误**：恰好一个正十进制整数，与 `done` 共用 `parseTaskId`，其用法消息点名调用的命令（`usage: remove <id> ...`），退出 2，在读取存储之前解析。
- **输出**：`removed <id>: <title>`，让用户看到该 id 在消失那一刻指的是哪个任务。

### 与核心命令分界的关系

本 note 部分取代[核心命令分界的 note](../architecture/2026-10-24-core-commands-limited-to-task-lifecycle.md)：它把 `remove` 加进封闭的核心集合，分界规则本身（之后的命令以插件发布，再加核心命令需要新 note）仍由那条 note 拥有。`remove` 不能作为插件发布，因为删除是核心自己创建的记录的生命周期终点：插件只从用户 profile 里的路径加载，一个核心能创建却不能删除记录的 CLI 让每个没有挂载插件的用户回到手改 JSON，而 `list` 已经显示用户无法清除的任务。agent 因此能经 `pluglet_remove` 删除任务是进核心的结果，不是理由：分界 note 记载，让 agent 调用插件命令需要重新提议工具清单，而不是把命令搬进核心。

## Alternatives considered

- **以插件发布 `remove`。** 否决，理由见上一节，与[`done` 的 note](2026-10-23-done-command-semantics.md) 拒绝把 `done` 做成插件时的理由相同：一个显示了自己无法改变的状态的 CLI 是不完整，不是极简。
- **未知 id → 幂等的成功，仿照 `done` 对已完成任务的处理。** 否决：对 `done`，存储能看到最终状态已经成立并说出任务名；删除之后没有记录留下，"已经删除 5"与"5 从未存在"无法区分，命令只能为一次没有执行的删除打印成功行，也没有标题可显示。打错的 id（用户记下 7、敲成 17）会以 0 退出并留下本想删除的任务。大声失败让每行陈述一个事实，与 `done`、`unknown-command` 一致。需要容忍缺失 id 的脚本可以检查退出 1 与 `unknown-task` 种类。
- **重新编号其余任务，让 id 保持连续（1..n）。** 否决：每次删除都会移动用户已经从 `list` 读到或记下的 id，于是 `remove 2` 之后的 `remove 3` 删掉的是原来的任务 4。连续性不提供用户要求的任何东西；`list` 会显示空位。
- **不重新编号，并且永不重用任何 id（持久化一个高水位）。** 推迟：`add` 从现有任务推导下一个 id，所以只有最大的 id 会被重新分配，而且只在它的任务被删除之后。永不重用需要在任务数组之外持久化一个计数器，这会改变存储文件格式并需要自己的升级指南。README 在已知限制里列出这种重用；计数器可以作为 Feature Issue 提出。
- **软删除（`removed: true` 标志）而不是丢弃记录。** 否决：它给每个读者加了第三种状态（`list` 必须过滤）、一次持久化格式变更和一个"已经删除"的情况；需求是删除，不是归档。
- **接受多个 id（`remove 1 2 3`）。** 推迟，不是否决：单个 id 让参数解析器与 `done` 共用；之后放宽不会破坏单 id 的调用者。

## Consequences

- 注册了自己的 `remove` 的插件现在在启动时以 `duplicate-registration` 失败；[升级指南](../../../../docs/upgrade-guide/v0.1.0/remove-core-command/guide.md)给出修法。没有新的 `PlugletErrorKind`，嵌入者的穷尽式 switch 继续编译。
- `help` 期望输出、README 命令表与工具清单是用户与模型可见措辞的三个家，三者一起改。
- 最大的 id 在它的任务被删除后可能被 `add` 重新分配（README，已知限制）；`pluglet_add` 的描述因此说"已有最大 id 加一"而不是"下一个序号"。

## Testing

`tests/store.spec.ts` 拥有 `remove()`（返回被删除的记录、其余 id 与顺序不变、在 publish 的非升序数组上不重排、`add` 不填补空位、未知 id 时文件不变）；`tests/commands.spec.ts` 拥有命令输出、`help` 顺序以及 `done` 与 `remove` 的用法拒绝；`tests/tools.spec.ts` 把 `pluglet_remove` 钉到注册表并经 `runCli` 核对其描述的声明；`tests/cli.e2e.ts` 通过构建出的 `lib/bin.js` 运行同样的流程，包括退出码 1 与 2 以及每次失败后字节相同的文件；`tests/expected/help.expected.txt` 钉住 help 行。
