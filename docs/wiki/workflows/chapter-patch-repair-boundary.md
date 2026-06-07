# 章节局部修文边界

## 背景

章节生产链会优先尝试局部 patch repair，以减少整章重写带来的风格漂移和剧情偏移。但局部补丁只适合修复能在正文中准确定位的片段问题。如果把接收闸门不可用、结构化判断缺失或评分系统风险误当成正文片段问题，AI 可能会生成过短、模糊或不存在的 `targetExcerpt`，从而让自动导演因为底层校验错误中断，或者更糟糕地错误修改正文。

## 当前规则

- `targetExcerpt` 必须来自当前正文，并且是完整短句或段落；不得使用单个词语、称谓、标点或过短短语作为定位片段。
- 局部补丁只能处理能唯一定位的正文问题。目标片段缺失、重复出现、过短、补丁无效果或补丁计划无法通过结构校验时，应转为可恢复的修复失败。
- 接收闸门不可用、结构化判断缺失、评分系统风险等问题不是正文片段问题，不应交给 patch repair 硬改正文。
- 对于非正文片段风险，章节流水线应保留当前正文，登记可恢复修复状态，等待重新审校或人工复查。
- 上层质量链路可以在可恢复失败后升级到整章轻修、记录待修状态或暂停给用户处理，但不能让原始 Zod 校验错误直接击穿自动导演任务。

## 相关模块

- `server/src/prompting/prompts/novel/chapterPatchRepair.prompts.ts`
- `server/src/services/novel/chapterPatchRepairService.ts`
- `server/src/services/novel/runtime/chapterRuntimePipeline.ts`
- `server/tests/chapterPatchRepair.test.js`
- `server/tests/chapterRuntimePipeline.test.js`
