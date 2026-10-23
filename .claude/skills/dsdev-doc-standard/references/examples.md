# 散文标准：校准示例

每条给出原则、劣版与优版。随用户决策追加；不写 PR 历史或评审者叙述。

## 注释陈述契约，不辩护

- 劣：`// 这个 cast 是安全的，因为上面已经检查过了`
- 优：`// 调用者已在 parseConfig 验证 kind ∈ Kind；此处窄化不做二次校验（见 docs/AGENTS.md "Trust TypeScript at typed same-process boundaries"）`
- 原则：说出使代码安全的不变量与它的家，不对评审者说话。

## 现在时而非变更叙述

- 劣：`sessions no longer write v0 files; the old reader is removed`
- 优：`Sessions write lowercase session.vN.jsonl; committed generations are never renamed.`
- 原则：README/JSDoc 写当前状态；"曾经如何"留给 Agent Note 或 postmortem。

## 反事实回归钉是允许的

- 保留：`// Without the exclusive publish, a concurrent writer could clobber the successor file.`
- 原则：现在时反事实陈述了被守卫的行为，HEAD 处的读者可以核实。

## 计划残留提升为标记

- 劣：`// probably enough for now`
- 优：`// TODO: bound is 64 KiB per chunk; raise when the spill pipeline lands (#123)`
- 原则：含糊的信心换成实际界限或带 Issue 的 TODO。

## Summary 说"能做什么"，不说"是什么"

- 劣：`The seam registers ctx.notes and appends notes/event records.`
- 优：`You can attach a note to any message and it survives restarts.`
- 原则：README 开头面向读者可见的能力，源码标识符只在读者会直接用到时出现。

## 空 catch 必须命名错误与原因

- 劣：`} catch {}`
- 优：`} catch (error) { /* ENOENT: the cache file is optional on first run */ }`
- 原则：`try` 块保持一条语句，catch 说出错误名与为何可忽略。
