# Agent Note: 拒绝默认导出为函数的插件，而不是适配它们

Status: implemented

## Problem

Issue #17 报告了一个写成 `export const name = 'tag'` 加 `export default function apply(ctx) {...}` 的插件。`unwrapPlugin()` 把该函数当作插件对象接受了，因为函数自带 `.name` 并继承 `Function.prototype.apply`；CLI 随后以一个引擎 TypeError 崩溃，它点名的是 `lib/plugins.js` 而不是插件（[postmortem 0001](../../../../docs/postmortem/0001-default-exported-function-passes-plugin-validation.md)）。有两种可能的应对：把这种形状当作第三种被接受的插件格式，或以可行动的 `plugin-invalid` 拒绝它。

## Decision

`unwrapPlugin()` 恰好接受两种模块形状：命名导出 `name` 和 `apply`，或携带两者的默认导出对象。探测任何字段之前，它先检查 `typeof unwrapped === 'object'`；任何其他类别的默认导出在加载时以 `PlugletError('plugin-invalid')` 失败，其消息点名插件路径、观察到的 `typeof` 以及两种被接受的形状。README 的"写一个插件"一节是这条契约面向消费者的家；`docs/defensive-patterns/general.md` 持有该修复所遵循的一般规则。

## Alternatives considered

- **接受混合形状：命名的 `name` 加一个用作 `apply` 的默认导出函数。** 否决。它增加了第三种没人要求的文档化格式，在模块同时有命名 `apply` 和默认函数时有歧义，而且用户的抱怨是缺少诊断，不是缺少格式。若插件作者持续这样写，可以作为 Feature 重新提议；拒绝消息告诉他们今天可用的两种形状。
- **把插件 `apply` 抛出的每个非 `PlugletError` 包装成点名该插件的 `plugin-invalid`。** 本次变更否决。`runCli` 记载缺陷会向上传播；包装它们会把插件作者自己的堆栈藏在我们的消息后面，并改变 CLI 测试钉住的一条契约。这是关于缺陷报告的独立决策，与校验 bug 无关。
- **要求自有属性（`Object.hasOwn(candidate, 'apply')`）而不是类别检查。** 否决。它会拒绝 `apply` 住在原型上的默认导出类实例，而对象形状合法地允许这种情况。先检查类别才是精确的修复：它排除了继承属性会骗过字段探测的那一族值（函数、原始值），同时不动任何对象形状。

## Consequences

- 默认导出为函数的插件现在以 1 退出，输出 `pluglet: plugin <path>: default export is a function, not a plugin object; ...` 且没有堆栈；没有任何此前可用的配置改变行为，所以不需要升级指南。
- 插件作者从错误本身和 README 得到被接受的形状；加载器永不静默适配一个它没有文档化的形状。
- 模块形状的校验在三层用用户的文件原样测试（`tests/harness.ts` 里的 `DEFAULT_FUNCTION_PLUGIN`）；未来改变形状必须同时更新该 fixture 与 README。
