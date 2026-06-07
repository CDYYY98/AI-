const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveBeatSheetTargetChapterCount,
} = require("../dist/services/novel/volume/volumeGenerationOrchestrator.js");
const {
  allocateChapterBudgets,
  generateChapterTaskSheetDetail,
} = require("../dist/services/novel/volume/volumeGenerationHelpers.js");

function createVolume(id, chapterCount) {
  return {
    id,
    chapters: Array.from({ length: chapterCount }, (_, index) => ({
      id: `${id}-chapter-${index + 1}`,
    })),
  };
}

test("chapter budgets ignore incomplete prefix-only generated chapters", () => {
  const budgets = allocateChapterBudgets({
    volumeCount: 8,
    chapterBudget: 430,
    existingVolumes: [
      createVolume("volume-1", 53),
      createVolume("volume-2", 0),
      createVolume("volume-3", 0),
      createVolume("volume-4", 0),
      createVolume("volume-5", 0),
      createVolume("volume-6", 0),
      createVolume("volume-7", 0),
      createVolume("volume-8", 0),
    ],
  });

  assert.equal(budgets.reduce((sum, count) => sum + count, 0), 430);
  assert.ok(budgets[1] >= 40, `expected second volume budget to stay usable, got ${budgets[1]}`);
  assert.ok(budgets[1] <= 60, `expected second volume budget near an even split, got ${budgets[1]}`);
});

test("beat sheet target chapter count is not shrunk by partial seed chapters", () => {
  const targetChapterCount = resolveBeatSheetTargetChapterCount({
    targetVolumeChapterCount: 10,
    targetVolumeIndex: 0,
    volumeCount: 8,
    chapterBudget: 430,
    chapterBudgets: [54, 54, 54, 54, 54, 54, 53, 53],
  });

  assert.equal(targetChapterCount, 54);
});

test("beat sheet target chapter count still preserves a larger existing volume", () => {
  const targetChapterCount = resolveBeatSheetTargetChapterCount({
    targetVolumeChapterCount: 70,
    targetVolumeIndex: 0,
    volumeCount: 8,
    chapterBudget: 430,
    chapterBudgets: [54, 54, 54, 54, 54, 54, 53, 53],
  });

  assert.equal(targetChapterCount, 70);
});

function createExistingSceneCards() {
  return JSON.stringify([
    {
      key: "scene_1",
      title: "压迫开场",
      purpose: "用外部追索压住主角行动空间。",
      mustAdvance: ["敌方逼近"],
      mustPreserve: ["主角身份不能暴露"],
      entryState: "主角刚获得线索。",
      exitState: "追索者确认主角所在区域。",
      forbiddenExpansion: ["不要直接大决战"],
      targetWordCount: 700,
    },
    {
      key: "scene_2",
      title: "试探反压",
      purpose: "让主角用有限资源反向试探。",
      mustAdvance: ["主角发现敌方弱点"],
      mustPreserve: ["资源仍然紧张"],
      entryState: "敌方压力加重。",
      exitState: "主角拿到一条可用缝隙。",
      forbiddenExpansion: ["不要解决全部危机"],
      targetWordCount: 900,
    },
    {
      key: "scene_3",
      title: "风险钩子",
      purpose: "把本章结果转成下一章入口。",
      mustAdvance: ["留下更危险证据"],
      mustPreserve: ["队友仍有疑虑"],
      entryState: "主角找到缝隙。",
      exitState: "新证据指向更深层敌人。",
      forbiddenExpansion: ["不要提前揭露幕后主谋"],
      targetWordCount: 800,
    },
  ]);
}

test("chapter task sheet detail reuses complete existing contract without guidance", async () => {
  const result = await generateChapterTaskSheetDetail({
    promptInput: {
      novel: {
        title: "测试小说",
        description: null,
        targetAudience: null,
        bookSellingPoint: null,
        competingFeel: null,
        first30ChapterPromise: null,
        commercialTagsJson: null,
        estimatedChapterCount: 30,
        narrativePov: null,
        pacePreference: null,
        emotionIntensity: null,
        storyModePromptBlock: null,
        genre: null,
        characters: [],
      },
      workspace: {
        novelId: "novel-1",
        workspaceVersion: "v2",
        volumes: [],
        strategyPlan: null,
        critiqueReport: null,
        beatSheets: [],
        rebalanceDecisions: [],
        readiness: {
          hasStrategy: true,
          hasBeatSheets: true,
          hasChapters: true,
          chapterCount: 1,
          readyForChapterExecution: true,
          missing: [],
        },
        source: "volume",
        activeVersionId: null,
      },
      storyMacroPlan: {
        premise: "主角在追索中反向破局。",
        protagonistGoal: "保护身份并查清线索。",
        mainConflict: "敌方持续追索。",
        toneKeywords: [],
        corePayoffs: [],
        riskWarnings: [],
      },
      strategyPlan: null,
      targetVolume: {
        id: "volume-1",
        novelId: "novel-1",
        sortOrder: 1,
        title: "第一卷",
        summary: "开局卷",
        mainPromise: "身份风险与反压",
        escalationMode: "逐步升级",
        protagonistChange: "从被动躲避到主动试探",
        climax: "确认真正敌人",
        nextVolumeHook: "更深敌人出现",
        resetPoint: null,
        openPayoffs: [],
        status: "draft",
        sourceVersionId: null,
        chapters: [],
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:00.000Z",
      },
      targetBeatSheet: null,
      targetChapter: {
        id: "chapter-plan-1",
        volumeId: "volume-1",
        chapterId: "chapter-1",
        chapterOrder: 1,
        beatKey: null,
        title: "第一章",
        summary: "主角被追索并反向试探。",
        purpose: "建立追索压力。",
        exclusiveEvent: "主角第一次找到敌方弱点。",
        endingState: "新证据出现。",
        nextChapterEntryState: "主角必须追查新证据。",
        conflictLevel: 4,
        revealLevel: 2,
        targetWordCount: 2400,
        mustAvoid: "不要直接揭露幕后主谋。",
        taskSheet: "沿用已有任务单，先压迫再反压，结尾留下证据钩子。",
        sceneCards: createExistingSceneCards(),
        styleContract: null,
        payoffRefs: ["payoff-1"],
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:00.000Z",
      },
      detailMode: "task_sheet",
    },
    options: {},
  });

  const scenePlan = JSON.parse(result.sceneCards);
  assert.equal(result.taskSheet, "沿用已有任务单，先压迫再反压，结尾留下证据钩子。");
  assert.equal(result.purpose, "建立追索压力。");
  assert.equal(result.exclusiveEvent, "主角第一次找到敌方弱点。");
  assert.deepEqual(result.payoffRefs, ["payoff-1"]);
  assert.equal(scenePlan.targetWordCount, 2400);
  assert.equal(scenePlan.scenes.length, 3);
});
