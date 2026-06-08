const test = require("node:test");
const assert = require("node:assert/strict");

const { ChapterAcceptanceGateCacheService } = require("../dist/services/novel/runtime/ChapterAcceptanceGateCacheService.js");
const { prisma } = require("../dist/db/prisma.js");

function buildInput(overrides = {}) {
  return {
    novelId: "novel-cache",
    chapterId: "chapter-cache",
    novelTitle: "缓存测试",
    chapterTitle: "第一章",
    chapterOrder: 1,
    targetWordCount: 2200,
    content: "这是一段已经生成并可接收的章节正文。",
    contextPackage: {
      chapter: {
        title: "第一章",
        order: 1,
        targetWordCount: 2200,
      },
    },
    provider: "deepseek",
    model: "deepseek-chat",
    temperature: 0.3,
    ...overrides,
  };
}

function buildResult(overrides = {}) {
  return {
    assessment: {
      status: "accepted",
      score: {
        coherence: 90,
        pacing: 88,
        repetition: 92,
        engagement: 89,
        voice: 91,
        overall: 90,
      },
      summary: "正文可继续推进。",
      blockingIssues: [],
      repairDirectives: [],
      missingObligations: [],
      repairability: "none",
      decisionReason: "正文满足当前章节任务。",
      riskTags: [],
      assetSyncRecommendation: {
        priority: "normal",
        reason: "可按常规同步资产。",
        requiresFullPayoffReconcile: false,
      },
      continuePolicy: "continue",
      ...overrides.assessment,
    },
    score: {
      coherence: 90,
      pacing: 88,
      repetition: 92,
      engagement: 89,
      voice: 91,
      overall: 90,
    },
    issues: [],
    auditReports: [],
    ...overrides,
  };
}

test("chapter acceptance gate cache persists reusable acceptance results", async () => {
  const originals = {
    findUnique: prisma.chapterArtifactSyncCheckpoint.findUnique,
    upsert: prisma.chapterArtifactSyncCheckpoint.upsert,
  };
  const writes = [];
  let persistedMetadata = null;
  let assessCalls = 0;
  const expectedResult = buildResult();

  prisma.chapterArtifactSyncCheckpoint.findUnique = async () => persistedMetadata
    ? { status: "succeeded", metadataJson: persistedMetadata }
    : null;
  prisma.chapterArtifactSyncCheckpoint.upsert = async ({ create }) => {
    writes.push(create);
    persistedMetadata = create.metadataJson;
    return { id: "checkpoint-1", ...create };
  };

  try {
    const firstService = new ChapterAcceptanceGateCacheService({
      acceptanceAssessmentService: {
        assess: async () => {
          assessCalls += 1;
          return expectedResult;
        },
      },
    });
    const first = await firstService.assess(buildInput());
    const second = await firstService.assess(buildInput());
    const restartedService = new ChapterAcceptanceGateCacheService({
      acceptanceAssessmentService: {
        assess: async () => {
          throw new Error("persisted acceptance gate cache should be reused");
        },
      },
    });
    const persisted = await restartedService.assess(buildInput());

    assert.equal(assessCalls, 1);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].artifactType, "quality_gate_acceptance");
    assert.equal(writes[0].sourceStage, "acceptance");
    assert.deepEqual(first, expectedResult);
    assert.deepEqual(second, expectedResult);
    assert.deepEqual(persisted, expectedResult);
  } finally {
    prisma.chapterArtifactSyncCheckpoint.findUnique = originals.findUnique;
    prisma.chapterArtifactSyncCheckpoint.upsert = originals.upsert;
  }
});

test("chapter acceptance gate cache does not persist unavailable gate fallback", async () => {
  const originals = {
    findUnique: prisma.chapterArtifactSyncCheckpoint.findUnique,
    upsert: prisma.chapterArtifactSyncCheckpoint.upsert,
  };
  let assessCalls = 0;
  let upsertCalls = 0;
  const unavailableResult = buildResult({
    assessment: {
      status: "continue_with_risk",
      blockingIssues: [{
        severity: "medium",
        category: "mode_fit",
        code: "acceptance_gate_unavailable",
        evidence: "接收闸门暂时不可用。",
        fixSuggestion: "稍后重试审校。",
      }],
      riskTags: ["acceptance_gate_unavailable"],
      decisionReason: "接收闸门不可用，保留正文并继续。",
    },
  });

  prisma.chapterArtifactSyncCheckpoint.findUnique = async () => null;
  prisma.chapterArtifactSyncCheckpoint.upsert = async () => {
    upsertCalls += 1;
    throw new Error("unavailable gate fallback should not be cached");
  };

  try {
    const service = new ChapterAcceptanceGateCacheService({
      acceptanceAssessmentService: {
        assess: async () => {
          assessCalls += 1;
          return unavailableResult;
        },
      },
    });

    const result = await service.assess(buildInput({ content: "接收闸门不可用时的正文。" }));

    assert.equal(assessCalls, 1);
    assert.equal(upsertCalls, 0);
    assert.deepEqual(result, unavailableResult);
  } finally {
    prisma.chapterArtifactSyncCheckpoint.findUnique = originals.findUnique;
    prisma.chapterArtifactSyncCheckpoint.upsert = originals.upsert;
  }
});
