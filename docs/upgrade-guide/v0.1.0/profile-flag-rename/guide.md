---
kind: upgrade-guide
description: "CLI 标志 `--config` 改名为 `--profile`，默认配置文件从 `pluglet.json` 改为 `pluglet.profile.json`；没有别名。"
---

# `--profile` 替代 `--config`，默认文件改为 `pluglet.profile.json`

## Change

0.1.0 的 CLI 用 `--config <file>` 指定配置文件，省略时读当前目录的 `pluglet.json`。下一个发布改为 `--profile <file>`，省略时读当前目录的 `pluglet.profile.json`。`--config` 没有别名也没有过渡期：它不再是选项，而是被当作命令名。配置文件的内容（`store`、`plugins`）不变。

每个从命令行或脚本调用 `pluglet` 的人都会观察到：

- `pluglet --config ./pluglet.json list` 以 `config-missing` 退出 1（因为 `pluglet.profile.json` 不存在），或在该文件存在时以 `unknown command "--config"` 退出 1。
- 只有旧默认文件 `pluglet.json` 的目录里运行 `pluglet list` 以 `config-missing` 退出 1，stderr 为 `pluglet: config file <cwd>/pluglet.profile.json does not exist; pass --profile <file>`。

程序化调用者（`parseArgv`、`runCli`、`Invocation.configPath`）的导出名不变；只有被识别的标志与默认文件名变了。

## Migration

1. 在每条命令行、脚本与 CI 步骤里把 `--config` 替换为 `--profile`：`pluglet --config ./x.json list` → `pluglet --profile ./x.json list`。
2. 依赖默认文件名的目录里把 `pluglet.json` 重命名为 `pluglet.profile.json`（`git mv pluglet.json pluglet.profile.json`）；不需要改文件内容。
3. 确认迁移成功：在该目录运行 `pluglet help`，退出 0 并打印命令列表；没有改完的调用会以退出 1 和上面的 `config-missing` 或 `unknown command "--config"` 信息失败。
