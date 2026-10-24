---
kind: upgrade-guide
description: "核心新增 `remove` 命令；注册自己的 `remove` 的插件在启动时失败。"
---

# `remove` 成为核心命令

## Change

之前，核心注册 `list`、`add`、`done` 和 `help`，插件可以注册自己的 `remove` 命令。现在核心也注册 `remove <id>`（删除一个任务，id 缺失时 `unknown-task`，其余 id 不变），所以注册 `remove` 的插件在启动时以 `PlugletError('duplicate-registration')`（退出 1）失败，不运行任何命令。`PlugletErrorKind` 不变。

## Migration

1. 插件：重命名你的 `remove` 命令；若核心行为正是你想要的，则删除它。用 `pluglet help` 确认：命令列表只打印一次 `remove`，且没有 `duplicate-registration` 错误。
2. 依赖插件版 `remove` 把缺失 id 当成功的脚本：核心以退出 1 和 `no task with id <id>` 失败；在原先假定成功的地方检查退出状态。
