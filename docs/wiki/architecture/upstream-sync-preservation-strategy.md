# 上游同步保护策略

## Background

本项目基于上游 `ExplosiveCoderflome/AI-Novel-Writing-Assistant` 持续演进，但本地版本已经加入商业化、桌面客户端、自有发布通道、账号分层模型路由、卡密充值、正式邮箱配置和本地部署适配。同步上游时，目标不是让代码树和上游完全一致，而是在保留本地产品能力的前提下吸收有价值改动。

直接 merge 上游主干会把本地登录、计费、模型、充值、桌面打包和部署配置置于冲突中心，也会把上游的大规模 Prisma 迁移、世界观重构或章节运行时拆分一次性带入，风险不可控。

## Decision

上游同步采用“本地版本为主、按提交审查、分阶段移植”的策略。

- 只移植能明确提升当前产品稳定性、性能或新手完成整本小说能力的改动。
- 对商业化、账号、模型、充值、桌面发布、自有 GitHub Release 和正式部署相关文件，默认保持本地实现。
- 对涉及 Prisma schema、迁移、核心运行时拆分、世界观流程重构的大改动，必须单独立项、备份数据库、设计兼容策略，并经过功能验证后再进入主分支。
- 对已在本地以不同实现覆盖的上游修复，只记录审查结论，不重复搬代码。

## Protected Local Areas

以下模块属于本地产品能力边界，同步上游时不得被上游同名实现直接覆盖：

- 登录、注册、验证码和账号身份：`client/src/pages/LoginPage.tsx`、`server/src/routes/auth.ts`、`server/src/services/auth/`
- 账号分层模型路由和后台模型配置：`client/src/pages/AdminModelsPage.tsx`、`server/src/services/settings/AccountTierModelSettingsService.ts`、模型路由相关服务
- 额度、扣费、充值码和个人中心购买入口：`client/src/pages/ProfilePage.tsx`、`client/src/pages/AdminRechargeCodesPage.tsx`、`server/src/routes/rechargeCodes.ts`
- 桌面正式版打包、自有更新源和 GitHub Release 通道：`desktop/`、`.github/workflows/desktop-*.yml`、`scripts/dist-desktop-official.cjs`
- 正式环境配置、邮箱服务、本地部署脚本和服务器适配

## Sync Categories

### Safe To Port Incrementally

- 不改数据库结构的运行时 bug 修复。
- 只增加幂等缓存、轻量读路径、状态投影修正或测试覆盖的改动。
- Prompt Registry 内已注册 prompt 的 schema 兼容、输出归一化和治理测试。
- 与本地商业功能无交集的前端交互小改。

### Needs Design Phase

- 世界观生成工作流、本书世界实例、世界资产和世界上下文网关。
- 章节运行时大拆分，例如 package builder、content finalization、timeline finalization、quality gate service 全量迁移。
- 任何新增 Prisma model、字段或迁移的同步。
- 会改变自动导演主链路、章节执行链或任务恢复语义的重构。

### Skip Or Reinterpret Locally

- 上游 README 结构调整、版本号 bump、上游仓库发布说明。
- 上游桌面发布通道配置，除非确认仍指向本项目自有仓库。
- 会覆盖本地商业化能力的设置页、账号页、个人中心或后台管理改动。

## Current Rule

每次同步阶段应先做 Git 范围审查，再决定是移植、跳过还是拆成单独设计阶段。可安全移植的阶段完成后必须运行针对性验证并提交；如果阶段有用户可见影响，按 README Release Notes Workflow 更新发布说明；如果沉淀了长期架构规则，更新 wiki。

当上游某个大提交包含少量可独立收益时，可以只移植可独立部分。例如章节接收闸门缓存可以复用本地 `ChapterArtifactSyncCheckpoint`，不需要同步完整上游 timeline finalization 拆分。

## Failure Modes

- 直接 merge 上游导致本地用户登录、模型路由、充值码或桌面更新源丢失。
- 为了同步世界观流程而无备份运行迁移，造成正式数据不可恢复。
- 把上游结构拆分当成普通 bug fix 合入，导致本地自动导演、章节执行和任务中心读取不同运行时状态。
- 重复移植本地已经覆盖的修复，增加代码分叉和测试噪音。

## Related Modules

- `docs/wiki/architecture/read-path-performance-boundaries.md`
- `docs/wiki/workflows/chapter-production-chain.md`
- `docs/wiki/prompts/prompt-registry-and-structured-output.md`
- `server/src/services/novel/runtime/`
- `server/src/services/novel/director/`
- `server/src/services/settings/`
- `desktop/`
