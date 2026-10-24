# Post-mortem 0001: `pluglet` 在一个默认导出 `apply` 函数的插件上以裸 TypeError 崩溃 — 校验器把 `Function.prototype.apply` 当成了插件的 `apply`

Status: resolved (fix in the PR that closes Issue #17)

## Executive summary

已发布的 0.1.0 CLI 的一位用户写了一个带 `export const name = 'tag'` 和 `export default function apply(ctx) {...}` 的插件。`unwrapPlugin()` 取 `ns.default ?? ns` 作为插件对象，并探测 `typeof candidate.name === 'string'` 与 `typeof candidate.apply === 'function'`。函数同时满足两者：它自己的 `.name` 是 `"apply"`，并且继承 `Function.prototype.apply`。加载器因此构造了一个名为 `apply`、其 `apply` 是 `Function.prototype.apply` 的插件，调用了它，进程随即死于引擎 TypeError，堆栈点名 `lib/plugins.js`，从未点名插件文件。全部 27 个单元测试通过，逐文件覆盖率全程 100%，因为这个 bug 是一个缺失的检查：没有哪一行未被覆盖，只是这个输入从未被考虑。修复在探测字段之前先检查解包值的类别，并以 `plugin-invalid` 失败，点名文件、观察到的类型和两种被接受的形状；持久的教训是，对外部值做结构校验必须先确立它是哪一类值再对字段做鸭子类型判断，并且校验器要用真实的错误输入经真实加载器测试，而不只用手工构造的正确输入。

## Summary

症状：`pluglet.json` 里列有上述插件时，`pluglet list`（任何命令）以未捕获的 `TypeError` 和一段 Node 堆栈退出；stderr 不提插件路径，也不说它哪里不对。一个 bug；一个机制；表面消息取决于引擎如何报告在不可调用的接收者上调用 `Function.prototype.apply`（Node 24.11 上是 `plugin.apply is not a function`；报告引用的是 `Cannot read properties of undefined (reading 'commands')`）。

## Impact

每个插件默认导出函数（或任何非对象值）的 0.1.0 用户，在该插件被配置期间无法运行任何命令，且没有可行动的诊断。没有数据丢失：崩溃发生在 `loadPlugins` 里，在任何命令运行或存储被写入之前。成本：一份质疑测试套件可信度的用户报告，加上下面记录的调查。

## Timeline

1. 0.1.0 发布的 `unwrapPlugin` 是 `const candidate = (ns.default ?? ns) as Partial<PluginModule>` 后接两个 `typeof` 探测。单元测试喂给它手工构造的对象；组合测试与 e2e 测试里唯一的插件 fixture 是良构的 `SHOUT_PLUGIN`。
2. Issue #17：用户报告崩溃，附上上面引用的插件文件，并问它怎么能带着 27 个通过的测试和 100% 覆盖率发布。
3. 调查用用户的原文件通过构建出的 bin 复现崩溃。观察到的消息（`plugin.apply is not a function`，在 `lib/plugins.js` 的 `loadPlugins` 中抛出）与报告的文本不同，一度暗示存在第二个 bug。
4. 对导入的命名空间做一次探测定案：`typeof ns.default === 'function'`、`candidate.name === 'apply'`、`candidate.apply === Function.prototype.apply`。一个接受错误，两种依赖引擎的消息文本。下面的守卫断言类型化的失败，不断言消息文本。
5. 先写守卫，在未修复的 `src/` 和未修复的构建产物 `lib/` 上观察到红；修复落地；守卫转绿，逐文件覆盖率仍为 100%。

## Root cause #1 — 对一个从未确立类别的值做鸭子类型判断

`src/plugins.ts` 的 `unwrapPlugin`：`ns.default ?? ns` 被断言为 `Partial<PluginModule>`，抹掉了"默认导出是什么"这个问题。随后 `typeof candidate.name !== 'string' || candidate.name === ''` 和 `typeof candidate.apply !== 'function'` 是仅有的检查。对于 `export default function apply(ctx) {...}`，两个探测命中的都是函数自身与 `Function.prototype` 提供的属性，于是校验通过，`loadPlugins` 调用 `plugin.apply(ctx)`，其中 `plugin.apply` 是 `Function.prototype.apply`，接收者是一个普通对象。这段代码看起来合理，因为两个探测确实表达了契约（"有 name，有 apply"）——只是表达在了错误的对象上。

## Why every test missed it

- **校验器的单元测试用的是手工构造的正确输入。** `unwrapPlugin` 被 `{ name, apply() {} }`、`{ default: { name, apply() {} } }` 和四个缺字段的对象锻炼过。没有一个案例是函数、字符串或数字，所以继承属性那条路径从未被走到。手工构造的对象承载不了插件作者真实的错误；一个带默认导出函数的模块命名空间只差一次 `import()`，却从未被导入。
- **组合测试与 e2e 测试只有一个插件 fixture。** `loadPlugins`、`runCli` 和构建产物 bin 的 e2e 全都加载 `SHOUT_PLUGIN`；失败路径的 fixture 是一个在导入时抛出的模块和一个会抛出的 `apply`。两者锻炼的都是良构模块被识别之后发生什么，而不是识别本身是否正确。
- **100% 的行与分支覆盖率全程成立。** `unwrapPlugin` 的每一行在每次运行中都执行了。覆盖率度量的是执行过的行，不是考虑过的输入；一个不存在的检查不可能表现为未覆盖的行。
- **类型断言让编译器点头。** 对 `unknown` 类型的值写 `as Partial<PluginModule>` 在 `strict` 下通过类型检查；类型系统里没有任何东西区分"带 `apply` 方法的对象"与"带继承 `apply` 方法的函数"。
- **`runCli` 把非 `PlugletError` 当作缺陷并任其传播。** 这条契约对真正的缺陷是对的，但它意味着这次误分类表现为一段关于 pluglet 自己文件的裸堆栈，而不是一份关于插件的 `plugin-invalid` 报告。

## Guardrails added

- 代码：`unwrapPlugin` 在任何字段探测之前检查 `typeof unwrapped !== 'object'`，并抛出点名路径、观察到的类型和两种被接受形状的 `PlugletError('plugin-invalid')`（[src/plugins.ts](../../src/plugins.ts)）。
- 单元守卫：`tests/plugins.spec.ts` 的 "rejects a non-object default export instead of probing its inherited properties" 喂入一个默认导出函数、一个字符串和一个数字。在未修复的代码上它以 `expected undefined to be an instance of PlugletError` 失败。
- 源码层组合守卫：`tests/cli.spec.ts` 的 "reports a default-exported function plugin as a handled plugin-invalid failure, not a defect" 用用户的文件驱动 `runCli`。在未修复的代码上它以 `TypeError: plugin.apply is not a function` 失败。
- 真实入口守卫：`tests/cli.e2e.ts` 的 "rejects a default-exported function plugin with exit 1, naming the file and the fix, with no stack trace" spawn 构建出的 `lib/bin.js`。在未修复的构建产物上它失败，因为 stderr 是一段堆栈而不是 `pluglet: plugin <path>: default export is a function...`。
- 共享 fixture：`tests/harness.ts` 里的 `DEFAULT_FUNCTION_PLUGIN` 是用户插件的原文，所以每一层加载的都是同一个真实错误。
- 规则：[防御模式"校验先判类别再探测字段"](../defensive-patterns/general.md#校验先判类别再探测字段) 与根 `AGENTS.md` 里的一行。
- 决策记录：[Agent Note：拒绝默认导出为函数的插件](../../.agents/notes/implemented/bug-fix/2026-10-23-reject-default-exported-function-plugins.md) 记录为什么拒绝而不是适配这种形状。
- 消费者契约：README 的"写一个插件"一节点名两种被接受的模块形状，以及其他一切在加载时被拒绝。

## Lessons

1. 对来自进程外部的值（模块命名空间、解析后的 JSON、CLI 参数）做鸭子类型判断之前，先断言它的类别：`typeof v === 'object'` 且不是函数。`Function.prototype` 提供 `apply`、`call`、`bind`、`name` 和 `length`，所以函数能通过对这些名字的任何探测。
2. 用作者会真实产生的错误输入、经真实加载器加载来测试校验器，而不只用手工构造的正确输入。fixture 就是用户的错误原文。
3. 校验器 100% 的覆盖率证明每个已存在的检查都跑过一次。它对不存在的检查什么也不说。负向案例枚举的是输入空间，不是代码。
4. 第三方模块加载失败必须表现为点名该模块的类型化失败。一段点名我们自己文件的裸堆栈是关于我们的报告，不是关于插件的，用户无法据此行动。
