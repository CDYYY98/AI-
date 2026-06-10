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
- `552a534c fix: speed up character cast application` 已覆盖。本地角色阵容应用 route 会传入 `postApplyMode: "background"`，核心角色、关系和阵容状态同步完成后先返回，角色动态和外显资料在后台补齐；前端 `CharacterCastOptionsSection` 已提示“外显资料和角色动态会在后台补齐”，`auto-director-runtime.md` 也记录了核心落库与增强补齐的边界。
- `c31513c1 fix(director): align cockpit progress labels` 已覆盖。本地书级自动化投影会优先使用 `dashboardView.currentAction` / runtime projection `currentLabel` / worker label，再兜底到 task label，避免把“正在自动审校第 N 章”覆盖成通用的“执行章节生成批次”；`directorBookAutomationProjection.test.js` 已覆盖 runtime chapter label 优先于 generic task label。
- `5c11f1ae fix(novel): harden chapter patch repair fallback` 已覆盖。本地 patch repair prompt 已要求 `targetExcerpt` 必须是可唯一定位的完整句段，`ChapterPatchRepairService` 会把 apply 阶段的短片段、歧义片段或无效补丁转换为可恢复失败，章节 pipeline 对 `acceptance_gate_unavailable` 这类非正文片段风险会保留正文并登记复查债务，不调用局部 patch 或整章重写；`chapterPatchRepair.test.js` 和 `chapterRuntimePipeline.test.js` 均已有对应覆盖。
- `0b02eece refactor(events): queue novel side effects` 已覆盖。本地已经存在 `server/src/events/sideEffects/`、`NovelSideEffectJob` Prisma 模型、`novelSideEffectWorker` 启停、事件处理器入队逻辑和 `eventSideEffects.test.js`，章节生成、卷规划保存和 pipeline 完成后的隐藏副作用不会再压在同步热路径上。
- `c6a6bf11 feat(novel-gen): add quality guards for world pollution, milestone repeat, scene pattern, and volume pacing` 已同步低风险 Prompt/context 部分。本地新增 `completedMilestones`、`recentScenePatterns`、`keyMilestoneGuards` 共享类型字段，写章上下文会渲染已完成目标、场景模式黑名单和卷级关键节点守卫，writer prompt 也会禁止重复追求这些目标或复用场景模式；世界切片 prompt 增加不匹配专有名词污染防护。上游 `audit_chapter_continuity` 固定关键词扫描工具和 `rebuild_story_world_slice` agent 工具未直接同步，后续需按 AI-first 与本地世界观流程另行设计。
- `f1d22fb6 feat(phase0): 质量债务根因归因埋点 + analyze_quality_debt_attribution 工具` 已按本地结构同步。章节 runtime 会在最终未通过时记录首次/二次失败 issue code、patch 锚点失配、计划错位、同义务重复失败和长度/内容漂移等归因，质量闭环会把归因写入 `chapter.riskFlags.qualityLoop.qualityDebtAttribution`，并新增只读 `analyze_quality_debt_attribution` 工具用于汇总 deferred quality debt。同步时未引入上游 `audit_chapter_continuity` 固定关键词扫描工具，工具选择仍保持由本地 AI planner 决定，确定性代码只聚合已记录事实。
- `0d1e4d84 ci(desktop): 升级 release workflow actions 到 node24-native 版本` 已按本地桌面发布通道同步通用技术点。正式和 beta 桌面 release workflow 仅升级 `actions/checkout@v5`、`actions/setup-node@v5`、`actions/setup-python@v6`，保留本地 `CDYYY98/AI-` 发布仓库、`图灵网文工作台` 产品身份、Node 24 构建环境和现有发布脚本；未同步上游桌面版本号、README 状态或 release tag 身份。
- `d2ef4d20 feat(fact-ledger): 桥接正文即兴事实到账本，修复跨章设定漂移` 已同步低风险摘要硬事实部分。章节摘要 Prompt 与 schema 会抽取 `concreteFacts`，本地 `NovelChapterSummaryService` 会把这些正文硬事实优先合入 `ChapterSummary.keyEvents`，让现有摘要、RAG 和后续上下文先获得连续性收益。未同步上游 `NovelFactService`、Fact Ledger 表结构和定稿热路径接入，避免未经迁移设计就改动数据库和章节运行链。
- `69adf8dd fix(director): pause character setup at review gate` 已覆盖。本地自动导演 runtime wiki 已明确 `character_setup_required` 是可恢复检查点，任务中心、小说工作区和自动导演进度面板均会显示“角色准备待审核”，服务端任务解释也会提示先审核角色阵容后继续；不会再因为正式角色数为 0 就把已有候选的角色准备阶段误判为失败。
- `2a3c7e0b fix(fact-ledger): filter accepted facts by obligation coverage` 已审查 beta 候选。本地尚未同步完整 Fact Ledger 表与定稿服务，因此不直接移植上游 `factLedgerFilter`；但本地轻量摘要硬事实规则已经只从“正文已经写明”的内容抽取 `concreteFacts`，不会把写前计划、章节义务或伏笔指令直接记成已发生事实。完整验收覆盖过滤仍归入后续 Fact Ledger 迁移阶段。
- `0e1af1b0 fix(director): bind quality debt to source chapter` 已覆盖。本地自动执行状态会保留 `qualityDebtChapterIds`、`qualityDebtChapterOrders` 和 `qualityDebtSummaries`，后续章节范围恢复时会按源章节绑定质量债务，不会把空白章节或非当前源章节误计入跳过质量债务。
- `d400a9d5 feat(prompting): track runner quality telemetry` 已覆盖。本地 `promptQualityTelemetry` 会按 prompt id/version、任务类型、模型、stage 和 entrypoint 聚合完成率、失败类型、repair 次数、semantic retry 次数、空输出、输出长度、耗时和 token 使用；Prompt Registry wiki 和 `prompting.test.js` 已覆盖结构化、文本、流式与失败路径。
- `6bc1e49a fix(director): ignore generating hint without draft` 与 `e93d4766 fix(director): derive chapter readiness from facts` 已覆盖。本地 `ChapterExecutionProgressInspector` 只把 `chapterStatus=generating` 视为 draft started，不会在没有正文时算作 draft saved；章节准备、审校、修复和状态提交均由事实矩阵推导，并有 `directorChapterExecutionProgress.test.js`、`directorTaskFactInspection.test.js` 和 `directorWorkflowStepModules.test.js` 覆盖。
- `286d7c73 fix(novel): stabilize chapter closure and recovery polling` 已覆盖。本地 `ChapterRuntimeCoordinator` 在阻塞章节时不会长期停留在 generating，pipeline payload 与恢复轮询测试覆盖了章节关闭、状态回写和恢复提示。
- `07a3e7a7 fix(director): honor disabled auto review facts` 已覆盖。本地执行事实检查会读取 auto execution plan 中的 `autoReview=false`，在自动审校关闭时把已生成正文视为审校跳过，而不是要求不存在的 audit facts。
- `d8db4ab4 feat: allow skipping quality repair gate` 已覆盖。本地 continuation mode 支持 `skip_quality_repair`，小说页、任务中心和继续 runtime 会把该操作传入自动执行恢复，允许用户确认后跳过当前低风险质量修复门。
- `17031585 fix(director): preserve chapter repair obligation context` 与 `545d67f7 fix(director): classify chapter obligation failures` 已覆盖。本地章节接收、写章和修复上下文会保留 obligation contract、coverage 和 blocking obligations，质量循环会区分 `draft_obligation_unmet`、`draft_repair_exhausted`、`replan_required` 等根因，并在投影里展示阻断义务。
- `27817874 fix(director): route replan checkpoints to repair`、`1d108102 fix(director): continue quality-alerted chapter ranges`、`34ce9a87 fix(director): preserve chapter execution resume approval` 已覆盖。本地 `replan_required` 检查点会进入 `quality_repair` 恢复路径，低风险质量提示章节范围可以在用户/全书自动执行确认后继续，章节执行恢复会保留 `approveAutoExecutionScope`，避免已确认的执行范围再次卡在同一门控。
- `fe36eaa7 fix(novel): normalize chapter structured outputs` 已覆盖并扩展。本地章节接收 schema 已归一化 `blockingIssues.category`、`repairDirectives.mode/target` 和 `missingObligations` 常见别名，章节资产 delta schema 已归一化角色资源类型/状态/用途、payoff 状态/风险信号、关系动态和候选角色字段；Prompt 文案也约束模型只输出合同字段。
- `56d099d4 Stop treating urgent payoff as replan failure` 已覆盖。本地 `ReplanSignal` 不包含 `urgent_payoff`，`advance_payoff`、`urgentPayoffs` 和 `urgentCount` 只作为生成职责信号；只有逾期 payoff、显式 `nextAction=replan`、阻塞审计或人工请求才会触发重规划。
- `ddbb22ee fix(novel): recover from invalid chapter patch repairs` 已覆盖并增强。本地 `ChapterPatchRepairService` 会把结构化 prompt 校验失败和 patch apply 异常转换成 `ChapterPatchRepairFailedError`，`replacement` 允许为空以删除唯一片段，章节生产链 wiki 已明确无效局部补丁应升级为可恢复失败而不是原始 Zod 错误。
- `1616a0c7 fix(director): stabilize retry recovery and task targeting` 已按本地结构覆盖主要目标。本地已有 `novelWorkflowAutoDirectorReconciliation`、自动执行 pipeline 状态同步、retry 后强制自动导演恢复测试、前端以具体 director task 作为继续/重试/质量修复 action target，以及独立的 auto-director follow-up 查询 key/API；未同步其中的上游桌面版本号和页面命名整理。
- `71587ed1 docs: update agent workflow rules`、`79deed79 docs(architecture): add server split governance` 已被本地 `AGENTS.md` 和项目 wiki 规则覆盖。本地规则更细，额外包含数据保护、AI-first、分支、beta、桌面发布和 release note 工作流，不应被上游较短规则覆盖。
- `8c63e26e docs: add project wiki and archive stale docs`、`e8efdadf docs: remove garbled archived auto-director docs` 已覆盖。本地 `docs/wiki/` 已建立 architecture/debugging/product/prompts/rag/workflows 目录，旧的 garbled auto-director 归档文件当前不存在；本地还新增了商业化、桌面更新、模型选择和上游同步保留策略等本地专属 wiki。
- `4f171a53 refactor(director): remove runtime queue helper leftovers` 已覆盖。本地已移除 `DirectorRuntimeExecutionHelpers.ts`，保留 `DirectorCommandServiceHelpers.ts` 作为命令服务 helper；不需要再按上游路径做删除。
- `b7f6f509 refactor(director): group auto execution modules`、`4e13be17 refactor(director): split workflow step modules`、`b023ffeb feat(director): centralize workflow step catalog` 已覆盖。本地已使用 `server/src/services/novel/director/automation/`、`workflowStepRuntime/` 拆分模块、`WorkflowStepModuleRegistry` 和 shared `directorWorkflowStepCatalog`，并有 `directorWorkflowStepModules.test.js`、`directorWorkflowStepCatalog.test.js` 覆盖模块注册和目录入口。
- `348432c4 test: verify streamlined chapter pipeline status` 已覆盖。本地已有章节 runtime、pipeline job state 和前端章节执行状态展示调整，相关测试覆盖章节 runtime coordinator、pipeline 状态、任务活动标签和自动导演状态投影。
- `6368025a feat: add artifact sync modes and checkpoints`、`24b266de feat: unify chapter artifact delta sync`、`ca6c6f3c feat: add lightweight chapter acceptance gate`、`a5529ff6 feat: constrain chapter repair loop from acceptance gate` 已覆盖并扩展。本地已有 `ChapterArtifactSyncCheckpoint`、`ChapterArtifactBackgroundSyncService`、`ChapterArtifactDeltaService`、`ChapterAcceptanceGateCacheService`、`ChapterAcceptanceAssessmentService` 和非 patchable `acceptance_gate_unavailable` 处理；`chapterAcceptanceGateCacheService.test.js`、`chapterRuntimePipeline.test.js`、`chapterStructuredOutputNormalization.test.js` 以及章节生产链 wiki 覆盖了缓存、抽取、接收闸门和修复边界。
- `afb49825 docs: plan chapter output pipeline optimization` 的稳定结论已吸收到本地章节生产链和上游同步策略 wiki。当前不再同步上游临时 plan 文档，避免把已经实现或被本地结构替代的计划重新当作待办。
- `de0f5b11 Fix scene chapter length budget enforcement` 与 `1426a4fa feat(runtime): harden chapter execution contracts` 已按本地结构覆盖。本地使用 `shared/types/chapterLengthControl.ts`、`ChapterExecutionContractService`、`GenerationContextAssembler`、章节接收闸门和 `chapterLengthControl.test.js` / `generationContextAssembler.test.js` / `chapterLayeredContext.test.js` 保持目标字数、场景卡和结构义务一致。
- `4c6ab42b fix(director): rerun candidate refinement commands` 已覆盖。本地候选方向命令支持 `refine_candidates`、`patch_candidate`、`refine_titles`，候选 runtime 会对重跑命令设置 `reuseCompletedStep: false`，`novelDirectorCandidateRuntime.test.js` 和 `novelDirectorRuntimeOrchestrator.test.js` 覆盖强制重跑已完成节点。
- `df5c9c72 fix: sync chapter details incrementally` 已覆盖。本地 `VolumeChapterSyncService` 会通过 `VolumeChapterPlan.chapterId` 保持规划章节和执行章节身份链接，增量同步 `targetWordCount`、`taskSheet`、`sceneCards` 等执行资产，`chapter-identity-and-planning-boundary.md` 记录了不能只靠标题/序号匹配的边界。
- `ac903737 fix: soften chapter title diversity failures`、`a5cd3616 修复章节列表结构化输出兼容` 已覆盖。本地章节列表 prompt、`volumeGenerationSchemas` 和标题多样性检测会把重复标题结构降级为可修复警告/待修复检查点，结构化输出 schema 已支持中文字段和常见别名。
- `02ebeffa feat: complete character visible profiles`、`fadcb567 feat: add guidance for character profile completion`、`8bc28ddf fix: surface character profile completion preview`、`27f05913 fix: allow guided character profile overwrites` 已覆盖。本地已有外显资料生成/批量生成/预览确认/显式覆盖写入接口、角色资产工作区展示和 `characterVisibleProfile.test.js`；角色阵容应用后还会后台补齐外显资料与角色动态。
- `eb405602 fix(novel): resync character resources after content changes` 已按本地事件副作用体系覆盖。本地 `chapter:updated` / `chapter:drafted` 事件会驱动章节草稿角色同步，`event-side-effect-boundaries.md` 规定同一章节正文 hash 相同才复用同步任务，正文或更新时间变化必须生成新同步任务。
- `8e7eedee 修复自动导演运行态误显示继续`、`8e240cf1 修复自动导演步骤内容刷新`、`d8f6d2a4 优化自动导演方案确认弹窗` 已覆盖。本地自动导演页面优先读取 `DirectorDashboardView`，运行/排队状态不会被章节标题提醒或旧投影覆盖成“等待继续”；候选方案确认弹窗已拆出独立 candidate dialog 和候选 mutation hook。
- `162b47e0 test: split fast and integration suites` 已覆盖。本地 `server/scripts/run-tests.cjs` 支持 `fast`、`integration`、`all`，`server/package.json` 将默认 `test` 指向 fast 套件，并保留 `test:integration` / `test:all`，适合后续同步阶段做更窄验证。
- `97ba2bb6 chore: ignore local trae workspace` 已覆盖。本地 `.gitignore` 已包含 `.trae/`，不会把本地编辑器/工作区产物带入提交。
- `bfa8fbba fix(novel): improve director progress and chapter cleanup` 已按本地结构覆盖。本地 `NovelWorkspaceRail`、小说页和任务中心都读取 `dashboardView`/snapshot 投影，章节删除会清理 `chapter` 和 `chapter_summary` RAG 索引，章节结构卡也提供未匹配章节清理入口；未同步其中上游 README 与桌面版本号。
- `0de50aee fix(client): unify dialog layout and recovery prompt` 已覆盖。本地 `client/src/components/ui/dialog.tsx` 提供 `AppDialogContent`，任务恢复弹窗、角色/知识库/设置等对话框已使用统一布局；恢复弹窗明确提示系统不会自动继续中断任务，需用户确认。
- `2ef07ebf feat: add prompt management workbench`、`3554d206 fix: constrain prompt workbench scrolling`、`d458c88a feat: add prompt material export layer` 已覆盖。本地已有管理员 Prompt 工作台路由、Prompt 目录/预览、材料导出、滚动约束和 `novelPromptMaterials.test.js` / `promptWorkbench.test.js`，并保持 Prompt Registry 作为产品级 Prompt 入口。
- `b132d05a feat: add prompt addendum management`、`3d193a9f fix: prioritize addendum prompts in catalog`、`b48b1511 fix: group novel addendum selector`、`bc730738 fix: clarify prompt addendum availability` 已覆盖。本地已存在 `PromptAddendum` Prisma 表和迁移、`PromptAddendumService`、前端 `PromptAddendumPanel`、支持/不支持提示、全局与单书补充词分组，以及 runner 注入测试。
- `35ecd273 feat(dev): show startup gate while server boots` 已覆盖。本地 `ServerStartupGate` 包裹客户端入口，桌面端还保留 `DesktopBootstrapShell` 和本地服务启动状态文案，用于避免服务启动期间白屏。
- `73f31938 chore(desktop): add github release trigger`、`bf4c9efd ci(desktop): reuse staged app during release packaging`、`140316b3 ci(desktop): sync release notes to GitHub releases` 已按本地发布身份覆盖。本地已有 `scripts/trigger-desktop-release.cjs`、`scripts/update-desktop-release-notes.cjs`、`publish:desktop:*:reuse-stage` 脚本和 GitHub Release notes 同步；workflow 保留 `CDYYY98/AI-`、`图灵网文工作台` 和本地版本/标签规则，不同步上游 owner、README 状态或桌面版本号。
- `8592a7cc fix(director): resume candidate step runners` 已覆盖。本地 `novelDirectorRetry.test.js` 覆盖候选阶段任务从 `candidate_selection_required` 恢复，`novelDirectorCandidateRuntime` 会按候选阶段 checkpoint 重新进入对应 runner。
- `e0cf29f5 Fix projection artifact completion checks` 已覆盖。本地 `novelDirectorRuntimeOrchestrator` 在后台投影步骤会轮询 `module.inspectCompletion`，直到投影事实完成或超时，避免只看即时产物导致误判。
- `45ead551 Fix scoped chapter execution completion` 已覆盖。本地章节草稿、审校、修复和状态提交模块都通过 active auto execution range 计算完成度，`directorWorkflowStepModules.test.js` 覆盖范围化章节完成、自动审校关闭和质量修复完成判定。
- `0a85be2b fix: archive completed auto director reminders` 已覆盖。本地小说页提供“完成并收起”自动导演提醒动作，`novelEditAutomationStatus.test.mjs` 覆盖已完成/已失败/已取消任务的归档可见性。
- `eb15c17e fix(director): align chapter detail and cancellation states`、`542cdd81 refactor director display state and unify fact-first progress projection`、`ff00630e refactor(director): prefer data-driven recovery checks`、`abc46090 refactor(director): unify command execution runtime` 已按本地结构覆盖核心目标。本地已有 `DirectorCommandExecutor`、`DirectorStateStore`、`DirectorDisplayStateBuilder`、`DirectorFactSummaryService`、`DirectorDashboardViewBuilder`、`DirectorCoreStepModuleRuntime` 和模块化 `inspectCompletion` / `recover`，客户端小说页、侧栏、任务抽屉、任务中心均消费 fact-first dashboard/display state；未同步上游大规模 TASK/README/版本号整理。
- `a05d91f3 Implement director P0-1 command pipeline closure`、`48d23b65 Refactor director P0 pipeline state foundation`、`133fef47 fix(director-worker): stabilize worker leasing and recovery flow`、`d7d58c6f Stabilize director runtime leasing`、`9b070bc9 fix: stabilize director worker recovery status`、`a5b222f2 Refactor director worker runtime concurrency`、`b7703348 Tighten director worker command lifecycle` 已由本地后续 director worker 架构覆盖。本地 `DirectorTaskQueue` 使用 `DirectorRunCommand` 做唯一活动队列，支持 lease、renew、complete、fail、cancel、过期恢复、`TaskDispatcher` 唤醒和 per-novel resource gate；`server/src/services/novel/director/README.md` 明确旧 runtime queue 只保留历史投影兼容。
- `1d5426d6 Reflect queued candidate confirmation in runtime projection`、`3b5ee0ca Clarify queued director worker status`、`254ee5f8 Expose director worker queue health`、`ca21da72 Show director worker health in cockpit` 已覆盖。本地 shared 类型包含 `DirectorWorkerHealthSummary`，`novelDirectorRuntimeProjection` 与 `DirectorDashboardViewBuilder` 会区分 queued、leased、running、stale、waiting gate 等状态，`AICockpit` 显示后台执行健康信息，`directorBookAutomationProjection.test.js` 覆盖等待 worker 和旧失败快照不覆盖排队重试。
- `8e552fa2 Protect generated chapters during outline sync` 已覆盖。本地章节规划与执行章节身份通过 `VolumeChapterPlan.chapterId` 和 `VolumeChapterSyncService` 关联，结构化大纲恢复/同步不会仅靠标题序号覆盖已生成正文；相关边界已记录在章节身份与规划 wiki。
- `690fbc56 Add beginner help page`、`ad77e415 Fix beginner model setup link` 已覆盖。本地已有 `/help` 新手上路页、桌面模型配置 gate 的帮助入口、首页/侧栏/移动导航的新手入口，并把开书、任务中心、导演跟进和写法引擎按新手路线组织。
- `3b1b912a fix: auto approve execution planning gates` 已覆盖。本地 `novelDirectorPipelineRuntime` 会在全书自动执行和明确授权的 `auto_execute_range` 下把 `approveAutoExecutionScope` 传入规划、结构化大纲和章节执行节点，避免自动执行被内部审批门卡住。
- `d50d5395 feat: explain autopilot quality budget`、`dc3b2e3d feat: track full-book quality loop budget`、`6ca0b107 fix: keep full-book autopilot moving past quality loops`、`f89bc0ab Stabilize quality loop scoring budget`、`bc829732 Fix autopilot repair state convergence` 已按本地质量债务体系覆盖。本地投影携带 `qualityDebtSummary`、`qualityBudgetSummary`、`circuitBreaker` 和质量根因，章节质量循环可把低风险问题登记为债务后继续，wiki 明确 `defer_and_continue`、质量债来源和后续回收边界。
- `e1231f26 feat: resolve autopilot state proposals`、`8a1f21f5 Close autopilot state proposal recovery loop` 已覆盖。本地 `director.state_proposal_resolution` 作为 Prompt Registry 资产注册，`DirectorStateProposalResolutionService` 负责用 AI 处理 pending state proposals，章节 runtime 和 retry/continue 流程已有状态提案恢复闭环测试。
- `970dc6be fix: backfill structured outline recovery`、`2afc5fcb Update autopilot closure task progress`、`0911ae73 Align autopilot progress and chapter actions`、`6ca0b107 fix: keep full-book autopilot moving past quality loops` 已覆盖。本地自动导演恢复链路会回填结构化大纲、展示 `auto_execute_range` 行动、在任务中心/小说页/任务抽屉保持章节行动一致，并把继续授权传递到后续 pipeline。
- `5772b94c Harden autopilot style and model routes` 已覆盖并按本地商业化模型路由保留。本地已有模型路由、风格生成 sanitizer、章节 runtime 模型绑定测试和账户类型模型配置；同步时必须继续保护本地体验账户/创作账户模型选择与后台定价能力。
- `d67611ff Fix autopilot pipeline policy persistence`、`823be323 Close full-book autopilot recovery loop`、`a5991afd fix(director): continue execution after outline recovery`、`fe18788d fix(director): recover stale continue commands before reuse` 已覆盖。本地 pipeline job state 会携带自动执行策略，continue/retry 会恢复 stale command、结构化大纲和章节执行授权，避免全书自动执行在质量循环或大纲恢复后断链。
- `4e3968f8 feat(director): finalize automation cockpit recovery flow`、`b8c860a7 fix(director): align workspace automation status`、`d466d41c feat(director): compact cockpit progress entry` 已覆盖。本地 `AICockpit` 作为统一驾驶舱组件，小说列表、首页、工作区侧栏、小说页和任务抽屉共用自动导演投影；`novelEditAutomationStatus.ts` 负责把任务、投影和取消/归档状态合并成工作区显示状态。
- `043c7550 Expose autopilot recovery projection details`、`af05ff90 feat(director): show full progress history` 已覆盖。本地 runtime projection 和工具 schema 会展示恢复详情、历史步骤、最近用量和 worker health，前端进度面板/驾驶舱可读取这些字段解释当前卡点和下一步。
- `db451f8e feat(director): add autopilot circuit breakers`、`953602e3 feat(director): continue after autopilot replan`、`7e20d5be feat(director): add automation ledger event contract` 已覆盖。本地已有 `DirectorCircuitBreakerService`、`novelDirectorAutoExecutionCircuitBreakerRuntime` 和 `DirectorAutomationLedgerEventService`，质量失败、重规划、repair ticket 和 circuit breaker 状态会写入自动化 ledger，并在驾驶舱显示可恢复动作。
- `7b33efff feat(director): add llm usage telemetry schema`、`d7c3eb4e feat(director): attribute llm usage to runtime steps`、`76815d87 feat(director): surface automation usage telemetry` 已覆盖。本地已有 `DirectorLlmUsageRecord` 迁移、`DirectorUsageTelemetryQueryService`、LLM usage tracking 的 task/step 归因，以及驾驶舱/运行投影的调用次数、输入/输出 token 和耗时展示。
- `272567b0 feat(director): surface artifact ledger summary`、`66b61232 feat(director): summarize ledger quality signals` 已覆盖。本地 `DirectorWorkspaceArtifactInventory` 与 artifact ledger query 会汇总章节任务单、正文、审校、修复、伏笔同步和质量循环信号，自动导演投影可显示产物完整度和质量摘要。
- `af78905b feat(director): prefer patch-first chapter repair` 已覆盖。本地章节生产链和 wiki 明确局部 patch repair 是轻修优先策略，`ChapterPatchRepairService` 对短片段、歧义片段和不可定位补丁转成可恢复失败，避免原始 Zod 错误打断自动导演。
- `711a23c0 feat(director): gate chapter task sheets` 已覆盖。本地章节执行合同同步、章节任务单质量规则和 `chapter_task_sheet` artifact 检查确保章节执行前有可用任务单；JIT 任务单生成未完成时会停在可解释等待态。
- `fcdfbcf8 feat(planner): route replan window through AI decision` 已覆盖。本地已有 `planner.replan_window_decision` Prompt Registry 资产、`ReplanWindowDecisionService` 和 `shared/types/replanWindowDecision.ts`，重规划窗口选择继续由 AI 结构化判断完成，符合 AI-first 规则。
- `5f72e27a test(director): expand recovery sample audit` 已覆盖。本地 `directorRecoverySampleAudit` 会检查 recovery samples 的上下文、artifact、ledger baseline 和恢复分类，辅助后续同步阶段判断哪些历史问题已被当前 runtime 修复。
- `a3bb391b fix(director): retry locked volume workspace writes` 已覆盖。本地 `volumeWorkspacePersistence` 对事务锁写入有重试保护，`volumeWorkspaceTransaction.test.js` 覆盖锁冲突后重试。
- `d2a98ffd feat(director): record chapter quality loop state` 已覆盖。本地 `shared/types/chapterQualityLoop.ts`、`ChapterQualityLoopService`、章节审校/修复记录和 `chapterQualityLoop.test.js` 会把质量循环推荐动作、终止动作、质量债归因写入章节 `riskFlags.qualityLoop`，并供自动导演投影读取。
- `d7e0ad7d feat(director): add full book automation projection` 已覆盖并被后续 dashboard view 扩展。本地 `DirectorBookAutomationProjectionService`、`DirectorBookAutomationProjectionModel`、`DirectorDashboardViewBuilder`、`AICockpit`、小说列表/首页/工作区侧栏均使用书级自动化投影，且保留本地全书自动执行默认策略。
- `0e208bd2 Sync chapter execution rail state`、`f9dcce31 Approve scoped auto execution reviews`、`17fc4d73 Fix auto execution gate approval` 已覆盖。本地章节执行 rail 会跟随 active auto execution state，继续/重试路径会把 `approveAutoExecutionScope` 传给审校、修复和状态提交阶段，不会在已授权范围内重复卡审批门。
- `0b3cfa35 Auto requeue safe stale director commands`、`fe18788d fix(director): recover stale continue commands before reuse`、`baadb542 fix(auto-director): resume failed retries`、`ba484841 Fix director front10 continue recovery` 已覆盖。本地 `DirectorCommandService` 支持 stale lease 自动重排、继续前清理旧命令、失败 retry 恢复和 `cancelRequestedAt` 清理，`directorRunCommandService.test.js` 覆盖首个 stale command 自动恢复、front10 continue 恢复与耗尽后再接收新 continue。
- `d82e1123 Backfill outlines before repair continuation`、`59faf113 Allow takeover recovery to backfill outline`、`d7612256 fix(director): accept synced outline on takeover rerun` 已覆盖。本地接管恢复会在章节执行或修复前校验结构化大纲并允许回填，`autoDirectorValidationContract.test.js` 覆盖“先回填大纲再继续章节执行”的路径。
- `f1609d1a Classify superseded director recovery samples`、`1000e809 Classify director recovery sample diagnostics`、`8bfccebc Add director recovery sample audit`、`9598b67d Add director draft baseline backfill` 已覆盖。本地已有 `server/scripts/director-recovery-sample-audit.cjs`、`directorRecoverySampleAudit`、draft baseline backfill 脚本和测试，用来区分 superseded 样本、缺失 draft baseline、contextless takeover 和手动恢复门。
- `893651ca Recover contextless takeover continues`、`4e0d7a46 Recover takeover commands from saved payload` 已覆盖。本地继续/接管命令可从保存的 payload、resume target 和 workflow task 上下文恢复，避免缺少即时上下文时直接失败。
- `8f13a44c Backfill legacy director runtime artifacts`、`6565f299 Fix director artifact dependency persistence`、`144558a9 Filter director runtime produced artifacts`、`9b8b5f98 feat: persist auto director runtime ledger` 已覆盖。本地 `DirectorRuntimeStore`、`DirectorRuntimePersistence`、`DirectorRuntimeSnapshotMerge` 和 `DirectorArtifactLedger` 会持久化/合并 `DirectorArtifact`、依赖、版本、producedArtifacts，并过滤与当前步骤无关的产物。
- `4a9466b0 Queue director title repair command` 已覆盖。本地章节标题修复走 `DirectorCommandService` 命令队列，保留标题警告直到修复完成，避免前端直接绕过 worker 执行重型修复。
- `c684fc64 feat(auto-director): isolate execution plane` 已由本地当前执行面架构覆盖。本地 Web API 只接收命令并返回轻量投影，worker 执行重型链路，运行态从 `DirectorRun` / `DirectorStepRun` / `DirectorEvent` / `DirectorArtifact` 等事实源投影；`docs/wiki/workflows/auto-director-runtime.md` 记录了该边界。
- `2e540368 fix(auto-director): harden recovery and ledger resume`、`6519cc5d feat: harden auto director recovery flow`、`36035e3d fix(auto-director): align manual recovery behavior`、`11c141da fix(director): prevent recovery resolver recursion` 已覆盖。本地恢复链路会优先显式人工恢复状态、ledger resume 和 runtime facts，避免恢复 resolver 递归或把手动恢复误判为可自动推进。
- `3d448d35 feat: unify auto director write contracts` 已覆盖。本地自动导演写作合同统一经过 workflow step module、chapter execution contract sync 和 Prompt Registry 注册 Prompt；章节正文生成不再由 director 旁路直接写入。
- `a8a1c30e fix: reconcile auto director chapter batches by content` 已覆盖。本地 `novelWorkflowAutoDirectorReconciliation` 会按章节内容、pipeline job、auto execution state 和 checkpoint 对齐章节批次，避免只看任务状态误判。
- `6aa73863 feat(auto-director): clarify approval authorization controls` 已覆盖。本地设置页和自动导演设置面板保留自动审批偏好、全书自动执行授权和手动确认边界；授权不会覆盖本地商业化模型路由或账户类型配置。
- `ef403e7f fix(director): allow restart from cleared volume outline` 已覆盖。本地卷规划工具允许清空卷大纲后重新生成，`volumeWorkspace.test.js` 覆盖清空后重启生成的兼容路径。
- `a71e998d feat(director): add langgraph pilot runtime` 已覆盖。本地已有 `server/src/services/novel/director/langgraphPilot/DirectorLangGraphPilot.ts`，`DirectorRuntimeService` 可通过 LangGraph pilot 执行下一步或运行到下一审批门，`directorLangGraphPilot.test.js` 覆盖 checkpoint、interrupt 和 trace。
- `3034a19c feat(director): add workflow step module runtime`、`26730f8e feat: implement auto director runtime MVP`、`9e9efdb4 refactor(director): split runtime orchestration modules` 已覆盖。本地已有 `WorkflowStepModule`、`WorkflowStepModuleRegistry`、`directorWorkflowPlans`、模块化 candidate/confirm/continue/pipeline runtime 和 `DirectorRuntimeService`，旧 `NovelDirectorService` 已不再承担全部运行时职责。
- `ee24458d feat(prompting): route runtime prompts through context broker`、`2e1412cc feat(prompting): add prompt workbench preview foundation`、`ba563cd6 docs: add prompt workbench runtime plan` 已覆盖。本地已有 `ContextBroker`、`ContextResolverRegistry`、creative hub/runtime context resolvers、Prompt Workbench 预览和 runtime context broker 测试，业务 Prompt 继续通过 Prompt Registry 暴露。
- `e3bd7f41 feat(director): expose runtime tools to creative hub` 已覆盖。本地 `directorRuntimeTools` 已注册到工具系统，Creative Hub planner 可识别导演运行态工具，工具 schema 暴露 workspace analysis、runtime projection、manual edit impact 等能力。
- `2292242a feat(director): project chapter execution runtime nodes`、`6f1d85b8 feat(director): record runtime heartbeat events`、`e57f6872 feat(director): enrich runtime progress projection`、`8d132288 feat(director): surface runtime progress in UI` 已覆盖。本地 node runner、event projection、runtime projection card、任务中心和小说页会展示 runtime 节点、心跳、最近事件、执行进度和恢复提示。
- `51d68913 feat(director): index quality artifacts in ledger`、`2c53e0c5 feat(director): link artifact ledger dependencies`、`a06ebf64 feat(director): feed ledger summary into workspace analysis`、`a8bc6ae4 feat(director): track artifact ledger versions` 已覆盖。本地 `DirectorWorkspaceArtifactInventory` / `DirectorWorkspaceQualityArtifactInventory` 会索引质量产物、依赖、版本、保护内容和 ledger summary，并把摘要喂给 workspace analysis。
- `31ab01a8 fix: stabilize auto director resume order` 已覆盖。本地恢复顺序优先处理候选确认、自动执行范围和手动恢复状态，`novelDirectorRetry.test.js`、`novelWorkflowRuntime.test.js` 与自动执行 runtime 测试覆盖继续/重试排序。
- `697ed46e refactor(director): run takeover through node adapter`、`f1f474c3 refactor(director): centralize execution node adapters`、`783052e6 refactor(director): centralize candidate node adapters`、`3174e4b7 refactor(director): centralize stage node adapters` 已覆盖。本地已使用 `novelDirectorTakeoverNodeAdapters`、`novelDirectorExecutionNodeAdapters`、`novelDirectorCandidateNodeAdapters`、`novelDirectorStageNodeAdapters` 作为 runtime 节点适配边界。
- `b4445014 feat(director): add runtime policy controls`、`22c7bbda feat(director): gate chapter runtime execution` 已覆盖。本地 `DirectorPolicyEngine`、`TaskCenterRuntimePolicyCard` 和 `NovelTaskDrawer` 会展示/执行 runtime policy，章节写作、审校、修复等高风险节点会按授权和保护内容 gate。
- `93121a02 feat(director): expose manual edit impact in tasks`、`9dc056aa feat(director): analyze manual edit impact` 已覆盖。本地 `directorManualEditImpact` Prompt、`DirectorWorkspaceAnalyzer`、任务中心手动改动影响卡和小说任务抽屉都能展示用户手动编辑对自动导演的影响。
- `66c3b3a7 refactor(tasks): split task center presentation` 已覆盖。本地任务中心已经拆出 `TaskCenterDetailSummary`、`TaskCenterFilterPanel`、`TaskCenterListPanel`、`TaskCenterSummaryCards`、`TaskCenterMilestoneHistory` 和 `taskCenterUtils`，保留本地任务归档/卡密商业化相关页面不受影响。
- `ff0fbc4e fix(client): keep task detail navigation in app` 已覆盖。本地 `resolveInternalNavigationTarget` 用于任务中心、小说页和导演跟进页，内部任务详情跳转会走 React Router，避免客户端里打开外部浏览器或丢失桌面上下文。
- `576c7b23 fix: let AI driver continue after repair notices` 已覆盖。本地自动导演 follow-up、质量修复通知和全书自动执行 runtime 会把可继续的修复提醒转为恢复/继续动作，不会因普通 repair notice 永久停在等待态。
- `096748aa docs: plan auto director runtime refactor` 的稳定结论已被本地 runtime wiki 和当前模块化实现吸收，不再同步上游临时计划文档。
- `a52427bc feat(novel): add preview and speed up list loading` 已覆盖。本地已有 `/novels/:id/preview` 路由、`NovelPreview` 页面、小说列表预览入口、轻量列表查询和任务归档过滤，适合市场测试时快速查看作品状态。
- `4e58c748`、`3a0b79b6`、`36273e99`、`3485be0e`、`da8d5460` 属于上游计划文档、README 状态或桌面版本号提交，不直接同步；本地同步审计和桌面发布节奏仍以本地文档与 `desktop/package.json` 为准。
- `0ff54f00 Require commits after each development phase` 已由本地 `AGENTS.md` 分支与阶段提交规则覆盖。本项目要求每个阶段完成后提交，并在提交前按 release-note 工作流判断是否更新 README / release notes。
- `409821ad`、`89e6823b`、`7a25f4b1` 属于上游 release notes、P0 状态文档或桌面版本号记录，不直接同步；本地以 `docs/checkpoints/upstream-sync-audit-2026-06-09.md` 和自己的桌面版本节奏作为权威。
- `38d7024a`、`4de4d39a`、`67e079b7`、`85990541`、`7f08a873` 属于上游桌面版本号、beta release 摘要或 README 截图/状态补充，不直接同步。当前本地 release note、README 最新更新、桌面版本和展示素材必须由本地产品节奏维护。
- `6acddede` 属于上游桌面版本号提交，不直接同步。本地桌面公开发布必须继续由 `desktop/package.json` 的本地稳定版本和 `vX.Y.Z` tag 规则驱动，不能引入上游 `0.2.7` 节奏，否则会破坏 `CDYYY98/AI-` release 与客户端更新通道。
- `f5392685`、`3c357206` 已覆盖并按本地正式客户端策略收敛。本地已有 `desktop/src/runtime/updater.ts`、`desktop/src/main.ts` 和 `DesktopBootstrapShell` 的启动更新检查、下载/安装状态展示；`desktop/src/runtime/server.ts` 保留 `AI_NOVEL_APP_DATA_DIR` 和 `DESKTOP_SQLITE_DATABASE_URL`，正式打包可通过 `AI_NOVEL_API_BASE_URL` 连接线上服务端，避免打包版误用或覆盖本地 sqlite 数据。
- `dac26ffc` 已覆盖。本地 `client/src/lib/constants.ts` 在生产 Web 未显式配置 API 时使用同源 `/api`，开发环境保留 `localhost:3000/api` 推断，桌面环境仍优先读取部署配置；`client/src/lib/constants.test.mjs` 覆盖该行为。
- `1137d671`、`b0f74105` 已覆盖并必须保护本地商业化模型选择。本地已有 Anthropic/openai-compatible 协议字段、结构化响应格式、reasoning 开关、请求 guard、结构化修复协议透传、模型路由连通性测试和设置页 `ModelRouteFields`；同时保留本地 `AccountTierModelSettingsService` 和后台体验账户/创作账户模型配置，不能用上游设置页改动覆盖商业化路由。
- `c10c99d5` 已按本地能力覆盖主要风险点。本地有 `server/src/llm/requestLimiter.ts` 和 `server/tests/llmRequestLimiter.test.js` 的 provider 请求限流，`volumeWorkspacePersistence` 与 `plannerPersistence` 已有事务锁/写入稳定性测试；上游拆分 `settingsProviderRoutes` 的目录结构不直接搬运，避免冲突本地设置页、API key、账号类型模型和正式邮箱/部署配置。
- `8a151e6b`、`173029f1` 已覆盖。本地知识库已有 RAG embedding 设置、运行时检索参数、collection 模式、自动重建、RAG 兼容启动、任务清理服务和前端 `KnowledgeEmbeddingSettingsCard`；`RagJobCleanupService` 与 `ragJobListing.test.js` 覆盖任务列表清理，后续只需按本地 UI 继续迭代，不直接同步上游设置页重排。
- `78f54680`、`eb9d86bd`、`ef4040f4`、`d2974289`、`f4e1c145` 已覆盖。本地接管/结构化大纲恢复会同步全书详情、重置结构化接管后的下游阶段、执行前重验大纲范围、强制章节执行顺序，并隔离章节执行状态；`novelDirectorTakeoverExecution.test.js`、`novelDirectorTakeoverReset.test.js`、`novelDirectorRetry.test.js` 和下游 reset 的前端 rail 测试提供覆盖。
- `c56339d0`、`3080ce6a` 已覆盖。本地 `NovelWorkflowService` 在任务状态转移时调用 `AutoDirectorFollowUpNotificationService`，钉钉/企微通道、回调执行、通知日志、自动审批审计和最近记录投影均有服务与路由测试；继续同步时不能退回到只在页面内提示的弱通知。
- `0f0514e2` 已由本地章节自动化释放与运行态收敛覆盖。章节 artifact sync、runtime pipeline、LLMSelector、自动审批草稿和章节 runtime 测试已支持自动导演释放后的继续执行；同步时应保留本地模型选择、账户类型模型和桌面正式服务配置。
- `a681aca8`、`81ea64d1`、`0dff24af`、`661c422e`、`bef46379` 已覆盖。本地已经有移动端小说工作区、自动导演状态卡、跟进中心紧凑筛选、任务筛选、状态网格和移动端导航契约测试，适合保留本地现有移动 UI，而不是按上游整页替换。
- `1f93cd55`、`1e80c873`、`af3da81f`、`a4f1d764`、`5938e820`、`a0112d47` 已覆盖或等价处理。本地 `Dockerfile.api`/`Dockerfile.web` 已保留 workspace runtime、`server/prisma.config.ts`、server/shared 模块、Postgres 生产模式、web nginx 配置和瘦构建上下文；API 镜像只对 storage 与 prisma shim 做权限处理，避免对整个 `/app` 递归 chown。
- `73347231`、`3fbdc3a6`、`483877e4`、`eeb030d8` 已覆盖并已本地化迁移。本地已有角色库同步、角色资源账本、Prompt Registry 注册、Postgres 兼容的 `20260424223000_character_resource_ledger` 迁移、章节上下文与状态提交中的角色资源联动，以及相关测试；后续不要重新引入上游旧版迁移 SQL。
- `4fa70a7c`、`ef5fb7ee` 已覆盖。本地已有卷大纲 chunking、beat sheet chapter budget、结构化大纲恢复、移动端站点 shell、接管 reset range、工作区 rail downstream reset 和高内存范围保护；继续同步时应以本地自动导演恢复链和移动契约测试为准。
- `ec58838b`、`cfa8c224`、`f439693d`、`2e035237`、`aabbc2e9` 已覆盖。本地有 closeout safeguard、高内存 reservation、重叠 continue run 替换、rewrite snapshot 保护、自动导演跟进批量操作、审批策略和安全修复动作投影；这些能力已经和本地任务中心/跟进中心/商业化模型路由整合，不应按上游重新覆盖。
- `44ca0ed9` 仅涉及上游 style extraction status enum 迁移和 release note，当前本地已有 style extraction 状态链和设置页运行时卡片；如后续发现数据库枚举不一致，应单独按本地迁移历史审查，不能把上游迁移直接套进生产库。
- `521d8420`、`dc722eff`、`34e14289`、`7c765f85` 属于上游 CLA 与许可证策略调整，不直接同步。当前本项目包含本地商业化、桌面发布、卡密/充值与私有部署约束，许可证和贡献协议需要用户明确法律/商业决策后再改，不能在技术同步阶段自动替换。
- `a48a4a9f`、`05c978ea` 的 beta 预发布分支说明已由本地 `AGENTS.md` 的 `beta` 工作流覆盖。本地规则更完整，包含 feature branch、beta 集成、main 发布、桌面发布和 hotfix 回灌，不需要把上游 README 片段复制到用户 README。
- `83c1ad73`、`7b18d931` 继续归入上游许可证/历史说明类提交，不直接同步。许可证措辞会影响商业分发、贡献入口和后续上架表述，应在用户明确法律策略后单独处理，不能作为技术同步附带修改。
- `a44807ee` 的稳定技术点已覆盖，但不直接整体同步。该提交大规模移动 Postgres/SQLite migrations、图片存储、自动导演跟进中心和通道回调；本地已有 `AI_NOVEL_DATABASE_MODE`、`migrations.sqlite`、运行时迁移、S3/local 图片存储、`settingsAutoDirector`、钉钉/企微回调、跟进中心和相关测试，同时保留本地卡密、正式邮箱、桌面发布和商业模型配置。
- `81455b65` 已覆盖。本地 `plannerOutputNormalization`、`plannerSchemas` 和 `structuredInvoke` 测试会保留 planner 输出中的 `objective` 别名，避免结构化输出被 singleton unwrap 或字段别名归一时丢失章节/场景目标。
- `2a4c01a5` 属于上游测试期望收敛，已被本地当前 `structuredInvoke.test.js` 与模型协议/repair 兼容测试覆盖，不需要单独同步上游 README/release note 回退。
- `c8ce913c` 已覆盖。本地任务中心和自动导演跟进中心已有 follow-up action 执行、批量继续、重试、幂等、风险校验、安全修复、section 过滤和路由测试；继续同步时应保持本地任务中心与商业模型路由的整合。
- `b041cbb0` 已覆盖。本地结构化输出链路已经拆出 parser/repair、structured output 兼容、provider 协议透传、reasoning 处理和 JSON repair 测试；后续新增修复策略仍应走 Prompt Registry / structured output 边界，不加业务关键词兜底。
- `901be686`、`f4fb4310` 已覆盖。本地自动导演在确认开书、接管、章节交接和结构化大纲恢复后会回填运行事实并继续到正确阶段，`NovelDirectorService`、接管 reset、auto execution runtime 和相关 recovery/structured outline 测试提供覆盖。
- `9f9bff85`、`1081ff32`、`ff97a57c`、`986ff745` 已覆盖。本地 Style Engine 已有素材提取创建写法、知识库/拆书素材入口、后台提取任务、运行时设置、Prompt Compiler 边界、写法资产恢复、Style Engine V2 文档和任务中心适配；不需要按上游旧页面结构重排设置页。
- `e2e25298` 已覆盖。本地 `RagIndexService` 与 `ragJobListing.test.js` 会处理 stale knowledge indexing task 状态，避免知识库任务列表长期显示错误运行态。
- `4dfd72cb` 已覆盖。本地 Prompt Registry 使用声明版本解析资产，`prompting.test.js` 覆盖 style prompt 按 asset version 查询，符合 Prompt Governance 规则。
- `2a90f5b9` 已覆盖。本地小说编辑页和 `novelEditTakeover.shared.ts` 会在自动导演章节执行/审核/修复完成后显示“进入章节执行”和“退出导演模式”入口，不再把已完成任务误导成继续自动导演。
- `09fa65d2`、`df97ee6d`、`a1ab5f3d`、`f41be92d`、`dda670ac` 属于旧桌面 release/版本号阶段提交，本地已按当前正式发布链吸收通用技术点：NSIS 短路径模板、asar verifier、unsigned release 显式 opt-in、pnpm 10/Node 24 workflow、`Setup.exe` 安装版优先和 `CDYYY98/AI-` 更新源。上游旧版本号和 README 状态不直接同步。
- `46be98fb`、`6bfe3bcb`、`6f3bee8e` 属于上游 README 下载区、截图或桌面入口展示提交，不直接同步。本地 README 已指向 `CDYYY98/AI-` Releases、正式用户安装版和本地产品名，不能被上游素材或下载入口覆盖。
- `a4f14c83`、`926735c6`、`3a91ab19` 继续归入上游许可证/发布说明类提交，不直接同步。若后续要调整 Apache/AGPL/CLA 表述，应由用户确认商业发布策略后单独做法律文档阶段。
- `36680a44`、`0ee55a1e` 已覆盖。本地章节运行时已有 `finalizing` SSE 状态、章节审校/修复结果面板、Prompt trace / debug logging、章节上下文预算、接收闸门、artifact sync checkpoint 和 `ChapterRuntimeCoordinator` 测试；继续同步时不应把上游旧版 scene streaming 或审校页面状态覆盖回来。
- `6ba5386e` 已覆盖。本地卷规划已支持 beat sheet、按节奏段分块生成章节列表、单 beat 重写、章节跨度校验、移动端布局和 `volumeChapterListChunking.test.js` / `volumeBeatSheetChapterBudget.test.js` 等测试；无需再按上游提交重复拆分 hooks。
- `b4783fa5` 已覆盖。本地结构化大纲恢复已有独立恢复模块、卷节奏板/章节列表/章节详情阶段事实、retry 恢复、workflow structured outline progress 测试和前端卷规划草稿工具；继续同步应以本地 workflow step runtime 作为权威。
- `830724a3` 已覆盖。本地章节编辑器 V2、AI 改写候选、工作区诊断、导演面板、章节标题修复命令、任务抽屉说明和章节详情上下文测试已经吸收该方向；上游提交中的大页面重排不能直接覆盖本地商业化页面与移动适配。
- `59f11406` 已覆盖并部分归入后续本地架构。本地已有 planner state flow、replan decision Prompt、task recovery routes、CanonicalState/StateCommit/StateVersionLog、章节 runtime coordinator、自动执行失败恢复和任务恢复对话框；同时本地没有保留上游 `.tmp` 临时日志，避免把临时产物重新带回版本库。
- `6f6a8d11` 已覆盖。本地已有 takeover reset、章节执行状态流、结构化输出归一、小说导出格式化/类型、状态 schema 兼容和导出服务测试；同步时必须保护本地导出与桌面/卡密运营配置。
- `e0596cda` 已覆盖。本地小说工作区接管入口状态已经和自动导演进度、任务抽屉、完成退出入口整合，不需要复制上游较早的提示文案或 AGENTS 片段。
- `bfc09617` 已覆盖。本地默认安装不再把 Electron runtime 当普通应用依赖打进 staged app，`verify-desktop-package.cjs` 明确检查 staged app 不含 `node_modules/electron`；`package.json` 也保留只在桌面包内准备 runtime 的脚本边界。
- `0a375b64`、`ca9707e3`、`5dd97f03`、`0623ac13`、`6f29290d` 已覆盖。本地桌面构建链已有 NSIS 模板短路径镜像、asar verifier 从 electron-builder 依赖解析、electron-builder 内部模块解析兜底、beta/release workflow Python 环境、桌面 bootstrap/update/import/model gate 和安装包校验脚本；旧 beta 版本号和上游发布身份不直接同步。
- `127f7c93` 已覆盖。本地已有桌面开发 shell、preload bridge、runtime server、desktop paths、`dev:desktop`/`build:desktop:all` 脚本和正式远端 API 打包入口；同步时继续保持 `图灵网文工作台` 与 `CDYYY98/AI-` 发布身份。
- `bf6dafcf` 已由本地 `AGENTS.md` 的 Desktop Branch Completion Workflow 覆盖。`desktop-dev` 被视作已完成候选，后续桌面改动应走短分支 -> `beta` -> `main`，不再沿用上游临时桌面分支策略。
- `9ab8c1f7` 已覆盖。本地 `.gitignore` 已排除 `*.zip`、`*.tar.gz`、`.pnpm-store/` 和构建产物，`git ls-files` 确认 `.tmp`、`server/.tmp`、`desktop/build`、临时压缩包和 pnpm store 没有继续被跟踪。
- `bb8bed09` 已覆盖。本地 `shared/tsconfig.json` 已包含顶层 `*.ts` 和 `types/**/*.ts`，能编译 `shared/index.ts`、`shared/imagePrompt.ts` 等顶层共享模块。
- `0321caf7`、`b1ce8e00` 已覆盖。本地角色图像库支持列出、设为主图、删除图片资产；服务端 `ImageGenerationService` 先持久化生成文件再进入事务，删除时会清理本地/S3 存储文件并保留数据库一致性。
- `f67fb535` 已覆盖。本地已有角色图像提示词优化 PromptAsset、图片 prompt shared 类型、图片路由和角色图片弹窗优化；后续图片能力扩展仍应和图片成本、供应商和封面工作流一起评估。
- `e333e3e5` 已覆盖。本地 RAG runtime settings、embedding settings、图片 provider settings、运行时兼容 bootstrap 和设置页导航卡已经把运行配置收拢到应用设置；保留本地正式邮箱、模型路由、账户类型模型和卡密运营入口。
- `1f27e43e` 属于上游删除误跟踪文本样本/临时产物的提交，本地当前没有跟踪这些样本文本或 `.tmp` 产物，不需要同步。
- `a3b0813e`、`65830885`、`7f680870` 已覆盖。本地自动导演接管、pipeline recovery、章节标题修复、candidate seed 修复、结构化规划、LLM repair/session logging 和任务恢复归一化均已存在；继续同步应保留本地 worker/runtime/follow-up 架构，而不是回到上游旧 `NovelDirectorService` 聚合实现。
- `0fff27c3`、`396ed67b` 已覆盖。本地章节编辑器 V2 已拆出 `ChapterEditorShell`、诊断卡、选区 AI 浮动工具、diff 面板、改写候选 PromptAsset、章节编辑路由和测试；不需要用上游较早的页面拆分覆盖当前编辑器。
- `95f38c35`、`cea19b85`、`3d95b179` 已覆盖。本地已有 payoff ledger、章节 payoffs directive、volume payoff overview、chapter length control、scene budget runtime 的兼容能力、章节运行时面板和 payoff 同步测试；完整 Fact Ledger / timeline 仍按单独阶段评估，不能把上游旧 scene execution 热路径整体搬回。
- `e0a20ae8` 已覆盖。本地角色生成稳定性已通过角色准备 PromptAsset、generated content schema、角色诊断、角色阵容质量闸、自动导演角色 gate 测试和角色资源账本收敛；后续仍按 AI-first Prompt/schema 修复，不加固定关键词兜底。
- `7af0dbb2` 已覆盖。本地模型路由、Kimi/DeepSeek reasoning 处理、结构化输出能力检测和 `novelDirectorSchemas.test.js` 已覆盖 Kimi 自动导演规划兼容；同时保留本地后台模型定价和账户类型模型选择。
- `ce36c151`、`19997084` 已覆盖。本地 director candidate 的 `titleOptions` schema、candidate batch hydration、confirmation dedupe、候选选择路由和任务 UI 已有测试；继续同步时不能破坏本地自动导演候选弹窗与任务中心入口。
- `209ad819`、`3cf5d8c8` 已覆盖。本地 pipeline payload 可携带质量 notice，任务中心会展示自动导演重规划/质量提醒，`pipelineJobDedup`、任务可见性和 linked pipeline job 去重测试避免重复任务污染列表。
- `6d14167a` 已被后续结构化输出修复覆盖。本地已有 structured output diagnostics、fallback transport、repair parser、provider capability 和 Prompt Registry 结构化修复测试；上游 TASK 计划条目不再单独同步。
- `b64dcf81`、`65339262`、`682ac06a`、`1fc9c867` 已覆盖。本地自动导演恢复提示、reused pipeline job resume、任务导出可见性、失败 explainability、恢复归一化和 task visibility 测试已存在；继续同步时要保护本地任务归档、卡密和桌面上下文。
- `08e64794` 已覆盖。本地结构化输出 fallback 设置、模型连通性诊断、book analysis 稳定性、payoff chapter refs、`maxTokens` 空值兼容和模型路由 UI 已有实现；同步时保留本地商业供应商设置和余额查询。
- `93cdbe3b` 已覆盖。本地自动导演支持全书、章节范围和当前批次等 scoped auto execution，`directorAutoExecutionPlan.shared.ts`、auto execution runtime、导出服务和相关测试已经整合该能力。
- `ad360167` 已覆盖。本地 SSE `RunStatus` 支持 `streaming/finalizing/completed` phase，章节运行时在流式正文结束后的审核/保存阶段会显示 finalizing 状态，`chapter-runtime-routes.test.js` 覆盖该行为。
- `c1ca9f63`、`8abdfb0f` 已覆盖。本地工作区入口、AI 操作流、reasoning 开关、planner persistence、设置页运行配置和模型能力检测已整合；不直接同步上游 README/页面叙述，避免覆盖本地商业化个人中心和模型配置。
- `6ceac93a` 部分覆盖。世界观删除入口和 toast 本地已有世界观工作区/素材库/一致性检查能力，但删除世界观属于数据删除操作，若要补齐必须按数据保护规则单独设计确认、备份和权限边界，不能作为普通同步直接加入。
- `ef35c856`、`1f922a86`、`f8e76a17`、`99671c22` 属于上游 checkpoint、截图、TASK 路线图、README 文案或流程图资产提交，不直接同步。本地同步审计文档和 release notes/README 工作流是权威，避免把上游宣传素材或路线图混入本地商业分发文档。
- `b30c1fde` 已覆盖。本地章节执行操作区已经由当前 `ChapterExecutionActionPanel`、章节执行共享文案和章节工作区布局承载，后续不能用上游小幅 label 调整覆盖本地章节执行面板。
- `afde8e69` 已覆盖。本地书籍分析到写法/风格沉淀已经通过书籍分析工作区、写法公式页面和 Prompt Registry 的风格提示注册实现；上游的分析页跳转参数不再单独同步。
- `22f64ddd` 已覆盖。本地已有 `NovelWorkspaceRail`、`novelWorkspaceNavigation` 和 `AppLayout` 的沉浸式小说工作区导航，且已经与本地桌面/商业页面入口共存。
- `266efff7` 已覆盖。本地 `usageTracking`、任务中心 token 汇总、小说列表/自动导演进度面板和 `TaskTokenUsageSummary` 已经展示调用次数、输入/输出/总 tokens；继续同步时要保留本地账号类型模型路由和成本配置。
- `a669a0e5` 已覆盖。本地 planner context blocks/helpers、自动导演 runtime/recovery、workflow reconciliation 和恢复归一化测试已经吸收该方向，且当前实现已进一步拆入 director runtime/step modules。
- `bb4734c2` 已覆盖。本地 onboarding、资源推荐、故事模式、系统资源 bootstrap、写法公式和自动导演接管已有实现；上游 seed/README/页面叙述不直接迁入，避免覆盖本地商业化入口。
- `35230c52` 已覆盖。本地卷规划共享类型、卷规划生成 schema、章节列表/大纲页和 volume planning 测试已经支持卷数建议、分析回看和规划校验。
- `fa796c41` 已覆盖。本地角色阵容质量检查、角色准备上下文、自动导演恢复归一化和任务适配测试已经处理 recovery failure normalization 与 cast anchors。
- `6970d2cb`、`6bf4710b` 已覆盖。本地 `client/.env.example`、`server/.env.example`、`client/src/lib/constants.ts`、`scripts/wait-for-port.cjs` 和常量测试已支持 LAN/dev host 默认值与恢复检查点；不再同步上游 README 文案。
- `074ac7fa` 已覆盖。本地 `.nvmrc` 固定 `20.19.0`，`package.json` engines 支持 Node 20.19/22.12/24+ 与 pnpm 10.6+；Prisma 初始化已经由当前迁移/runtime migration 文档与脚本承担，不同步上游临时图片和 real-chain 测试。
- `37ae03f5` 已覆盖。本地 `novelCoreReviewService`、章节 review context 测试和结构化失败诊断已经让上下文装配错误显式暴露，不再引入上游单点补丁。
- `2c11146d` 已覆盖。本地首页、小说列表、任务中心和自动导演入口已经展示工作流状态与可继续操作；保留当前商业/桌面入口，不同步上游首页大改。
- `dfb4a7c4`、`bfca17ed` 已覆盖。本地 pipeline runtime watchdog、任务恢复初始化、stuck/cancel 状态处理和相关 runtime/state/progress 测试已经存在。
- `efd1aef9` 已覆盖。本地 RAG chunking、运行时设置、索引服务和分块测试已经约束 embedding token cap 与 chunk size/overlap。
- `936f7bc1` 需单独设计。本地 genre/story mode 管理已有树形能力，但“删除父级资产节点”属于可能连带删除子节点和绑定关系的数据破坏操作；若要引入，必须先按数据保护规则设计确认、备份和恢复校验，不能作为普通同步直接加入。
- `2e35113b` 已覆盖。本地 `client/src/api/knowledge.ts`、知识库页面和 `KnowledgeOpsTab` 已处理 RAG health 的缓存/内联展示。
- `b6535fd0` 已覆盖。本地 director progress tracker、结构化调用诊断、prompt runner 元信息、runtime event projection 和 dashboard 诊断已经能定位慢步骤。
- `685242a9` 已覆盖。本地知识库上传文本解码不再保留前端大小限制；后续如需限制应走服务端容量/费用策略，而不是恢复上游旧 UI 限制。
- `83ac65a2` 已覆盖。本地自定义 OpenAI-compatible provider、模型路由、连通性检测、设置页和供应商余额查询已经更完整；同步时必须保护本地 DeepSeek/中转/账号类型模型配置。
- `bbcbf9c4` 已覆盖。本地 `server/src/routes/llm.ts` 的模型路由 upsert schema 已允许 `maxTokens: null`，`modelRouter` 也会把空值当作未设置。
- `1d315585` 已覆盖。本地小说列表 workflow summary、任务控制、token usage 和 `novelListWorkflowSummary.test.js` 已经支持流程状态与操作入口。
- `999c0d76` 跳过。该提交是上游 README 与截图刷新，不能覆盖本地面向 `图灵网文工作台`、`CDYYY98/AI-`、卡密购买和桌面发布的文档/素材。
- `7fd5121c` 已覆盖。本地角色准备 prompt schema、上下文块、性别/阵容质量检查、角色面板和相关 tests 已支持角色准备与性别流程。
- `0fd85926` 已覆盖且部分延后。本地自动导演接管、候选执行、章节运行时、结构化大纲恢复、标题多样性、planner participant resolution 和 takeover validation 已经有更后续的整合；该上游大提交中的数据库迁移、截图和 TASK 重写不直接同步。
- `b453922b` 已覆盖。本地 `ProviderBalanceService`、settings/admin 模型页面和供应商状态展示已经能显示 provider balance；保留本地商业定价与账号分层模型策略。

