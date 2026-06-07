# 自动导演 Token 预算保护

## 背景

自动导演会通过统一章节流水线连续生成、审校、修复和同步章节资产。一次正常章节生成可能包含正文、接收闸门、补丁修复、时间线和章节资产抽取等多次 AI 调用。如果某一章反复修复、旧任务用量被错误合并，系统可能持续消耗模型额度，作者却只看到任务还在运行。

因此自动导演需要在运行时记录章节级 AI 用量，并用熔断器保护异常消耗。这个规则属于执行安全边界，不是前端提示或普通日志。

## 当前规则

- 只有 `auto_director` lane 的章节流水线会写入导演运行遥测；普通手动章节生成仍保留原有任务和用户扣费追踪，不强制进入导演预算检查。
- 章节预算检查按当前自动导演任务的 `taskId` 聚合，不使用“小说所有历史记录 + 当前任务”的 OR 查询。历史取消任务、失败任务和旧运行记录不能触发当前任务的章节预算熔断。
- 单章总用量达到 `80_000` tokens 时，自动导演打开 `usage_anomaly` 熔断器，暂停后续自动执行，避免继续异常消耗。
- 单次 AI 调用仍保留独立的 `150_000` tokens 异常阈值，用于发现单步输出或上下文异常膨胀。
- 熔断状态必须写入 `DirectorCircuitBreakerState`，由任务 checkpoint、运行投影和前端恢复入口共同展示；不要只在日志里记录。

## 设计原因

单章正常修复一轮大约会消耗 55k 到 60k tokens。阈值设为 80k，是为了允许一次合理修复，同时防止同一章进入无意义的多轮反复生成。预算检查使用当前任务范围，是为了避免旧任务累计用量误伤正在正常执行的新任务。

## 相关模块

- `server/src/llm/usageTracking.ts`
- `server/src/services/novel/novelCorePipelineService.ts`
- `server/src/services/novel/director/automation/novelDirectorAutoExecutionCircuitBreakerRuntime.ts`
- `server/src/services/novel/director/runtime/DirectorCircuitBreakerService.ts`
- `server/src/services/novel/director/runtime/DirectorUsageTelemetryQueryService.ts`
- `shared/types/directorRuntime.ts`
