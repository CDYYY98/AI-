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
