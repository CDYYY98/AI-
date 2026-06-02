# 桌面客户端发布与更新策略

## Background

桌面客户端面向正式用户分发时，用户需要一个稳定、可重复更新的安装路径。便携版适合临时测试，但不会进入自动更新链路，容易让普通用户在“下载新版、替换旧文件、保留数据”之间产生误解。

## Decision

正式分发以 Windows `Setup.exe` 安装版为主。默认打包目标只产出安装版，并通过 GitHub Releases 提供更新源。便携版只作为特殊场景的手动替换方式，不作为正式用户入口。

## Current Rule

- 正式用户下载 `Setup.exe` 安装版。
- 应用内更新入口放在个人中心，展示当前版本、更新状态、可用版本和检查更新按钮；管理员系统设置页也可以保留同一张更新卡片。
- 安装版可检查 GitHub Releases，发现新版后由用户确认下载，下载完成后重启安装。
- 便携版不进入自动更新链路；需要使用便携版时，应明确告知用户它需要手动替换。
- 发布新桌面客户端时，必须提升 `desktop/package.json` 的稳定语义化版本号，并使用匹配的 `vX.Y.Z` 标签发布。

## Failure Modes

- 如果用户使用便携版，更新卡片会提示手动替换，不能承诺自动更新。
- 如果发布包缺少 `app-update.yml`，安装版无法从发布通道检查更新。
- 如果 GitHub Release 标签和 `desktop/package.json` 版本不一致，更新源会变得不可预测，应停止发布流程并先修正版本。

## Related Modules

- `desktop/electron-builder.config.cjs`
- `desktop/src/runtime/updater.ts`
- `client/src/components/layout/DesktopUpdateCard.tsx`
- `scripts/trigger-desktop-release.cjs`

## Official Server Packaging

正式用户使用的安装包必须连接线上服务端，而不是启动客户端内置的本地服务。注册验证码、账号数据、卡密兑换、模型额度和调用日志都属于运营侧统一数据，打包时应通过正式打包入口写入 `AI_NOVEL_API_BASE_URL`，当前默认地址为 `http://118.190.162.251:3000/api`。

如果打包日志出现 `deploy.json written (no remote API configured)`，该安装包只能作为本地离线测试包，不能发给正式用户。正式安装包应使用 `pnpm run dist:desktop:nsis:official` 生成；如正式服务器地址变化，可在打包环境中显式设置 `AI_NOVEL_API_BASE_URL` 覆盖默认值。

更新清单里的 `path` / `url` 必须和实际上传到 GitHub Release 的安装包文件名一致。Windows 打包层和 NSIS 目标层都应使用同一套稳定英文 `artifactName`，staged 桌面包名也应保持无作用域英文包名；否则客户端可能能发现新版本，但下载时找不到对应安装包。

下载完成后应弹出原生确认框，让用户明确选择“现在安装”或“稍后”。页面上的“重启安装”按钮作为备用入口保留，但不应要求用户理解下载完成后还要主动寻找下一步。

## Release Repository Ownership

桌面客户端的正式发布源默认使用当前商业分发仓库 `CDYYY98/AI-`。安装包内的 `app-update.yml`、Electron Builder 的 GitHub publish 配置、GitHub Actions 发布工作流和 README 下载入口必须指向同一个仓库，保证用户下载、客户端检查更新和自动发布看到的是同一套 Release。

只有在明确做临时验证时，才通过 `AI_NOVEL_GITHUB_OWNER` 和 `AI_NOVEL_GITHUB_REPO` 覆盖发布目标。覆盖发布目标生成的安装包不应发给正式用户，除非对应 GitHub Release 通道也已经准备好同版本安装包和更新清单。
