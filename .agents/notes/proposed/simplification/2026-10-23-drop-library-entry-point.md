# Agent Note: 删除库入口点

Status: proposed

## Problem

`src/index.ts` 把每个模块重新导出为"插件作者或嵌入者导入的公开 API"，`package.json` 把 `main`、`types` 和 `files` 指向它的构建产物，`tests/index.spec.ts` 钉住导出列表。没有任何东西消费这个面：包是 `private: true` 且没有远端，所以从未被安装；`src/bin.ts` 直接导入 `./cli.ts`；插件通过 `ctx` 接收 registry 和 store，什么都不导入（README"写一个插件"）；仓库里 `src/index.ts` 的唯一导入者是它自己的契约测试（`rg "index\.ts|from 'pluglet'"` 找到 `package.json:main` 和 `tests/index.spec.ts`）。这个面仍在被维护：JSDoc gate 检查它，覆盖率 gate 统计它，每当模块新增或重命名导出都必须编辑导出列表测试。

## Proposal

删除 `src/index.ts` 和 `tests/index.spec.ts`。从 `package.json` 移除 `main`、`types` 和 `files`，只留 `bin` 作为包声明的唯一入口。`lib/bin.js` 仍是 e2e 层 spawn 的真实入口路径；没有模块增加或失去导出。

## Alternatives considered

- **保留入口点作为文档化的嵌入 API。** 暂时否决：一个零消费者的 API 正是本 note 要移除的义务。有嵌入者出现时再重新引入该模块，以那个嵌入者的导入列表作为契约测试，让测试钉住一个真实的消费者而不是猜测。
- **保留 `src/index.ts` 但删掉 `tests/index.spec.ts`。** 否决：契约测试是唯一给这个重导出文件一份工作的东西；没有它，该文件复制每个模块的导出列表却没有任何东西检查这份副本。
- **让包可发布（去掉 `private: true`）以便这个面有消费者。** 否决：pluglet 是 dsdev 方法的试验台（README），不是库；发布是产品决策，不是 simplification。

## Acceptance criteria

- `src/index.ts` 和 `tests/index.spec.ts` 已不存在；`package.json` 声明 `bin`，没有 `main`、`types` 或 `files`。
- `pnpm test`、`pnpm run test:coverage`（剩余 `src/` 文件的逐文件 100% 仍成立）、`pnpm run hygiene`、`pnpm run test:docs` 和 `pnpm run test:e2e` 为绿。
- `docs/architecture.md` 和 `README.md` 不需要编辑，因为两者都没有记载库入口；PR 说明做过这项检查。

## Risks

- 树外导入 `pluglet` 的嵌入者会被破坏。上面的证据说不存在这样的嵌入者；若在落地前出现一个，本提案撤回，该嵌入者的导入成为契约测试。
- 包随后没有 TypeScript 声明入口。这只对嵌入者是损失，而嵌入者正是本 note 认定不存在的消费者。