## 需要单独设计阶段的上游候选

### `42e6f726` / `b5c53c62` 懒规划与多阶段质量修复闭环

这组提交把章节任务单生成、分层缓存、N+1 预取、质量修复闭环和 JIT 规划深度绑定到上游较新的 pipeline 结构。当前本地已经吸收了“章节任务单可延后到执行前生成”的低风险校验修复，但未直接迁入完整懒规划架构。后续若要继续同步，应作为“章节生产链性能与 JIT 规划”单独阶段处理，先明确与本地自动导演、Prompt Registry、质量债务预算和桌面端内存约束的关系。

### `8fe2da07 Remove chapter contract from draft generation`

该提交从上游正文生成热路径移除旧版章节合同、scene streaming 和 scene budget runtime。当前本地已经采用折中策略：默认 writer 不把 sceneCards 或章节合同重新接入正文热路径，但 `ChapterExecutionContractService`、`chapterLengthControl`、规划到执行章节身份链接和旧版章节执行合同仍用于规划、审校、诊断、局部修复和兼容旧数据。直接删除这些文件会破坏本地章节执行区、卷规划同步和旧项目兼容；如后续要清理，只能作为章节运行时兼容层收敛阶段单独做。

### `bbd16008` / `e8fa256c` / `d2ef4d20` / `2a3c7e0b` Fact Ledger 全链路

