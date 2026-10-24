---
kind: upgrade-guide
description: "核心新增 `done` 命令与 `unknown-task` 错误种类；名为 `done` 的插件和对 PlugletErrorKind 的穷尽式 switch 必须修改。"
---

# `done` 成为核心命令；`PlugletErrorKind` 新增 `unknown-task`

## Change

之前，核心注册 `list`、`add` 和 `help`，插件可以注册自己的 `done` 命令。现在核心也注册 `done`，所以注册 `done` 的插件在启动时以 `PlugletError('duplicate-registration')`（退出 1）失败，不运行任何命令。

之前，`PlugletErrorKind` 有六个成员。现在它还有 `unknown-task`，由 `TaskStore.complete()` 与 `done` 命令在没有任务匹配给定 id 时抛出。对该种类做穷尽式 switch（例如用 `assertNever`）的嵌入者在处理新成员之前无法通过编译；`exitCodeFor()` 已把它映射到 1。

## Migration

1. 插件：重命名你的 `done` 命令；若核心行为（标记完成、重复时 `already done`、id 缺失时 `unknown-task`）正是你想要的，则删除它。用 `pluglet help` 确认：命令列表打印出来且没有 `duplicate-registration` 错误。
2. 嵌入者：在每个对 `PlugletErrorKind` 的穷尽式 switch 里、`unknown-command` 旁边加上 `case 'unknown-task':`。在你的项目里用 `pnpm run typecheck` 确认。
