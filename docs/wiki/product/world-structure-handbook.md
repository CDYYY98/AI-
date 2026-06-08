# 世界观结构化手册

## Background

世界观既要给用户阅读，也要给角色准备、卷规划、章节写作和知识库检索复用。只保存大段文本会让后续链路难以稳定定位势力、地点、规则和冲突，尤其对新手用户来说，世界观越长越难判断哪些内容能直接用于正文。

## Decision

世界观模块保留旧版文本字段，同时维护结构化手册。结构化手册负责承载规则、阵营、势力、地点、关系和可写入口；旧字段继续作为现有页面和生成链路的兼容输入。

## Current Rule

- `structureJson` 是世界观结构化手册的主数据来源。
- `bindingSupportJson` 保存推荐开局入口、高压势力、地点群和兼容冲突，供小说绑定和章节生产使用。
- 当世界观只有旧版文本或 AI 生成的 JSON 文本时，系统应尽量抽取势力、地点、关键冲突和控制关系，而不是只按分隔符切成散乱列表。
- 结构化世界观保存后，应同步回 `background`、`cultures`、`magicSystem`、`factions`、`politics`、`geography`、`conflicts`、`history`、`economy` 等旧字段，保证旧页面和既有生成链路仍可读取。
- 结构化关系必须清理悬空引用，例如不存在的势力、地点或控制关系，避免后续可视化和章节上下文读取到无效 ID。

## Failure Modes

- 如果世界观页面有内容但章节链路引用不到，先检查结构化手册是否为空，以及结构化内容是否已同步回旧字段。
- 如果可视化图谱出现孤立节点或无效边，检查 `representativeForceIds`、`controlledLocationIds`、`controllingForceIds` 和地点连接是否指向存在的实体。
- 如果 AI 输出的旧字段是 JSON 字符串，转换器应优先读取其中的 `factions`、`primaryConflicts`、`flashpoints`、`locations` 等结构，而不是把整段 JSON 当纯文本。

## Related Modules

- `shared/types/world.ts`
- `server/src/services/world/worldStructure.ts`
- `server/src/services/world/worldServiceShared.ts`
- `server/src/services/world/worldStructureWorkspace.ts`
- `server/tests/worldStructure.test.js`
