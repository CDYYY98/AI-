import type { TaskKind } from "@ai-novel/shared/types/task";
import { prisma } from "../../db/prisma";

type TaskArchiveScope = {
  userId?: string | null;
};

function normalizeUserId(scope?: TaskArchiveScope): string | null {
  return scope?.userId?.trim() || null;
}

function buildScopedArchiveWhere(taskKind: TaskKind, taskId: string, scope?: TaskArchiveScope) {
  const userId = normalizeUserId(scope);
  return {
    taskKind,
    taskId,
    ...(userId
      ? {
        OR: [
          { userId },
          { userId: null },
        ],
      }
      : { userId: null }),
  };
}

function buildScopedArchiveListWhere(taskKind: TaskKind, scope?: TaskArchiveScope) {
  const userId = normalizeUserId(scope);
  return {
    taskKind,
    ...(userId
      ? {
        OR: [
          { userId },
          { userId: null },
        ],
      }
      : { userId: null }),
  };
}

export async function archiveTask(taskKind: TaskKind, taskId: string, scope: TaskArchiveScope = {}): Promise<void> {
  const userId = normalizeUserId(scope);
  const existing = await prisma.taskCenterArchive.findFirst({
    where: {
      taskKind,
      taskId,
      userId,
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.taskCenterArchive.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });
    return;
  }
  await prisma.taskCenterArchive.create({
    data: {
      taskKind,
      taskId,
      userId,
    },
  });
}

export async function isTaskArchived(taskKind: TaskKind, taskId: string, scope: TaskArchiveScope = {}): Promise<boolean> {
  const row = await prisma.taskCenterArchive.findFirst({
    where: buildScopedArchiveWhere(taskKind, taskId, scope),
    select: {
      id: true,
    },
  });
  return Boolean(row);
}

export async function getArchivedTaskIds(taskKind: TaskKind, scope: TaskArchiveScope = {}): Promise<string[]> {
  const rows = await prisma.taskCenterArchive.findMany({
    where: buildScopedArchiveListWhere(taskKind, scope),
    select: {
      taskId: true,
    },
  });
  return rows.map((row) => row.taskId);
}

export async function getArchivedTaskIdsByKind(taskKinds: TaskKind[], scope: TaskArchiveScope = {}): Promise<Map<TaskKind, string[]>> {
  const uniqueTaskKinds = Array.from(new Set(taskKinds));
  const result = new Map<TaskKind, string[]>(uniqueTaskKinds.map((taskKind) => [taskKind, []]));
  if (uniqueTaskKinds.length === 0) {
    return result;
  }

  const userId = normalizeUserId(scope);
  const rows = await prisma.taskCenterArchive.findMany({
    where: {
      taskKind: {
        in: uniqueTaskKinds,
      },
      ...(userId
        ? {
          OR: [
            { userId },
            { userId: null },
          ],
        }
        : { userId: null }),
    },
    select: {
      taskKind: true,
      taskId: true,
    },
  });

  for (const row of rows) {
    const bucket = result.get(row.taskKind as TaskKind);
    if (bucket) {
      bucket.push(row.taskId);
    }
  }
  return result;
}

export async function getArchivedTaskIdSet(taskKind: TaskKind, taskIds: string[], scope: TaskArchiveScope = {}): Promise<Set<string>> {
  if (taskIds.length === 0) {
    return new Set<string>();
  }

  const rows = await prisma.taskCenterArchive.findMany({
    where: {
      ...buildScopedArchiveListWhere(taskKind, scope),
      taskId: {
        in: taskIds,
      },
    },
    select: {
      taskId: true,
    },
  });
  return new Set(rows.map((row) => row.taskId));
}
