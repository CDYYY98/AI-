# 图片生成厂商边界

## Background

角色形象图生成需要同时支持内置模型厂商和管理员配置的 OpenAI 兼容中转。文本模型的可用性不能直接代表图片生成可用性，因为同一个厂商可能只提供文本模型，也可能需要单独填写图片模型名称。

## Decision

图片生成能力由后台厂商配置中的 `currentImageModel` 决定。只要厂商已启用、文本基础配置有效，并且保存了非空图片模型，前端就可以把它列为角色形象图生成厂商。

## Current Rule

- 内置厂商可以提供预设图片模型选项，例如 OpenAI、SiliconFlow、Grok。
- 自定义厂商没有固定图片模型列表，管理员需要手动填写 OpenAI 兼容图片模型名称。
- 自定义厂商可以不填写 API Key，适用于本地网关或不要求鉴权的中转服务。
- 服务端调用图片接口时使用厂商的 API 地址，并请求 `/images/generations`。
- 没有图片模型的厂商只参与文本模型调用，不进入角色形象图生成列表。

## Failure Modes

- 如果自定义厂商的 API 地址是 `127.0.0.1`，请求会从运行后端服务的机器发出。云端部署时，这个地址指向云服务器自身，不会访问管理员本机。
- 如果图片模型为空，角色形象图弹窗不会展示该厂商。
- 如果网关不兼容 OpenAI 图片接口，服务端会在图片任务中记录接口返回的错误。

## Related Modules

- `server/src/services/settings/ProviderImageSettingsService.ts`
- `server/src/services/image/provider.ts`
- `server/src/routes/settings.ts`
- `server/src/routes/settings/customProviderRoutes.ts`
- `client/src/pages/characters/components/CharacterImageDialog.tsx`
- `client/src/pages/AdminModelsPage.tsx`
