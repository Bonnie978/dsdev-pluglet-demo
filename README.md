# pluglet

一个很小的、基于插件的任务 CLI。它存在的目的是作为 [dsdev 开发方法](.claude/skills/README.md)的试验场：每个改动都走"读规则 → 决策留痕 → 规划覆盖 → 实现 → 文档同提交 → 最小相关证据 → PR"的循环。

## Summary

你可以用 `pluglet add <title>` 记任务、`pluglet done <id>` 标记完成、`pluglet list` 看任务，并通过配置文件挂载插件来增加命令。配置错误、插件错误、重复注册都在启动时以带 `kind` 的结构化错误大声失败，退出码区分用法错误（2）与其他已处理失败（1）。任务存在一个 JSON 文件里，写入是原子的。

## 使用

```sh
pnpm install && pnpm run build
node lib/bin.js --config ./pluglet.json add buy milk
node lib/bin.js --config ./pluglet.json done 1
node lib/bin.js --config ./pluglet.json list
node lib/bin.js --config ./pluglet.json help
```

核心命令：

| 命令 | 效果 | 失败 |
|---|---|---|
| `add <title words...>` | 追加任务，打印 `added <id>: <title>` | 空标题 → `usage`，退出码 2 |
| `done <id>` | 把任务标为完成，打印 `done <id>: <title>`；任务已完成时打印 `already done <id>: <title>`，不改写文件，退出码 0 | id 不存在 → `unknown-task`，退出码 1；缺少 id、非正整数或多个 id → `usage`，退出码 2 |
| `list` | 每行 `<id> [x] <title>`，未完成为 `[ ]` | — |
| `help` | 按注册顺序列出命令与描述 | — |

`done` 的取舍见 [Agent Note](.agents/notes/implemented/feature/2026-10-23-done-command-semantics.md)。

配置文件（相对路径相对配置文件所在目录解析）：

```json
{ "store": "tasks.json", "plugins": ["./plugins/shout.mjs"] }
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `store` | `tasks.json` | 任务 JSON 文件路径 |
| `plugins` | `[]` | 按顺序加载的插件模块路径；不存在的路径在加载时失败 |

## 写一个插件

插件模块命名导出 `name` 与 `apply(ctx)`；`apply` 通过 `ctx.commands.register()` 注册命令，并把返回的释放函数交给 `ctx.effect()`：

```js
export const name = 'shout'
export function apply(ctx) {
  ctx.effect(ctx.commands.register('shout', {
    description: 'Upper-case the arguments.',
    run: (args) => [args.join(' ').toUpperCase()],
  }))
}
```

注册即效果：插件树释放时所有命令被移除。同名命令第二次注册抛 `duplicate-registration`，包括与核心命令 `list`/`add`/`done`/`help` 同名。

## 开发

见 [docs/development.md](docs/development.md)、[docs/architecture.md](docs/architecture.md)、[docs/testing.md](docs/testing.md)。Agent 遵循 [AGENTS.md](AGENTS.md)。

## Known Limitations and Deferred Work

- **单文件存储不支持并发写入者**：两个进程同时 `add` 会丢失其中一个的任务；原子 rename 只保证文件不撕裂。