本地只同步了正文硬事实进入章节摘要的轻量桥接，并审查了 accepted facts 过滤规则。完整 Fact Ledger 会引入新的事实账本表、定稿写入路径、timeline finalization 移除点和跨章事实验收过滤，属于数据库与章节运行链主干迁移，不能在普通上游同步中直接 cherry-pick。进入该阶段前必须先设计迁移、备份验证、旧摘要/RAG 兼容和回滚策略。

### `7c0c8f62` / `322dd76d` / `08b016df` / `e0775888` / `55c943eb` / `522a065b` / `4ec2f0e9` / `bcb70cf6` / `b47e0a6f` / `79f8e5c8` / `d63565f6` / `1f4ffd20` / `2ebfad2c` / `b5d8c3b9` / `1fa357d3` / `9112a308` / `a54b17c9` 等服务端模块化重构

这些提交将 novel service、routes、director modules、chapter runtime 和 application service facade 大幅拆分。方向符合本地架构收敛目标，但会触碰大量稳定入口，也容易覆盖本地账号、商业化、桌面和部署适配。后续只能按一个子系统一个阶段迁移，并保留兼容 facade；不能为了追上上游目录结构而整体搬运。

### `24900709` / `fc5d1ceb` 接管与卷规划章节联动

这两个提交涉及已有项目接管体验、setup flow、卷规划章节与执行链连接。当前本地已经有自己的接管、dashboard view、章节执行恢复和质量修复路径，继续同步前需要先对照本地用户流程做产品级验收，避免引入上游页面状态后覆盖本地已有的模型、卡密、个人中心和桌面流程。

