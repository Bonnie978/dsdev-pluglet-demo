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
| `src/commands.ts` | 核心命令 `list`/`add`/`help`；命令解析 | `registerCoreCommands()`、`resolveCommand()` |
| `src/cli.ts` | argv 解析、运行循环、退出码映射 | `runCli()`、`parseArgv()`、`exitCodeFor()` |
| `src/bin.ts` | 进程入口，无逻辑 | `lib/bin.js` |

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
  command.run(args)    返回要打印的行
  finally: disposePlugins(); disposeCore()
```

## 扩展点

- **命令**：插件在 `apply(ctx)` 里 `ctx.commands.register(name, command)`，并把释放器交给 `ctx.effect()`。
- **存储**：`ctx.store` 是运行的 `TaskStore`；插件通过它读写任务，不直接碰文件。

没有其他扩展点。改 `runCli` 的顺序或增删阶段必须同时更新本文件。

## 新行为放哪

新命令写成插件；核心只保留 `list`/`add`/`help`。改配置字段同时更新 `loadConfig` 的 `KNOWN_KEYS`、README 的配置表与相关测试。
