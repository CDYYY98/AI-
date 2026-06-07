# 自动导演实时进度展示

## 背景

自动导演运行时，前端会同时收到任务状态、运行投影、章节标题质量提醒、失败摘要和恢复提示。章节标题提醒有价值，但它不是实时执行状态。如果在任务仍在运行或排队时让标题提醒覆盖主容器，用户会误以为自动导演已经停下，需要先处理标题问题。

## 当前规则

- 自动导演主展示状态以实时运行态优先。任务正在运行或排队时，进度面板应继续显示运行进度。
- 章节标题提醒只在任务不处于 live progress 状态时作为待处理提醒展示。
- 标题提醒可以保留为后续可处理事项，但不能覆盖主进度、主容器模式、主按钮和当前执行动作。
- 如果任务已经失败、暂停或进入恢复状态，标题提醒才可以参与决定是否展示修复入口。

## 相关模块

- `client/src/pages/novels/components/NovelAutoDirectorProgressPanel.tsx`
- `client/src/pages/novels/components/novelAutoDirectorProgressPanelQueryKeys.test.mjs`