### `db0105ea feat(world): add book world generation workflow`

该提交涉及约 150 个文件、多个 Prisma 迁移、世界实例、世界资产、世界上下文网关、世界页面重构和自动导演 setup 链路。它可能对新手开书有价值，但不能直接合入。进入开发前需要：

- 备份并验证数据库；
- 明确本地商业化页面、模型路由和桌面端不被覆盖；
- 设计本地“世界观生成”与现有 `NovelWorldSliceService`、RAG、自动导演 setup 的关系；
- 单独跑迁移、服务端构建、客户端类型检查和开书流程测试。

### `e80f66fc` / `f419c3bf` / `900f98f3` 封面生成工作流

这组提交新增、回滚并重新应用封面生成工作流，覆盖图片提示支持、图片路由、服务端配置、Prisma 字段、小说基础信息页、timeline finalization、章节修复 runtime 和 workflow service 拆分。功能有商业价值，但它已经跨过“图片能力”边界进入数据库、章节运行链和工作流架构，不能作为普通 UI 小改同步。应在图片商业化、模型成本策略、数据库迁移和章节运行链拆分策略确认后单独做。

### `956a8f02` / `cf5f30a6` / `c7031e95` timeline 与章节运行时链路

这些提交引入 timeline constraint layer、timeline repository、timeline finalization、repair runtime 拆分和大量章节运行时状态调整。它们依赖上游较新的 `server/src/modules/timeline` 和运行时拆分结构，本地当前仍保留较多 monolithic runtime。同步前应先做章节运行时架构迁移计划，不能把 migrations 和 runtime split 夹在普通 bug fix 中。

