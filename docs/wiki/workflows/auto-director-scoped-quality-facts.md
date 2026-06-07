# 自动导演章节质量事实范围

## 背景

自动导演可以只执行一本书中的某个章节范围。质量审校、章节修复和质量修复步骤如果读取整本书的 drafted/reviewed/needsRepair 统计，范围外的旧章节会误导当前任务：例如第 1 章缺少审校事实，却让第 2-3 章的自动执行任务看起来还没完成审校。

## 当前规则

- 章节执行、章节审校、章节修复和质量修复的事实判断必须优先使用当前自动执行范围。
- 当前范围来自 `autoExecutionPlan` 或运行状态中的章节范围；没有显式范围时才退回整本书进度。
- 质量审校完成度按范围内章节的 `audit_completed` 阶段统计，不使用整本书的全局 repair summary。
- 章节修复和质量修复的 `needsRepairChapters` 只统计当前范围内章节，范围外历史待修状态不能阻塞当前批次。

## 相关模块

- `server/src/services/novel/director/workflowStepRuntime/directorExecutionStepModules.ts`
- `server/src/services/novel/director/workflowStepRuntime/directorWorkflowStepShared.ts`
- `server/tests/directorWorkflowStepModules.test.js`
