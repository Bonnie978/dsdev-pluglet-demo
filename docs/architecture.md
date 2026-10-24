# pluglet 架构

改 `src/` 之前读这篇。它是有序地图：组合方式、核心模块、主流程、扩展点。类型定义在各模块的 JSDoc；决策理由在 [Agent Notes](../.agents/notes/README.md)。

## 组合

一次运行是 `runCli(argv)` 组装出来的一棵对象树：解析 argv → 加载并验证配置 → 打开任务存储 → 建命令注册表 → 注册核心命令 → 按配置顺序加载插件 → 解析并运行命令 → 逆序释放插件与核心命令。没有全局状态；每次运行自己拥有全部对象。

## 核心模块

| 模块 | 拥有 | 入口 |
|---|---|---|
| `src/errors.ts` | `PlugletError` 与它的 `kind` 判别集合；`assertNever` | `PlugletError` |
| `src/registry.ts` | 命名注册表：重复拒绝、释放器 | `Registry<T>` |
| `src/config.ts` | 配置文件读取与验证；路径绝对化 | `loadConfig()` |
| `src/store.ts` | 任务 JSON 文件；原子发布 | `TaskStore` |
| `src/plugins.ts` | 插件模块规范化与加载；半应用树的回滚 | `loadPlugins()`、`unwrapPlugin()` |
| `src/commands.ts` | 核心命令 `list`/`add`/`done`/`help`；命令解析 | `registerCoreCommands()`、`resolveCommand()` |
| `src/cli.ts` | argv 解析、运行循环、退出码映射 | `runCli()`、`parseArgv()`、`exitCodeFor()` |
| `src/bin.ts` | 进程入口，无逻辑 | `lib/bin.js` |
| `src/index.ts` | 嵌入者（例如 MCP server）与插件作者导入的公开 API，导出列表由 `tests/index.spec.ts` 钉住（保留理由见 [Agent Note](../.agents/notes/rejected/simplification/2026-10-23-drop-library-entry-point.md)） | `lib/index.js` |

## 主流程

```text
argv
  parseArgv            usage 错误 → exit 2
  loadConfig           config-missing / config-invalid → exit 1
  new TaskStore
  new Registry<Command>
  registerCoreCommands
  loadPlugins          每个插件: import → unwrapPlugin → apply(ctx)；任一失败则逆序释放已应用的插件
  resolveCommand       unknown-command → exit 1
  command.run(args)    返回要打印的行；usage → exit 2，unknown-task → exit 1
  finally: disposePlugins(); disposeCore()
```

## 扩展点

- **命令**：插件在 `apply(ctx)` 里 `ctx.commands.register(name, command)`，并把释放器交给 `ctx.effect()`。
- **存储**：`ctx.store` 是运行的 `TaskStore`；插件通过它读写任务，不直接碰文件。

没有其他扩展点。改 `runCli` 的顺序或增删阶段必须同时更新本文件。

## 新行为放哪

核心只保留任务生命周期的基本动作 `list`/`add`/`done`/`help`（`done` 进核心的理由见 [Agent Note](../.agents/notes/implemented/feature/2026-10-23-done-command-semantics.md)）；其他新命令写成插件。向核心再加命令需要一条新的 Agent Note 部分取代[核心命令分界的 note](../.agents/notes/implemented/architecture/2026-10-24-core-commands-limited-to-task-lifecycle.md)，并说明为什么它不能是插件。改核心命令同时更新 `tests/expected/help.expected.txt` 与 `tools/pluglet.tools.json`（[README](../README.md#给-llm-agent-暴露工具)）。改配置字段同时更新 `loadConfig` 的 `KNOWN_KEYS`、README 的配置表与相关测试。
