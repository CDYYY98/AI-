const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const eventsEntry = path.resolve(__dirname, "../dist/events/index.js");
const eventsStub = new Module(eventsEntry);
eventsStub.filename = eventsEntry;
eventsStub.loaded = true;
eventsStub.exports = {
  novelEventBus: {
    async emit() {},
  },
};
require.cache[eventsEntry] = eventsStub;

const {
  NovelGenerationService,
} = require("../dist/services/novel/NovelGenerationService.js");
const { NovelCoreService } = require("../dist/services/novel/NovelCoreService.js");
const {
  registerChapterExecutionStageRunner,
} = require("../dist/services/novel/production/ChapterExecutionStageRunner.js");

test("createChapterStream routes manual chapter execution through the unified orchestrator", async () => {
  const calls = [];
  const streamResult = {
    stream: {
      async *[Symbol.asyncIterator]() {},
    },
    async onDone() {},
  };
  const service = new NovelGenerationService();
  service.chapterRuntimeCoordinator = {
    async createChapterStream(novelId, chapterId, options, config) {
      calls.push(["createChapterStream", novelId, chapterId, options.model, config.includeRuntimePackage]);
      return streamResult;
    },
  };

  const result = await service.createChapterStream("novel-1", "chapter-5", {
    model: "gpt-test",
  });

  assert.deepEqual(calls, [
    ["createChapterStream", "novel-1", "chapter-5", "gpt-test", true],
  ]);
  assert.equal(result, streamResult);
});

test("legacy NovelCoreService chapter stream enters the unified orchestrator", async () => {
  const calls = [];
  const streamResult = {
    stream: {
      async *[Symbol.asyncIterator]() {},
    },
    async onDone() {},
  };

  registerChapterExecutionStageRunner({
    getCore: () => {
      throw new Error("Pipeline mode is not used by this test.");
    },
    getCoordinator: () => ({
      async createChapterStream(novelId, chapterId, options, config) {
        calls.push({ novelId, chapterId, options, config });
        return streamResult;
      },
    }),
  });

  const core = new NovelCoreService();
  const result = await core.createChapterStream("novel-legacy", "chapter-legacy", {
    model: "gpt-test",
  });

  assert.equal(result, streamResult);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].novelId, "novel-legacy");
  assert.equal(calls[0].chapterId, "chapter-legacy");
  assert.equal(calls[0].options.model, "gpt-test");
  assert.equal(calls[0].config.includeRuntimePackage, false);
});
