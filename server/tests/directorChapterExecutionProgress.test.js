const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma } = require("../dist/db/prisma.js");
const {
  ChapterExecutionProgressInspector,
} = require("../dist/services/novel/director/runtime/ChapterExecutionProgressInspector.js");

test("chapter execution progress treats needs_repair as a local recoverable state", async (t) => {
  const originalFindMany = prisma.chapter.findMany;
  prisma.chapter.findMany = async () => [
    {
      id: "chapter-5",
      order: 5,
      title: "Chapter 5",
      content: "Draft body",
      taskSheet: "Task sheet",
      sceneCards: null,
      expectation: null,
      generationState: "reviewed",
      chapterStatus: "needs_repair",
      repairHistory: null,
      qualityReports: [],
      auditReports: [
        {
          issues: [
            {
              status: "open",
              severity: "critical",
            },
          ],
        },
      ],
      storyStateSnapshots: [],
      canonicalStateVersions: [],
    },
    {
      id: "chapter-6",
      order: 6,
      title: "Chapter 6",
      content: "",
      taskSheet: "Task sheet",
      sceneCards: null,
      expectation: null,
      generationState: "planned",
      chapterStatus: "ready",
      repairHistory: null,
      qualityReports: [],
      auditReports: [],
      storyStateSnapshots: [],
      canonicalStateVersions: [],
    },
  ];
  t.after(() => {
    prisma.chapter.findMany = originalFindMany;
  });

  const summary = await new ChapterExecutionProgressInspector().inspectNovel("novel-1");
  const chapter5 = summary.chapters.find((item) => item.chapterOrder === 5);
  const chapter6 = summary.chapters.find((item) => item.chapterOrder === 6);

  assert.equal(summary.totalChapters, 2);
  assert.equal(summary.draftedChapterCount, 1);
  assert.equal(summary.approvedChapterCount, 0);
  assert.equal(summary.needsRepairChapters, 1);
  assert.equal(summary.recoverableRange.startOrder, 5);
  assert.equal(chapter5.status, "needs_repair");
  assert.equal(chapter5.recoverable, true);
  assert.equal(chapter5.nextAction, "repair_chapter");
  assert.ok(chapter5.completedStages.includes("draft_saved"));
  assert.ok(chapter5.missingStages.includes("repair_completed_or_not_needed"));
  assert.equal(chapter6.status, "not_started");
  assert.equal(chapter6.currentStage, "draft_started");
});

test("chapter execution progress ignores generating hint when draft is empty", async (t) => {
  const originalFindMany = prisma.chapter.findMany;
  prisma.chapter.findMany = async () => [
    {
      id: "chapter-7",
      order: 7,
      title: "Chapter 7",
      content: "",
      taskSheet: "Task sheet",
      sceneCards: null,
      expectation: null,
      generationState: "planned",
      chapterStatus: "generating",
      repairHistory: null,
      qualityReports: [],
      auditReports: [],
      storyStateSnapshots: [],
      canonicalStateVersions: [],
    },
  ];
  t.after(() => {
    prisma.chapter.findMany = originalFindMany;
  });

  const summary = await new ChapterExecutionProgressInspector().inspectNovel("novel-1");
  const chapter7 = summary.chapters[0];

  assert.equal(summary.totalChapters, 1);
  assert.equal(summary.activeChapterId, null);
  assert.equal(summary.currentChapterId, "chapter-7");
  assert.equal(chapter7.status, "not_started");
  assert.equal(chapter7.nextAction, "write_draft");
  assert.ok(chapter7.completedStages.includes("draft_started"));
  assert.ok(chapter7.missingStages.includes("draft_saved"));
});