### `bfdd7779 fix(timeline): normalize extracted state values`

该提交依赖上游 timeline prompt、timeline shared schema 和 timeline constraint 测试。当前本地没有采用上游 timeline 写章介入路径，且已有 Prompt Registry 的结构化输出修复与别名归一化机制；直接同步 timeline state normalization 会把未启用的 timeline 模块带入主链路。后续若启动 timeline/Fact Ledger 融合迁移，应和 timeline constraint layer 一起评估。

### `addd80cd feat(chapter): add future dynamics sidebar`

该提交主要是前端章节侧栏，但读取的数据来自 timeline、角色动态、资源风险等后端投影。当前本地已有部分 timeline shared 类型，但尚未接通 `getChapterTimeline` 客户端 API、查询 key 和章节页数据装配；直接复制侧栏会造成编译失败或空数据。可以作为后续体验优化候选，但应等待本地 timeline/资源投影边界稳定，或先设计本地适配数据源。

### `72d16f84` / `9cbc1f42` / `4e2afe99` / `99d53074` / `ed0d2399` / `f5f8ff9f` / `6d6c1c86` 章节右侧栏连续调整

这组提交围绕 future sidebar、章节参考面板右移、右栏 tabs、独立滚动区和列宽对齐展开，依赖上游 `ChapterExecutionInsightsSidebar`、`ChapterExecutionReferencePanel`、timeline 面板和未来动态数据源。当前本地章节工作区保留自己的章节执行面板与资产入口，且尚未完成 future/timeline 数据投影适配；直接同步会大幅改变章节页布局并可能造成空侧栏。后续应在 timeline/资源投影稳定后作为章节工作区 UX 阶段单独评估。

