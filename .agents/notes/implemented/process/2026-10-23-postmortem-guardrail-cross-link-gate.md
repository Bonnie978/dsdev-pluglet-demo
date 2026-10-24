# Agent Note: postmortem 与其护栏必须互链，由 `verify-postmortems` 检查

Status: implemented

## Problem

`docs/postmortem/README.md` 与 dsdev-postmortem skill 都要求 postmortem 链接它催生的护栏、护栏链回 postmortem，但没有任何东西执行这条规则（Issue #41）。`## Guardrails added` 只在散文里点名测试的 postmortem，或悄悄丢掉 postmortem 链接的规则行，都能通过 `verify-postmortems`。把规则做成 gate 迫使决定回链这一半要多严：每个护栏、仓库里任意文件，还是介于两者之间。

## Decision

`verify-postmortems` 对每个 `docs/postmortem/NNNN-*.md` 执行两项检查：

- 正向：`## Guardrails added` 一节至少含一个解析到仓库内常规文件的相对 Markdown 链接。围栏代码块内的链接、图片链接、URL 与绝对路径不算；无法解析的链接是独立的违规，点名所在行。
- 回链：有界候选集中至少一个文件用相对 Markdown 链接链回该 postmortem。候选集是护栏目标中的 Markdown 文件，加上两个常备规则的家：根 `AGENTS.md` 与每个 `docs/defensive-patterns/*.md`。失败消息列出该集合，所以修复是在一个点名的文件里做一处编辑。

非 Markdown 的护栏（测试、源码）是合法的正向目标，但永不被搜索回链。规则的家是 `docs/postmortem/README.md § 护栏互链`；`tests/verify-postmortems.spec.ts` 通过真实 runner 对临时 fixture 驱动该 gate，并钉住每个被拒案例。

## Alternatives considered

- **每个护栏都必须链回。** 否决。一半的护栏是测试和源码文件，无法承载 Markdown 链接；满足它的唯一方式是在每个文件里加一条 `// see docs/postmortem/…` 注释，而根 `AGENTS.md` 要求注释陈述契约而不是理由。它还会把每个带有纯代码护栏的 postmortem 变成永久违规。
- **仓库里任意文件都可以链回。** 否决。一篇无关 cookbook 的提及，或 postmortem README 表格本身，都能满足它，这检查的是文件可达，而不是某个护栏拥有这个指针。有界集合把回链留在评审者预期能找到的地方。
- **把测试或源码文件里对 postmortem 路径的纯文本提及算作回链。** 否决。这会让检查依赖注释文本，鼓励文档标准禁止的理由注释，并在 `verify-md-links` 看不到该引用时静默失效。只检查 Markdown 链接，所以满足这个 gate 的链接就是 `verify-md-links` 持续保证能解析的那一个。
- **放在 `docs/defensive-patterns/` 里的 review 规则而不是 gate。** 否决。两半都可由脚本判定；gate 写法 skill 把可判定的规则路由到 gate，把 review 留给判断题。

## Consequences

- 带纯散文护栏或丢失引用的规则行的 postmortem 无法合并；诊断点名文件、失效链接所在行，以及缺少回链时的候选文件。
- 只添加代码护栏的作者还必须在 `AGENTS.md` 或某条防御模式里加上带回链的规则行，这是 postmortem skill 本来就要求的。
- `verify-postmortems` 接受 `--root <dir>` 让它的 spec 能对 fixture 运行；默认仍是本仓库，gate 保持只读。
