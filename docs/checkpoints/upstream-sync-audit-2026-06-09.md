# 上游同步审查检查点（2026-06-09）

## 背景

本轮同步目标是吸收 `ExplosiveCoderflome/AI-Novel-Writing-Assistant` 的有价值更新，同时保留本地已经形成的账号、模型、充值、桌面发布和正式部署能力。当前策略仍然是“本地版本为主，按提交审查，分阶段移植”，不直接 merge 上游主干。

## 已完成的安全移植

- `aa7bc166 refactor(novel): route core chapter generation through orchestrator` 已按本地结构移植为 `20691543 fix: route legacy chapter generation through orchestrator`。手动章节生成、旧 Core 兼容入口和批量执行会进入统一 `chapter_execution` 生产阶段，减少不同入口的生成策略分裂。
- `ba6715f5 Scope chapter state commit to the active chapter range` 已移植，当前执行范围外的旧章节不会拖住本轮章节状态提交。
- `c109a6ac perf(app): lighten first-screen API loading` 的服务端轻量读路径已按本地任务和自动导演结构移植。
- `13aac0e2 perf(chapter-runtime): cache quality gates across restarts` 的可独立部分已移植为章节接收闸门成功结果缓存，没有同步上游完整 timeline finalization 拆分。
- 自动导演灵感推荐、章节失败原因展示、自动审校跳过事实、模型设置轻量读取等小修复已在前序提交中按本地结构移植。
- `377ac9ca fix(settings): persist current llm selection` 已覆盖。本地已有 `LLMSelectionSettingsService`、`/api/settings/llm-selection`、`LLMSelectionBootstrap` 和后台模型页同步逻辑。
- `7ddf6e53 fix knowledge archive restore flow` 已覆盖。本地知识库归档恢复会重新排队 RAG rebuild，并有 `knowledgeServiceStatus.test.js` 覆盖归档、恢复和删除任务状态。
- `0f747791 fix(novel): stop repeated chapter repair refreshes` 已覆盖。本地已有自动导演质量循环修复模式升级、已有正文不重复保存为 draft 的 pipeline 测试。
- `2c2da6da fix(director): run explicit chapter resume after outline sync` 已覆盖。本地 pipeline runtime 已在显式章节执行恢复时继续进入章节执行节点，并有 `novelDirectorPipelineRuntime.test.js` 覆盖。
- `e8b675dd fix(chapter-runtime): guard empty chapter drafts` 已覆盖。本地已有 `chapterEmptyContentError`、空正文重试、pipeline 失败记录和相关测试。
- `1d213044 feat(server): base novel progress on facts` 已覆盖。本地 `NovelProductionStatusService` 已以 `progressBasis: "facts"` 返回生产进度，并通过 `novelProductionStatus.test.js` 覆盖成功任务、失败任务和交付就绪事实。
- `08e6e89f` / `5f85c965` 的 5 条灵感和横向展示已覆盖。本地 `IdeaInspirationPanel` 已显示 5 条横向灵感卡片。
- `3a1dd38e fix(client): add chapter preview copy action`、`dee777ed fix(client): improve toast close button visibility`、`32d80bb4 feat(characters): highlight protagonist in asset workspace` 已覆盖。本地预览页支持复制章节正文，toast 关闭按钮可见，角色资产工作台已突出主角并拆出侧栏与摘要组件。
- `58dd6930` / `ef57c022` / `5f5aee36` / `4c1dc8ec` / `24cfdbf7` 的反 AI 规则中心、AI 起草、效果测试、改写提示强化和正文生成后审查开关已覆盖。本地已有 `AntiAiRulesPage` 及拆分组件、`AntiAiRuleService`、`AntiAiPolicyResolver`、预览规则注入、Prompt Registry 中的 `style.anti_ai_rule.draft@v1`，以及 `PostGenerationStyleReviewRunner` 和小说基础信息中的生成后审查开关。
- 反 AI 组与上游对比后，本地相关 style-engine 文件没有缺失的上游差异；唯一差异是本地 `server/src/prompting/registry.ts` 额外保留了章节接收评估、章节产物增量提取和自动导演灵感提示注册，属于本地已移植能力，不应为贴近上游而移除。
- `e3869abc fix(prompting): reduce chapter structured output repair drift` 已覆盖。本地已有章节接收、章节产物增量和 timeline 抽取的结构化输出别名归一化，repair 日志会记录 `schemaPaths`，并提供 `scripts/summarize-llm-repair-log.cjs` 供诊断 repair 高发 schema path。
- `f056815b fix(director): prevent payoff replan false stops` 已覆盖。本地章节生产链规则已经明确 `urgentPayoffs`、`ledgerSummary.urgentCount` 和 `nextAction=advance_payoff` 只能作为写作职责信号，不能在生成后单独触发重规划；`replanDecision.test.js` 也覆盖了紧急 payoff 不误停和无明确窗口的逾期 payoff 降级。
- `fedd0b30 fix(director): scope chapter quality facts` 已覆盖。本地章节审校、修复和状态提交事实读取会按当前自动执行范围计算，`ChapterExecutionProgressInspector` 已把可继续的质量债务视为可提交状态，避免旧章节质量事实拖住当前范围。
- `21e970a4 perf(director): enforce chapter token budget` / `c0f0c57e fix(director): correct chapter budget scope and raise token threshold` 已覆盖。本地已有自动导演 token 预算 wiki，单章阈值为 `80_000`，`getLargestChapterUsage` 在存在 `taskIds` 时使用严格 task-only 查询，避免把历史取消或失败任务的用量算进当前章节预算。
- `ec7cc4e5 fix(chapter-runtime): prevent duplicate extraction budget stops` 已覆盖。本地后台章节资产同步会在抽取前写入 `running` 抢占 checkpoint，成功后标记完成，失败时标记 `failed`，并通过过期窗口释放陈旧运行记录，避免重复抽取导致预算误停。
- `eb24ff9c perf(chapter-runtime): defer timeline extraction` 的热路径降负目标已按本地 monolithic runtime 结构覆盖：章节协调器通过 deferred artifact/background sync 避免把资产回灌压在正文热路径上。上游拆分出的 `ChapterContentFinalizationService` / `ChapterQualityGateService` 文件不在本地结构中，不能按文件级别照搬。
- `890ff636 refactor(export): split novel export module` / `ea3c982d test(export): cover module entrypoint` 已按本地结构移植。保留 `server/src/services/novel/NovelExportService.ts` 作为兼容入口，将 TXT/文件名/Markdown 格式化移动到 `export/novelExportFormatting.ts`，将 DTO 映射和角色时间线分组移动到 `export/novelExportMappers.ts`，避免直接套用上游 `server/src/modules/export` 路径导致本地服务边界大范围变动。
- `578b128d fix(character): forward model settings for visible profiles` 已覆盖。本地角色候选方案应用接口会从前端传递 `provider`、`model`、`temperature`，服务端 `novelCharacterPreparationRoutes` 会将其写入 `visibleProfileGeneration`，并由 `CharacterPreparationService` 传给可见档案生成流程；本地此前已有 `075b72ab fix: forward director model settings to character profiles`。
- `d194a96a fix(director): ignore manual tasks in takeover entry` 已覆盖。本地 `resolveTakeoverDialogContextTaskId` 会过滤手动工作台任务，`novelEditAutomationStatus.test.mjs` 已覆盖接管弹窗上下文不使用手动任务 id，`NovelEdit.tsx` 也通过该 helper 决定接管入口任务。
- `ecd5869c fix(director): keep title warnings from overriding live progress` 已覆盖。本地自动导演进度面板通过 `directorTaskSnapshot` 读取 `dashboardView`，运行中或队列中的任务会抑制章节标题警告，避免旧标题修复提示覆盖实时进度；`novelAutoDirectorProgressPanelQueryKeys.test.mjs` 已覆盖 snapshot 查询、dashboard view 使用和标题警告抑制。
- `33449f3a fix(director): route book automation through dashboard view`、`462caa44 fix(director): unify dashboard projection state`、`d520ed0d fix(director): keep live progress out of waiting state`、`374eca47 fix(director): stabilize progress snapshot cache` 已按本地结构覆盖。本地 `DirectorDashboardViewBuilder` 统一构建 dashboard view，书籍自动化投影、任务快照、任务中心、小说编辑页、工作区侧栏和任务抽屉均消费该投影；`directorBookAutomationProjection.test.js` 已覆盖 running、queued、waiting gate、旧 runtime snapshot 与陈旧 command 的组合状态，客户端侧也通过 snapshot query key 测试固定进度面板读取路径。
- `7a758029 fix: chapter_detail_bundle validateOutput 在 JIT 模式下误报未完成` 已按本地结构移植。全书自动接管下，结构化大纲阶段允许在卷拆章列表已就绪时把章节任务单细化延后到章节执行前自动生成，避免 `chapterDetailReady=false` 误触发 `volume.chapter_detail_bundle.generate` 校验失败；本地新增 `directorWorkflowStepModules.test.js` 覆盖该场景，并把面向用户的进度文案改为“章节任务单将在章节执行前自动生成”。
- `5f8680ff feat(logging): add log retention cleanup` 已按本地结构移植。服务端启动会异步清理旧文件日志，桌面端启动会清理桌面日志目录，LLM 调试日志和桌面主日志会在超过大小阈值时轮转；清理范围限定为 `.log`、`.meta.json`、`.llm.jsonl`、`.llm-repair.jsonl`，不会触碰数据库、小说数据、图片、备份或未知后缀文件。上游 `scripts/run-with-log.cjs` 的参数扩展未在本阶段同步，避免把未验证的开发脚本行为混入运行时日志清理。

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

