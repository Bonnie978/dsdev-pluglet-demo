---
kind: upgrade-guide
description: "CLI 标志 `--config` 改名为 `--profile`，默认配置文件从 `pluglet.json` 改为 `pluglet.profile.json`；没有别名，`--config` 在任何位置都是用法错误。"
---

# `--profile` 替代 `--config`，默认文件改为 `pluglet.profile.json`

## Change

0.1.0 的 CLI 用 `--config <file>` 指定配置文件（命令前后都接受），省略时读当前目录的 `pluglet.json`；其他以 `--` 开头的参数原样传给命令。下一个发布改为 `--profile <file>`，省略时读当前目录的 `pluglet.profile.json`。`--config` 没有别名也没有过渡期：`--profile` 是唯一的选项，任何其他以 `--` 开头的参数在任何位置都是用法错误（退出 2），不再传给命令。配置文件的内容（`store`、`plugins`）不变。

每个从命令行或脚本调用 `pluglet` 的人都会观察到：

- `pluglet --config ./pluglet.json list`、`pluglet list --config ./pluglet.json`、`pluglet add --config ./pluglet.json buy milk` 都以退出 2 失败，stderr 为 `pluglet: unknown option "--config"; the only option is --profile <file>`；不读任何配置文件，也不碰任务存储。
- 只有旧默认文件 `pluglet.json` 的目录里运行 `pluglet list` 以 `config-missing` 退出 1，stderr 为 `pluglet: config file <cwd>/pluglet.profile.json does not exist; pass --profile <file>`。
- 以 `--` 开头的命令参数（例如 `pluglet add --urgent fix` 曾记下标题为 `--urgent fix` 的任务）同样以退出 2 失败；单个 `-` 开头的参数（`-x`）不受影响。

程序化调用者（`parseArgv`、`runCli`、`Invocation.configPath`）的导出名不变；`parseArgv` 对 `--config` 与其他未知选项抛 `PlugletError('usage')`。

## Migration

1. 在每条命令行、脚本与 CI 步骤里把 `--config` 替换为 `--profile`：`pluglet --config ./x.json list` → `pluglet --profile ./x.json list`。
2. 依赖默认文件名的目录里把 `pluglet.json` 重命名为 `pluglet.profile.json`（`git mv pluglet.json pluglet.profile.json`）；不需要改文件内容。
3. 把以 `--` 开头的命令参数改写为不以 `--` 开头（例如任务标题 `--urgent fix` → `urgent: fix`）。
4. 确认迁移成功：重跑每条改过的调用，退出 0 表示已迁移。没有改完的调用以退出 2 和 `unknown option "--config"` 失败（无论 `--config` 在命令前还是命令后）；仍用旧默认文件名的目录以退出 1 和 `config-missing` 失败。
