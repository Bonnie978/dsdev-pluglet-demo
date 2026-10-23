# pluglet

一个很小的、基于插件的任务 CLI。它存在的目的是作为 [dsdev 开发方法](.claude/skills/README.md)的试验场：每个改动都走"读规则 → 决策留痕 → 规划覆盖 → 实现 → 文档同提交 → 最小相关证据 → PR"的循环。

## Summary

你可以用 `pluglet add <title>` 记任务、`pluglet list` 看任务，并通过配置文件挂载插件来增加命令。配置错误、插件错误、重复注册都在启动时以带 `kind` 的结构化错误大声失败，退出码区分用法错误（2）与其他已处理失败（1）。任务存在一个 JSON 文件里，写入是原子的。

## 使用

```sh
pnpm install && pnpm run build
node lib/bin.js --profile ./pluglet.profile.json add buy milk
node lib/bin.js --profile ./pluglet.profile.json list
node lib/bin.js --profile ./pluglet.profile.json help
```

`--profile <file>` 指定配置文件；省略时读当前目录的 `pluglet.profile.json`。文件不存在时以 `config-missing` 退出 1。`--profile` 是唯一的选项：任何其他以 `--` 开头的参数，无论位置，都是用法错误并以退出 2 失败，不会传给命令。配置文件内容（相对路径相对配置文件所在目录解析）：

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

也可以把同一个 `{ name, apply }` 对象作为默认导出。只接受这两种形状：默认导出是函数（例如 `export default function apply(ctx)`）或其他非对象值时，加载在启动时以 `plugin-invalid` 失败，stderr 指出插件文件、实际类型与两种可接受形状；缺少 `name` 或 `apply` 同样是 `plugin-invalid`。

注册即效果：插件树释放时所有命令被移除。同名命令第二次注册抛 `duplicate-registration`。

## 开发

见 [docs/development.md](docs/development.md)、[docs/architecture.md](docs/architecture.md)、[docs/testing.md](docs/testing.md)。Agent 遵循 [AGENTS.md](AGENTS.md)。

## Known Limitations and Deferred Work

- **没有 `done` 命令**：任务只能添加与列出；`Task.done` 由插件或直接编辑文件改变。
- **单文件存储不支持并发写入者**：两个进程同时 `add` 会丢失其中一个的任务；原子 rename 只保证文件不撕裂。
