const test = require("node:test");
const assert = require("node:assert/strict");
const { prisma } = require("../dist/db/prisma.js");
const { VolumeChapterSyncService } = require("../dist/services/novel/volume/VolumeChapterSyncService.js");
const {
  buildVolumeWorkspaceDocument,
} = require("../dist/services/novel/volume/volumeWorkspaceDocument.js");

function createWorkspace() {
  return buildVolumeWorkspaceDocument({
    novelId: "novel-sync",
    volumes: [{
      id: "volume-1",
      novelId: "novel-sync",
      sortOrder: 1,
      title: "Volume One",
      summary: "Volume summary",
      openingHook: null,
      mainPromise: "Volume promise",
      primaryPressureSource: null,
      coreSellingPoint: null,
      escalationMode: null,
      protagonistChange: null,
      midVolumeRisk: null,
      climax: null,
      payoffType: null,
      nextVolumeHook: null,
      resetPoint: null,
      openPayoffs: [],
      status: "active",
      sourceVersionId: null,
      chapters: [{
        id: "volume-chapter-1",
        volumeId: "volume-1",
        chapterId: null,
        chapterOrder: 1,
        beatKey: null,
        title: "Chapter One",
        summary: "Chapter summary",
        purpose: null,
        exclusiveEvent: null,
        endingState: null,
        nextChapterEntryState: null,
        conflictLevel: null,
        revealLevel: null,
        targetWordCount: 2500,
        mustAvoid: null,
        taskSheet: null,
        sceneCards: null,
        styleContract: null,
        payoffRefs: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      }],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }],
    beatSheets: [],
    strategyPlan: null,
    critiqueReport: null,
    rebalanceDecisions: [],
    source: "volume",
    activeVersionId: "version-1",
  });
}

test("syncVolumeChaptersWithOptions persists new execution chapter links into workspace rows and version JSON", async () => {
  const originalFindMany = prisma.chapter.findMany;
  const originalTransaction = prisma.$transaction;
  const calls = [];

  prisma.chapter.findMany = async () => [];
  prisma.$transaction = async (callback) => callback({
    chapter: {
      create: async (args) => {
        calls.push(["chapter.create", args]);
        return { id: "chapter-created" };
      },
      updateMany: async (args) => calls.push(["chapter.updateMany", args]),
      deleteMany: async (args) => calls.push(["chapter.deleteMany", args]),
    },
    volumePlanVersion: {
      update: async (args) => calls.push(["volumePlanVersion.update", args]),
    },
    volumePlan: {
      findMany: async () => [],
      create: async (args) => calls.push(["volumePlan.create", args]),
      update: async (args) => calls.push(["volumePlan.update", args]),
      deleteMany: async (args) => calls.push(["volumePlan.deleteMany", args]),
    },
    volumeChapterPlan: {
      create: async (args) => calls.push(["volumeChapterPlan.create", args]),
      update: async (args) => calls.push(["volumeChapterPlan.update", args]),
      deleteMany: async (args) => calls.push(["volumeChapterPlan.deleteMany", args]),
    },
    novel: {
      update: async (args) => calls.push(["novel.update", args]),
    },
    storyPlan: {
      deleteMany: async (args) => calls.push(["storyPlan.deleteMany", args]),
      findFirst: async () => null,
      create: async (args) => calls.push(["storyPlan.create", args]),
      update: async (args) => calls.push(["storyPlan.update", args]),
    },
  });

  const workspace = createWorkspace();
  const service = new VolumeChapterSyncService({
    ensureVolumeWorkspace: async () => workspace,
    ensureActiveVersionRecord: async () => ({ versionId: "version-1", version: 1 }),
    emitVolumeUpdated: () => {},
    syncPayoffLedger: () => {},
  });

  try {
    await service.syncVolumeChaptersWithOptions("novel-sync", {
      volumes: workspace.volumes,
      preserveContent: true,
      applyDeletes: false,
    }, {
      emitEvent: false,
      syncPayoffLedger: false,
    });
  } finally {
    prisma.chapter.findMany = originalFindMany;
    prisma.$transaction = originalTransaction;
  }

  const versionUpdate = calls.find(([name]) => name === "volumePlanVersion.update")?.[1];
  const chapterPlanCreate = calls.find(([name]) => name === "volumeChapterPlan.create")?.[1];
  assert.ok(versionUpdate);
  assert.ok(chapterPlanCreate);
  assert.equal(chapterPlanCreate.data.chapterId, "chapter-created");
  const persistedDocument = JSON.parse(versionUpdate.data.contentJson);
  assert.equal(persistedDocument.volumes[0].chapters[0].chapterId, "chapter-created");
});
