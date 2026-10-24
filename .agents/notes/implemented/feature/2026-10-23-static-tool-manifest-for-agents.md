# Agent Note: 通过静态工具清单把核心命令暴露给 LLM Agent

Status: implemented

## Problem

Issue #52 要把 pluglet 以 MCP 风格的工具清单暴露给 LLM Agent。CLI 已经给每个命令带了一条描述，但那些字符串是写给终端前读 `help` 输出的人看的；agent 需要知道一次调用返回什么、一个参数是什么意思、这组工具到底何时适用。清单还必须与它背后的 CLI 保持一致：核心命令集合、profile 选项的名字及其默认文件都是 `src/` 的事实，而模型可见的文本重复了它们。

## Decision

`tools/pluglet.tools.json` 是手写并经评审的文件：`tools` 数组按注册顺序为每个核心命令放一个定义（`name`、`description`、JSON Schema 形式的 `parameters`），`systemPromptSection` 字符串说明何时使用这组工具以及它做不到什么。工具集恰好是 `registerCoreCommands` 注册的命令；每个工具都接受同一个可选参数 `profile`，以 CLI 的 `--profile` 选项命名，缺省为它的 `pluglet.profile.json`。`tests/tools.spec.ts` 把这两点钉到真实代码上，执行 agent-experience 规则（每个参数有描述、两个工具不共享同一句话、系统提示词章节不复述任何工具或参数描述），并经 `runCli` 真实运行 README 的映射来核对描述里的声明。README 的「给 LLM Agent 暴露工具」一节是清单契约与 MCP server 实现的工具到 CLI 映射的消费者侧的家。

## Alternatives considered

- **服务启动时从命令注册表生成清单。** 否决。注册表的描述是写给人的简短 `help` 字符串，会原样到达模型；命令集合会随每个 profile 的插件变化，agent 被提示的工具集因此既不稳定也无法评审；模型可见文本是行为，应由评审和测试钉住，生成的文件做不到。测试改为把静态文件与注册表比较来保持它诚实。
- **加一个通用的 `pluglet_run` 工具，转发任意命令名与参数，覆盖插件命令。** 本次否决。无类型的透传不给模型可填的 schema，也不给可据以决定的描述，而这正是工具定义存在的目的；agent 需要插件命令时可以作为 Feature 重新提出。
- **用 `$ref` 指向文件里的一个定义来共享 `profile` 参数。** 否决。MCP 客户端单独读取每个工具的 schema，跨工具引用无法解析；测试改为要求每份拷贝完全一致。

## Consequences

- 增加、改名或删除核心命令，或改变 `--profile` 的缺省值，都会让 `tests/tools.spec.ts` 变红直到清单跟上；`tests/expected/help.expected.txt` 与清单在同一提交里改。
- 插件命令通过 `pluglet_help` 对 agent 可见但不可调用；`systemPromptSection` 写明这一点，让 agent 把它们交给用户而不是猜。
- 清单是模型可见文本：改描述是行为变更并按行为变更评审，遵循测试部分执行的 dsdev-agent-experience 规则。
