# 上游同步审查检查点（2026-06-09）

## 背景

本轮同步目标是吸收 `ExplosiveCoderflome/AI-Novel-Writing-Assistant` 的有价值更新，同时保留本地已经形成的账号、模型、充值、桌面发布和正式部署能力。当前策略仍然是“本地版本为主，按提交审查，分阶段移植”，不直接 merge 上游主干。

## 已完成的安全移植

- `aa7bc166 refactor(novel): route core chapter generation through orchestrator` 已按本地结构移植为 `20691543 fix: route legacy chapter generation through orchestrator`。手动章节生成、旧 Core 兼容入口和批量执行会进入统一 `chapter_execution` 生产阶段，减少不同入口的生成策略分裂。
- `ba6715f5 Scope chapter state commit to the active chapter range` 已移植，当前执行范围外的旧章节不会拖住本轮章节状态提交。
- `c109a6ac perf(app): lighten first-screen API loading` 的服务端轻量读路径已按本地任务和自动导演结构移植。
- `13aac0e2 perf(chapter-runtime): cache quality gates across restarts` 的可独立部分已移植为章节接收闸门成功结果缓存，没有同步上游完整 timeline finalization 拆分。
- 自动导演灵感推荐、章节失败原因展示、自动审校跳过事实、模型设置轻量读取等小修复已在前序提交中按本地结构移植。

## 需要单独设计阶段的上游候选

### `db0105ea feat(world): add book world generation workflow`

该提交涉及约 150 个文件、多个 Prisma 迁移、世界实例、世界资产、世界上下文网关、世界页面重构和自动导演 setup 链路。它可能对新手开书有价值，但不能直接合入。进入开发前需要：

- 备份并验证数据库；
- 明确本地商业化页面、模型路由和桌面端不被覆盖；
- 设计本地“世界观生成”与现有 `NovelWorldSliceService`、RAG、自动导演 setup 的关系；
- 单独跑迁移、服务端构建、客户端类型检查和开书流程测试。

### `e80f66fc feat(image): add novel cover generation workflow`

该提交新增封面生成工作流、图片提示支持、图片路由、服务端配置和 Prisma 字段。功能有商业价值，但涉及图片供应商、计费、数据库字段和小说基础信息页，不能作为普通 UI 小改同步。应在图片商业化和模型成本策略确认后单独做。

### `956a8f02` / `cf5f30a6` / `c7031e95` timeline 与章节运行时链路

这些提交引入 timeline constraint layer、timeline repository、timeline finalization、repair runtime 拆分和大量章节运行时状态调整。它们依赖上游较新的 `server/src/modules/timeline` 和运行时拆分结构，本地当前仍保留较多 monolithic runtime。同步前应先做章节运行时架构迁移计划，不能把 migrations 和 runtime split 夹在普通 bug fix 中。

### `addd80cd feat(chapter): add future dynamics sidebar`

该提交主要是前端章节侧栏，但读取的数据来自 timeline、角色动态、资源风险等后端投影。可以作为后续体验优化候选，但应等待本地 timeline/资源投影边界稳定，或先设计本地适配数据源。

### `1450fe1b feat: harden character facts and chapter titles`

该提交强化角色硬事实和章节标题，但包含 Prisma 字段、Prompt、章节上下文、角色准备和标题多样性策略。可以拆出 prompt/schema 或标题策略的小块继续审查；涉及 schema 的部分必须走迁移设计。

## 当前结论

截至本检查点，继续同步时应优先挑选不含迁移、可独立验证、不会覆盖本地商业能力的修复。世界观、封面、timeline constraint 和章节运行时 finalization 均应拆成单独功能阶段，不应直接 merge 或 cherry-pick。
