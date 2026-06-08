# 首屏读路径性能边界

## Background

首页、侧边栏、任务恢复提醒、自动导演跟进概览和模型选择初始化都会在用户刚打开应用时触发。如果这些接口顺手执行完整任务详情组装、自动恢复校正、远程模型探测或外部网关访问，首屏体验会被最慢的后台任务或网络环境拖住。

这类读路径的目标是快速给用户一个可操作摘要，而不是在读取阶段完成所有修复、探测和诊断。

## Decision

首屏摘要接口必须优先读取本地轻量投影。需要副作用的工作，例如恢复任务、愈合自动导演任务状态、刷新远程模型目录、检查余额或组装完整任务详情，应该放在明确的详情页、显式操作或后台流程中。

自动导演跟进概览可以跳过状态愈合，只展示当前可见投影；进入详情或执行继续、重试、恢复时，再做必要的状态校正。待恢复任务列表应直接从各任务表投影摘要，不逐条调用任务中心完整详情适配器。

## Current Rule

- `GET /api/settings/api-keys` 只返回本地配置摘要，不主动访问远程模型目录。
- 待恢复任务列表只读取队列状态、当前阶段、当前条目、错误摘要和来源入口等轻量字段。
- 自动导演跟进概览默认不触发 `healAutoDirectorTaskState`；详情页和操作入口可以按需触发状态校正。
- 批量读取最近自动审批记录时，应使用一次按小说集合查询，再在内存中限制每本小说最多 10 条，避免按小说数量放大数据库请求。

## Failure Modes

- 打开应用后首页或侧边栏明显变慢时，优先检查摘要接口是否重新调用了完整任务详情、状态愈合或远程探测。
- 如果恢复提醒数量多时接口耗时线性升高，检查是否又按每个任务调用任务中心详情适配器。
- 如果自动导演跟进概览刷新触发后台状态变化，说明展示读路径和修复写路径重新混在一起，需要移回详情或操作入口。

## Related Modules

- `server/src/services/task/RecoveryTaskService.ts`
- `server/src/services/task/autoDirectorFollowUps/AutoDirectorFollowUpService.ts`
- `server/src/services/task/autoDirectorFollowUps/autoDirectorAutoApprovalAudit.ts`
- `server/src/routes/settings.ts`
- `client/src/components/layout/LLMSelectionBootstrap.tsx`
- `client/src/components/layout/TaskRecoveryContext.tsx`
- `client/src/components/layout/Sidebar.tsx`
