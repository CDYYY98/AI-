export type WorkflowTaskVisibilityMode = "task_center" | "follow_up";

export type WorkflowTaskVisibilityRow = {
  id: string;
  lane?: string | null;
  status?: string | null;
  novelId?: string | null;
  title?: string | null;
  novel?: {
    title?: string | null;
  } | null;
  progress?: number | null;
  updatedAt: Date;
};

type WorkflowTaskVisibilityOptions = {
  mode?: WorkflowTaskVisibilityMode;
};

function getWorkflowVisibilityKey(row: WorkflowTaskVisibilityRow): string {
  return row.novelId?.trim() || row.novel?.title?.trim() || row.title?.trim() || row.id;
}

function getFollowUpRank(row: WorkflowTaskVisibilityRow): number {
  if (row.lane === "manual_create" && row.status === "waiting_approval") {
    return 0;
  }
  if (row.lane === "auto_director" && row.status === "waiting_approval") {
    return 1;
  }
  if (row.status === "running" || row.status === "queued") {
    return 2;
  }
  if (row.status === "failed") {
    return 3;
  }
  if (row.status === "cancelled") {
    return 4;
  }
  return 5;
}

function getTaskCenterRank(row: WorkflowTaskVisibilityRow): number {
  if (row.status === "running" || row.status === "queued") {
    return 0;
  }
  if (row.status === "waiting_approval") {
    return 1;
  }
  if (row.status === "failed") {
    return 2;
  }
  if (row.status === "cancelled") {
    return 3;
  }
  return 4;
}

function getProgress(row: WorkflowTaskVisibilityRow): number {
  return typeof row.progress === "number" && Number.isFinite(row.progress) ? row.progress : 0;
}

function compareByFreshness(left: WorkflowTaskVisibilityRow, right: WorkflowTaskVisibilityRow): number {
  const timeDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return right.id.localeCompare(left.id);
}

function compareForFollowUp(left: WorkflowTaskVisibilityRow, right: WorkflowTaskVisibilityRow): number {
  const rankDiff = getFollowUpRank(left) - getFollowUpRank(right);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const progressDiff = getProgress(right) - getProgress(left);
  if (progressDiff !== 0) {
    return progressDiff;
  }

  return compareByFreshness(left, right);
}

function compareForTaskCenter(left: WorkflowTaskVisibilityRow, right: WorkflowTaskVisibilityRow): number {
  const progressDiff = getProgress(right) - getProgress(left);
  if (progressDiff !== 0) {
    return progressDiff;
  }

  const rankDiff = getTaskCenterRank(left) - getTaskCenterRank(right);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  return compareByFreshness(left, right);
}

function compareWorkflowVisibility(
  left: WorkflowTaskVisibilityRow,
  right: WorkflowTaskVisibilityRow,
  mode: WorkflowTaskVisibilityMode,
): number {
  return mode === "task_center"
    ? compareForTaskCenter(left, right)
    : compareForFollowUp(left, right);
}

export function selectVisibleWorkflowRows<T extends WorkflowTaskVisibilityRow>(
  rows: T[],
  options: WorkflowTaskVisibilityOptions = {},
): T[] {
  const mode = options.mode ?? "follow_up";
  const bestByKey = new Map<string, T>();

  for (const row of rows) {
    const key = getWorkflowVisibilityKey(row);
    const current = bestByKey.get(key);

    if (!current || compareWorkflowVisibility(row, current, mode) < 0) {
      bestByKey.set(key, row);
    }
  }

  return [...bestByKey.values()];
}
