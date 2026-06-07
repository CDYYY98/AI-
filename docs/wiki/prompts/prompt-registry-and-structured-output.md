# Prompt Registry 与结构化输出

## 背景

项目是 AI-native 小说生产系统。意图识别、任务分类、规划、路由、工具选择、质量判断和修复建议都应依赖 AI 的结构化理解，而不是关键词和硬编码分支。

历史上，产品级 prompt 容易散落在 service 里，伴随本地 `JSON.parse`、try/catch 修复和局部 normalization。这样会让结构化输出、repair、语义重试、上下文要求和治理元数据无法统一审计。

## 决策

`server/src/prompting/` 是新增产品级 prompt 的唯一治理入口。产品级 prompt 必须作为 `PromptAsset` 注册，并通过统一 runner 执行。结构化输出使用 schema、JSON repair 和 semantic retry 处理；确定性代码只做输入校验、安全边界和已结构化输出后的处理。

## 当前规则

- 新增产品级 prompt 必须放在 `server/src/prompting/prompts/<family>/`。
- 新增产品级 prompt 必须在 `server/src/prompting/registry.ts` 注册。
- `PromptAsset` 必须提供 `id`、`version`、`taskType`、`mode`、`language`、`contextPolicy`、`render()`，结构化 prompt 还必须有 `outputSchema` 或等价校验。
- 创作语义判断必须 AI-first。角色身份承接、隐藏身份、题材理解、故事职责、质量风险、下一步动作、修复建议等产品语义，不得用正则、关键词表、固定字符串片段、字符比例或手写分支来判断或阻断流程；这类能力应进入 PromptAsset、结构化输出 schema、semantic retry 或 AI 评估链路。
- 确定性代码只允许处理结构契约和安全边界，例如必填字段、枚举归一、ID 是否存在、数组长度、权限和数据保护。确定性质量闸门可以指出“缺少 protagonist / gender / 必填字段”这类结构问题，但不能判断“是否承接了某个题材身份”“名字是否像功能位”“语言是否像英文残留”等创作语义。
- 结构化输出使用 `runStructuredPrompt`，纯文本使用 `runTextPrompt`，流式能力使用对应 stream runner。
- JSON 解析、schema 校验失败由 repair policy 处理；JSON 合法但业务语义不合格由 semantic retry 处理。
- Prompt 中展示给模型的状态名、枚举名和示例必须与 schema 可接受值一致。上下文里如果存在历史别名或业务口语值，例如 `active` 表示已推进但未兑现，应在 prompt 明确转换规则，并在 schema preprocess 中做确定性归一，不能把同一类别名反复交给 LLM repair。
- 结构化输出后的确定性归一只用于字段别名、枚举别名和兼容旧形状，例如把 `pacing` 映射为接收闸门的 `plot`、把 payoff `active` 映射为 `pending_payoff`、把字符串风险转成 `{ code, severity, summary }` 对象。不能用这种归一替代 AI 对剧情事实、风险等级或下一步动作的判断。
- 章节接收闸门、时间线抽取和章节资产抽取都属于高频后台结构化 prompt，示例必须覆盖非空对象数组。`missingObligations`、`hooks/possibleHooks`、资源变化等字段不能只给空数组示例，否则模型在发现真实问题时容易自造字段或把对象压成字符串。
- 事实抽取类 prompt 不继承创作温度。时间线、章节资产 delta、接收闸门等用于审校或账本写入的调用应在 service 层钳制低温，避免自动导演高创造温度放大 schema drift。
- JSON repair 日志应保留 `promptId`、`schemaPaths`、`repairAttempt` 和 `validationError`。诊断 repair 率时先按 `promptId + schemaPath` 聚合，判断是 prompt 示例、枚举合同、上下文污染还是模型路由问题。
- editable slots 只能开放低风险表达层内容，不能覆盖 schema、postValidate、taskType、mode、contextPolicy、工具目录、审批边界或 required context。
- 旧未纳管 prompt 路径被触碰时，默认先迁入 registry，再扩展能力。

批准例外：

- `server/src/llm/structuredInvoke.ts` 内部 JSON repair。
- `server/src/llm/connectivity.ts` 这类连通性探针。
- 阶段性保留的 stream bridge，例如 `graphs/*`、`routes/chat.ts`、`services/novel/runtime/*`。

## 示例

推荐做法：

- 新增章节接收闸门时，先定义结构化输出 schema，再注册 `PromptAsset`，最后由服务消费结构化结果。
- 新增意图识别能力时，扩展 AI schema 和工具合同，不加关键词 fallback。
- 角色阵容质量不足时，修角色准备 PromptAsset、结构化 schema、postValidate / semantic retry 或上下文块，不在 service 中新增关键词、正则或字符比例判断。
- Prompt Workbench 预览只读返回 messages、上下文块、缺失 required groups 和 trace preview，不保存运行时 override。

禁止做法：

- 在 service 内直接拼 `systemPrompt/userPrompt` 后调用裸 LLM。
- 在业务文件里新增一套本地 JSON 修复和 schema 分支。
- 让 Prompt Override 直接替换整段系统提示词或结构化输出 schema。
- 在角色准备、章节规划、意图识别、质量检查、RAG 选择或自动导演路由中，用固定词表、正则、字符比例或特殊字符串分支替代 AI 结构化理解。

## 失败模式

- 模型返回 JSON 不稳定：先检查 schema、provider JSON 能力和 repair policy，不在业务 service 里补局部解析。
- 同一 prompt 频繁进入 JSON repair：检查日志里的原始字段值是否来自上下文或示例中的非 schema 值。如果模型只是复用了 prompt 中出现的别名，应先修 prompt/schema 合同；如果输出语义完整但字段名是常见别名，应在 PromptAsset schema 层归一，而不是让后台任务无限重试。
- Prompt Catalog 缺上下文预览：补 `contextRequirements`，不要让预览临时查数据库。
- 意图识别漏判：修 PromptAsset、输入上下文、schema 或工具目录，不加关键词路由。
- 角色阵容看起来没有承接身份、题材或隐藏真相：先查角色准备 PromptAsset、上下文块和结构化输出，不加本地正则抽取身份，不用关键词判断候选能否自动应用。

## 相关模块

- `server/src/prompting/`
- `server/src/prompting/core/promptRunner.ts`
- `server/src/prompting/registry.ts`
- `server/src/llm/structuredInvoke.ts`
- `server/src/llm/capabilities.ts`
- `server/src/agents/`
- `server/src/creativeHub/`

## 来源文档

- [Prompting Registry](../../../server/src/prompting/README.md)
- [Prompt Governance Audit 2026-05-08](../../checkpoints/prompt-governance-audit-2026-05-08.md)
- [提示词工作台、上下文装配与统一步骤运行时方案](../../plans/prompt-workbench-context-and-step-runtime-plan.md)
- [LLM Schema Refactor Checkpoint](../../checkpoints/llm-schema-refactor-checkpoint.md)
