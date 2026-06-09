# 章节质量债务归因

## Background

自动导演允许在部分章节质量修复不彻底时先记录质量债务并继续后续章节。这样可以避免整本书生产被单章卡死，但如果系统只知道“这一章没有完全达标”，后续开发和排障仍然很难判断问题来自章节计划、修复器、patch 锚点还是长度控制。

质量债务归因的目标是把这些失败原因结构化记录下来，让后续诊断能看到可聚合的根因分布，而不是只依赖零散日志或人工读正文。

## Current Rule

当章节 runtime 最终未通过质量检查时，会在 `PipelineRuntimeResult.qualityDebtAttribution` 中记录以下数据：

- `firstFailureIssueCodes`：首次质量检查失败的 issue code。
- `secondFailureIssueCodes`：修复后再次失败的 issue code。
- `firstFailureClassificationCode`：首次失败分类，例如 `draft_obligation_unmet` 或 `replan_required`。
- `patchAnchorFailed`：局部 patch 修复是否因为锚点无法安全应用而退到重写。
- `sameObligationRepeated`：首次和二次失败 code 是否完全相同。
- `planMisaligned`：失败是否指向章节义务不可达或计划窗口错位。
- `lengthVsContentDrift`：是否从纯长度问题漂移到内容问题。
- `missingObligationKinds`：首次失败缺失的义务种类。

章节质量闭环记录时，会把这些数据写入 `chapter.riskFlags.qualityLoop.qualityDebtAttribution`。如果章节最终以继续执行方式记录质量债务，还会写入 `terminalAction=defer_and_continue`。

## Diagnosis Tool

`analyze_quality_debt_attribution` 是只读 agent 工具，用于扫描指定小说和章节范围内的 deferred quality debt 章节，输出：

- 根因 A/B/D/E/unknown 占比。
- 失败 issue code TOP 列表。
- 缺失义务种类 TOP 列表。
- 每章归因明细。
- 面向后续修复方向的汇总建议。

该工具不调用 LLM，不修改数据，不做创作判断。它只聚合已经由章节 runtime 记录的结构化事实。工具选择仍应由现有 AI planner 完成，确定性代码只负责读数和统计。

## Root Cause Labels

- A：同一义务重复失败，说明修复器没有有效解决已知义务。
- B：patch 锚点失配，说明局部修复无法安全应用到当前正文版本。
- D：义务不可达或计划错位，说明章节任务单、当前窗口或正文进度之间存在结构性冲突。
- E：长度与内容问题漂移，说明修复一个长度问题后引出了内容质量问题。
- unknown：旧数据或缺少足够归因字段。

## Boundary

- 归因字段只在章节最终未通过时生成；正常通过章节不写质量债务归因。
- 旧章节没有归因字段时不得强行推断，只归为 `unknown`。
- 归因数据不是自动重规划命令，只是后续 AI 决策和开发排障的证据。
- 不新增数据库字段，当前阶段复用 `chapter.riskFlags` JSON，避免迁移风险。

## Failure Modes

- 如果工具显示大量 `unknown`，先确认这些章节是否是在归因机制上线前生成，或 `terminalAction` 是否没有写入。
- 如果 D 占比高，优先检查章节任务单和当前卷窗口是否超出本章可完成范围。
- 如果 B 占比高，优先检查 patch prompt 的 `targetExcerpt` 是否过短、过泛或与正文版本不同步。
- 如果 A 占比高，优先检查修复 prompt 是否拿到了明确的结构化义务和失败 code。
- 如果 E 占比高，优先拆开长度修复和内容修复预算，避免一次修复承担互相冲突的目标。

## Related Modules

- `server/src/services/novel/runtime/chapterRuntimePipeline.ts`
- `server/src/services/novel/quality/ChapterQualityLoopService.ts`
- `server/src/services/novel/novelCorePipelineService.ts`
- `server/src/agents/tools/bookAnalysisTools.ts`
- `server/tests/chapterRuntimePipeline.test.js`
- `server/tests/chapterQualityLoop.test.js`
