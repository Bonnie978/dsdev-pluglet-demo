# Agent Note: `--config` 改名为 `--profile`，不设别名并拒绝未知选项

Status: implemented

## Problem

Issue #21 重命名 CLI 的配置选择器：`--config <file>` 改为 `--profile <file>`，默认文件 `pluglet.json` 改为 `pluglet.profile.json`；文件的内容（`store`、`plugins`）不变。改名会破坏每一个现有调用点，解析器必须决定怎样处理它不认识的 token。0.1.0 把除 `--config` 外的每个 token 作为普通参数透传给命令，于是放在命令之后的残留 `--config ./x.json` 会消失在命令的参数里：`pluglet add --config ./x.json buy milk` 以 0 退出并存下一条标题为 `--config ./x.json buy milk` 的任务，靠退出状态检查的迁移发现不了它。

## Decision

`--profile <file>` 是 `parseArgv` 识别的唯一选项。任何其他以 `--` 开头的 token，无论在哪个位置，都在解析时以 `PlugletError('usage', 'unknown option "<arg>"; the only option is --profile <file>')`（退出 2）失败，发生在读取任何 profile 或存储之前。`--config` 没有别名也没有弃用期：它像所有其他未知选项一样失败。以单个 `-` 开头的 token 仍是普通参数。README 陈述消费者契约；[升级指南](../../../../docs/upgrade-guide/v0.1.0/profile-flag-rename/guide.md) 承载迁移步骤。

维护者的理由：CLI 处于开发者预览期且已宣告会有破坏性变更，所以别名之后还得用第二份升级指南来移除；对用户而言，在每个调用点大声失败比一个事后再移除的静默别名更便宜。没有插件计划接收以短横线开头的参数，所以拒绝它们不让任何现有消费者付出代价。

## Alternatives considered

- **保留 `--config` 作为别名一个发布周期。** 否决：别名是第二个面，自身必须用第二份升级指南移除，而且在重叠期内脚本继续工作，没人注意到它们用的是一个即将消失的标志。开发者预览的声明已经许可了这次破坏；每个调用点一次大声失败让迁移在一个发布内结束。
- **用专门的错误拒绝旧标志（`--config was renamed to --profile`）。** 否决：专门的分支是一个反向别名，有同样的生命周期问题（之后必须删除），并且把一个未知选项与其他所有未知选项区别对待。通用的 `unknown option "<arg>"; the only option is --profile <file>` 点名了唯一有效的选项，给出同样可行动的信息，却不需要针对特定标志的代码路径。
- **把未知的 `--` token 透传给命令。** 否决：残留的标志变成命令输入并以 0 退出，于是用户和升级指南都无法用退出状态验证迁移。AGENTS.md 要求配置错误在最早可解析点失败，对 argv 而言就是 `parseArgv`。今天没有东西需要以短横线开头的参数；需要的插件可以作为 Feature 提议一个选项结束标记。

## Consequences

- 每个残留的 `--config`，无论在命令前还是命令后，都以 2 退出并给出点名替代物的消息；每个迁移完的调用以 0 退出，所以退出状态可以验证迁移。
- 命令参数不能以 `--` 开头（例如 `add --urgent fix`）；单短横线参数仍然可以。
- `tests/cli.spec.ts` 钉住解析器契约，`tests/cli.e2e.ts` 通过构建出的 bin，在两个位置、默认 profile 存在与不存在两种情况下，钉住退出码、精确的 stderr 行和未被触碰的存储。