该提交主要是前端章节侧栏，但读取的数据来自 timeline、角色动态、资源风险等后端投影。当前本地已有部分 timeline shared 类型，但尚未接通 `getChapterTimeline` 客户端 API、查询 key 和章节页数据装配；直接复制侧栏会造成编译失败或空数据。可以作为后续体验优化候选，但应等待本地 timeline/资源投影边界稳定，或先设计本地适配数据源。

### `1450fe1b feat: harden character facts and chapter titles`

该提交强化角色硬事实和章节标题，但包含 Prisma 字段、Prompt、章节上下文、角色准备和标题多样性策略。可以拆出 prompt/schema 或标题策略的小块继续审查；涉及 schema 的部分必须走迁移设计。

### 桌面发布、README 状态和上游版本号提交

`dea07265`、`b0dd3ff7`、`d6725d27`、`4ba82892` 这类提交不应按上游直接同步。它们主要调整上游 README、上游桌面版本号和 GitHub Release workflow。当前本地桌面发布通道已经指向 `CDYYY98/AI-`，产品名是 `图灵网文工作台`，`desktop/package.json` 版本由本地正式发布节奏控制；同步上游 owner/repo、默认产品名或版本号会破坏本地客户端自动更新和品牌配置。后续只可按需吸收通用 workflow 技术点，例如 Node 24 或打包校验步骤，不能同步上游发布身份。

## 当前结论

截至本检查点，继续同步时应优先挑选不含迁移、可独立验证、不会覆盖本地商业能力的修复。世界观、封面、timeline constraint 和章节运行时 finalization 均应拆成单独功能阶段，不应直接 merge 或 cherry-pick。
