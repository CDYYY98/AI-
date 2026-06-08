import {
  inspectFreshScopedChapterExecutionProgress,
  loadDirectorModuleState,
} from "../directorWorkflowStepShared";
import type { WorkflowStepExecutionContext } from "../WorkflowStepModule";

export function chapterHasCompletedStage(
  chapter: { completedStages?: string[] | null },
  stage: string,
): boolean {
  return Array.isArray(chapter.completedStages) && chapter.completedStages.includes(stage);
}

export async function isAutoQualityReviewDisabled(context: WorkflowStepExecutionContext): Promise<boolean> {
  const { state, request } = await loadDirectorModuleState(context);
  const seedPayload = state.seedPayload as {
    autoExecution?: { autoReview?: unknown } | null;
    autoExecutionPlan?: { autoReview?: unknown } | null;
  };
  return seedPayload.autoExecution?.autoReview === false
    || seedPayload.autoExecutionPlan?.autoReview === false
    || request?.autoExecutionPlan?.autoReview === false;
}

export async function inspectScopedChapterExecutionProgress(context: WorkflowStepExecutionContext) {
  const { state, novelId, request } = await loadDirectorModuleState(context);
  return inspectFreshScopedChapterExecutionProgress({ novelId, state, request });
}