### `1450fe1b feat: harden character facts and chapter titles`

该提交强化角色硬事实和章节标题，但包含 Prisma 字段、Prompt、章节上下文、角色准备和标题多样性策略。可以拆出 prompt/schema 或标题策略的小块继续审查；涉及 schema 的部分必须走迁移设计。

### `9f5fb0cd feat(image): support custom image providers`

该提交把自定义图片供应商接入设置页、图片路由和角色图像生成流程。功能有潜在商业价值，但会影响供应商配置、图片模型选择、成本暴露和前端设置页；本地当前重点是文本模型、卡密充值和桌面发布，图片供应商扩展应与封面生成和图片成本策略一起设计，不能只按上游设置页复制。

### 桌面发布、README 状态和上游版本号提交

`7298e7c8`、`bff7f000`、`6b2a7306`、`23ede003`、`69cedb0a`、`a22db04a`、`efa11eaf`、`dea07265`、`ce4d92b6`、`18d91fce`、`f7609721`、`e38d7bc7`、`6ed5e15a`、`b0dd3ff7`、`d6725d27`、`4ba82892` 这类提交不应按上游直接同步。它们主要调整上游 README、release notes、上游桌面版本号和 GitHub Release workflow。当前本地桌面发布通道已经指向 `CDYYY98/AI-`，产品名是 `图灵网文工作台`，`desktop/package.json` 版本由本地正式发布节奏控制；同步上游 owner/repo、默认产品名或版本号会破坏本地客户端自动更新和品牌配置。后续只可按需吸收通用 workflow 技术点，例如 Node 24 或打包校验步骤，不能同步上游发布身份。

### `a20db70e feat(dev-tools): 新增章节正文一键重置功能供测试重跑`

该提交提供章节正文重置入口，属于明显的破坏性测试工具。按本地数据保护规则，任何删除正文、重置章节内容、清理生成结果的能力都必须先有明确备份、恢复验证、权限隔离和用户显式批准；不能在面向用户的小说工作区默认加入“一键重置正文”。如后续确实需要，应单独做管理员开发工具，并强制备份校验后才能执行。

## 当前结论

截至本检查点，继续同步时应优先挑选不含迁移、可独立验证、不会覆盖本地商业能力的修复。世界观、封面、timeline constraint 和章节运行时 finalization 均应拆成单独功能阶段，不应直接 merge 或 cherry-pick。
