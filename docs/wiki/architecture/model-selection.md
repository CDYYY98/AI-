# 当前模型选择与厂商默认模型边界

## 背景

顶部模型选择会影响 Creative Hub、自动导演、章节生产、写法引擎、世界观与角色生成等多条 AI 调用入口。过去如果当前选择只存在浏览器本地存储，项目重启、桌面 userData 变化、浏览器 origin 变化或本地缓存被清理后，界面会回到前端内置默认值。内置默认值又可能落到某个厂商的旧模型名，导致新手用户在不理解模型配置细节时直接遇到不可用模型。

模型厂商配置和当前模型选择必须分清事实源：厂商配置说明“这个厂商如何连接、默认模型是什么、是否可运行”；当前模型选择说明“顶部工作区现在要用哪一个厂商和模型”。

账号商业化后，还需要区分“管理员调试模型”和“普通用户生产模型”。体验账户与创作账户面向不同成本和质量目标，不能依赖普通用户手动选择模型，也不能把前端隐藏控件当成成本控制手段。

## 决策

当前顶部模型选择以服务端 `AppSetting` 为主要事实源。前端状态只作为本次页面运行时的投影，不再用浏览器 localStorage 决定长期默认模型。

当没有已保存的当前选择，或已保存的厂商不可运行时，系统从已配置、启用且有模型列表的厂商中解析一个可运行选择。解析顺序优先尊重用户保存的厂商和模型；只有保存值缺失或失效时，才使用可运行厂商列表的首个候选。

内置厂商的静态模型清单只能作为设置页的候选提示或已有配置的兜底，不应在未保存模型时直接成为顶部当前模型。未保存模型时应优先使用服务端能获取到的模型目录；获取不到目录时，让厂商保持不可运行状态，引导用户在设置页明确选择或填写模型。

普通用户的实际 AI 调用在后端 LLM 创建入口按 `User.accountTier` 套用账户模型策略。`trial` 使用体验账户模型，`paid` 使用创作账户模型。该策略保存到 `AppSetting.llm.accountTierModels`，由管理员在模型管理页维护。管理员账号不走账户模型强制覆盖，保留后台调试和全局默认模型管理能力。

## 当前规则

- 顶部当前模型选择保存到 `AppSetting` 的 `llm.currentSelection`，内容包含 provider、model、temperature 和可选 maxTokens。
- 账户模型策略保存到 `AppSetting` 的 `llm.accountTierModels`，内容包含 `trial` 和 `paid` 两组 provider/model。
- 前端 `useLLMStore` 保存的是运行时投影；页面启动后由设置接口和当前选择接口共同水合。
- `LLMSelector` 只展示已配置、启用、且存在可用模型的厂商。
- 用户在顶部切换厂商或模型后，前端应同步保存到服务端当前选择。
- 普通用户触发 Creative Hub、自动导演、章节生产、写法生成、标题生成等产品级 AI 调用时，后端应优先使用账户模型策略，而不是相信前端传入的模型。
- 管理员账号不被账户模型策略覆盖；如果需要验证普通用户效果，应使用体验或创作账户实际登录测试。
- 模型故障切换链只在主模型失败后接管。故障切换候选应明确跳过账户模型覆盖，避免又回到同一账户模型。
- 没有保存模型的内置厂商不应因为 `PROVIDERS.*.defaultModel` 存在就被视为可运行；需要保存模型、环境模型或可拉取的模型目录。
- 模型路由、结构化兜底和各任务的显式模型覆盖仍属于独立配置；它们不等同于顶部当前模型。

## 示例

推荐做法：

- 用户在顶部从 DeepSeek 切到 Qwen 后，重启项目仍从服务端读取 Qwen 和对应模型。
- 管理员把体验账户设置为 `deepseek-v4-flash`，创作账户设置为 `deepseek-v4-pro` 后，普通用户不需要理解模型差异，系统会按账号类型自动使用对应模型。
- 某厂商配置了 API Key 但没有保存模型时，服务端先尝试读取该厂商模型目录，并把目录首项作为当前可用模型。
- 如果模型目录无法读取，设置页继续允许用户手动填写模型，但顶部不自动选择内置旧模型名。

禁止或不推荐做法：

- 在前端状态初始化时写死 `deepseek/deepseek-chat`。
- 因为某个 provider 的静态 defaultModel 存在，就把未完成配置的厂商显示为可运行。
- 用前端隐藏模型选择器来实现体验/创作账户差异，后端仍允许普通用户传入任意模型。
- 用关键词、特殊厂商分支或一次性迁移脚本掩盖模型目录和当前选择事实源不一致的问题。

## 失败模式

- 重启后顶部模型跳回旧默认：先查 `AppSetting.llm.currentSelection` 是否存在，再查前端是否完成水合，最后查当前厂商是否仍在 `/api/settings/api-keys` 的可运行列表中。
- 顶部显示的模型不可用：检查厂商是否只有静态默认模型、是否没有保存模型、模型目录是否拉取失败。
- 设置页能看到厂商但顶部没有它：确认 `isConfigured`、`isActive` 和模型列表是否同时满足，未配置模型的厂商不应进入顶部候选。
- 普通用户实际调用了错误模型：先查 `User.accountTier`，再查 `AppSetting.llm.accountTierModels`，最后查 LLM usage tracking context 是否带上了当前用户。
- 故障切换后仍回到失败模型：确认 fallback resolve 时跳过了账户模型策略覆盖。

## 相关模块

- `server/src/services/settings/LLMSelectionSettingsService.ts`
- `server/src/services/settings/AccountTierModelSettingsService.ts`
- `server/src/routes/settings/llmSelectionRoutes.ts`
- `server/src/routes/admin.ts`
- `server/src/routes/settings.ts`
- `server/src/llm/factory.ts`
- `server/src/llm/modelCatalog.ts`
- `server/src/llm/usageTracking.ts`
- `client/src/components/layout/LLMSelectionBootstrap.tsx`
- `client/src/components/common/LLMSelector.tsx`
- `client/src/pages/AdminModelsPage.tsx`
- `client/src/store/llmStore.ts`

## 来源文档

- [模块边界与文档治理](./module-boundaries.md)
- [项目协作规则](../../../AGENTS.md)
