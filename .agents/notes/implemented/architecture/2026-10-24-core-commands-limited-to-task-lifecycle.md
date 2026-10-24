# Agent Note: 核心命令限于任务生命周期，新命令以插件发布

Status: implemented

## Problem

pluglet 的核心与插件之间的分界此前只作为一次性的判断存在：[`done` 的 note](../feature/2026-10-23-done-command-semantics.md) 为让 `done` 进核心把分界"重画一次"，画在任务生命周期上，`docs/architecture.md` 写着"其他新命令写成插件"。两处都没有说下一个看似属于生命周期的命令该怎么处理，于是每个新命令都可能再引用"生命周期"这个词把自己加进核心，而每加一个核心命令都会扩大 `help` 输出、`tools/pluglet.tools.json` 的工具集和嵌入者看到的 `registerCoreCommands` 的契约（Issue #81）。

## Decision

核心命令集合是 `registerCoreCommands()` 注册的 `list`、`add`、`done`、`remove`、`help`，即任务生命周期的创建、完成、删除、读取、发现；`remove` 由[部分取代本 note 的 `remove` note](../feature/2026-10-24-remove-command-semantics.md) 加入。之后的新命令以插件发布，通过 `ctx.commands.register()` 注册。向核心再加任何命令都需要一条新的 Agent Note，它链接并部分取代本 note，并且必须说明为什么这个命令不能作为插件发布；没有这样的 note，核心集合不变。

这条规则只管向核心增加命令。现有核心命令的行为仍由各自的 note 与测试管理，例如 `done` 推迟的多 id 支持可以在 [`done` 的 note](../feature/2026-10-23-done-command-semantics.md) 下放宽而不触发本规则。

## Alternatives considered

- **逐个判断：每次有命令申请进核心时，在该命令自己的 note 里重新论证分界。** 否决。这是本 note 之前的做法；"生命周期"没有封闭的定义，每个申请者都能论证自己属于它，分界于是随最近一次论证漂移。把集合写成封闭列表并要求新 note 取代，让扩大核心成为一个显式、可评审的决策，而不是某个功能 PR 的副产品。
- **把未来的"内置"命令作为随包发布的插件。** 否决，理由与 [`done` 的 note](../feature/2026-10-23-done-command-semantics.md) 拒绝把 `done` 做成插件时相同：插件只从用户 profile 里的路径加载，内置插件需要每份 profile 引用包内路径。插件命令由用户在 profile 里选择启用，这正是它们和核心的区别。
- **用一个 gate 机械地阻止没有新 note 的核心改动。** 否决。核心集合已经被精确钉住：`tests/commands.spec.ts` 断言 `help` 列出的恰好是核心集合，`tests/expected/help.expected.txt` 钉住 help 行，`tests/tools.spec.ts` 要求清单工具集等于注册表，所以任何核心增加都已经让测试变红并产生可见的 diff。gate 能检查一条 note 是否存在，却判断不了它的理由是否成立；后者是评审的工作。

## Consequences

- 核心面保持稳定：`help` 输出、工具清单和嵌入者通过 `src/index.ts` 拿到的 `registerCoreCommands` 只在一条新 note 被评审通过时变化。
- 插件命令对 agent 只可见不可调用：[工具清单 note](../feature/2026-10-23-static-tool-manifest-for-agents.md) 让清单恰好覆盖核心命令，插件命令只出现在 `pluglet_help` 的结果里。让 agent 调用插件命令需要那条 note 记载的重新提议，而不是把命令搬进核心。
- 用户要用插件提供的命令，必须在 profile 的 `plugins` 里引用它；这是有意的代价。
- `docs/architecture.md` 的"新行为放哪"一节是这条规则面向贡献者的家。
