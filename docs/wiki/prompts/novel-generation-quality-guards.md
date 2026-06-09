# 小说生成质量守卫机制

## Background

长篇自动生成容易出现几类重复和污染问题：世界设定来源与当前故事时空不匹配、已经完成的过程性目标被反复追求、章节开头复用相同场景模式、卷级关键节点被提前写完。

这些问题不能只靠前端提示或生成后人工修补。写章 Prompt 必须能接收明确的上下文守卫，让模型在生成前知道哪些内容已经完成、哪些场景模式不能重复、哪些卷级里程碑还不到兑现窗口。

## Current Rule

当前本地阶段只落地低风险的 Prompt/context 契约，不引入数据库迁移，也不加入固定关键词扫描工具。

### 世界切片污染防止

`storyWorldSlice.generate` Prompt 会要求自由文本字段避免塞入与当前故事时空不匹配的世界专有名词。如果上游世界资产里的地点、势力或术语不适合这本书，只保留抽象压力、规则或叙事功能。

结构化引用仍应通过 `appliedRules`、`activeForces`、`activeLocations` 的 id 字段表达，避免把完整世界百科直接污染章节写作上下文。

### 已完成里程碑

`ChapterWriteContext.completedMilestones` 表示写作前已经明确完成的过程性目标，例如已经拿到证件、已经签约、已经确认某个情报。

当该字段非空时，`chapter_mission` block 会渲染 `Already completed — do NOT re-pursue or re-trigger`，并且章节 writer 系统提示词禁止重复追求这些目标。

### 场景模式黑名单

`ChapterWriteContext.recentScenePatterns` 表示近期已经出现过的时间、地点、动作组合。

当该字段非空时，`opening_constraints` block 会渲染 `Scene pattern blacklist`，writer 不得复用这些完全相同的场景模式作为章节开局或主要推进方式。

### 卷级关键节点守卫

`VolumeWindowContext.keyMilestoneGuards` 用于表达卷内关键事件的目标章节范围、状态和节奏说明。渲染时会过滤 `status=done` 的守卫，只把未完成或进行中的守卫写入 `volume_window` block。

这让 writer 能看到“哪些里程碑还不能一次性写完”，减少提前耗尽卷目标的问题。

## Boundary

- 这些字段默认都是空数组；为空时不改变现有生成行为。
- 本阶段只建立 Prompt 消费契约和渲染测试，数据填充仍应由章节规划、章节摘要或状态同步服务在后续阶段接入。
- 上游的 `audit_chapter_continuity` 固定关键词扫描工具未直接同步。若后续要做连续性诊断，应优先设计 AI-first 结构化审查或把确定性扫描限定为辅助证据，不能让固定关键词表成为核心创作判断。
- 上游的 `rebuild_story_world_slice` agent 工具未在本阶段同步，避免把世界切片强制刷新入口和本地现有世界观工作流混在同一个小改里。

## Failure Modes

- 如果生成仍重复已完成目标，先检查 `ChapterWriteContext.completedMilestones` 是否实际填入并出现在 `chapter_mission` block。
- 如果开头场景继续重复，先检查 `recentScenePatterns` 是否实际填入并出现在 `opening_constraints` block。
- 如果卷级高潮被提前写完，先检查 `keyMilestoneGuards` 是否由卷规划服务填入，并确认目标章节范围和 `status` 是否正确。
- 如果世界切片仍带入不匹配专有名词，先检查世界结构化数据是否把专有名词限制在可引用 id 内，再考虑是否需要手动刷新世界切片。

## Related Modules

- `shared/types/chapterRuntime.ts`
- `server/src/prompting/prompts/novel/chapterLayeredContext.ts`
- `server/src/prompting/prompts/novel/chapterWriter.prompts.ts`
- `server/src/prompting/prompts/storyWorldSlice/storyWorldSlice.prompts.ts`
- `server/tests/chapterLayeredContext.test.js`
