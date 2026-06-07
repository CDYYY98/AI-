const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildChapterRagQuery,
} = require("../dist/services/novel/NovelReferenceService.js");

test("buildChapterRagQuery includes chapter mission and participants", () => {
  const query = buildChapterRagQuery({
    chapterOrder: 12,
    novelTitle: "星港疑云",
    chapterTitle: "夜航前的交易",
    objective: "让主角拿到黑箱线索",
    expectation: "结尾发现盟友隐瞒身份",
    mustAdvance: ["推进黑箱交易", "埋下追踪芯片"],
    targetConflicts: ["主角与走私商的信任冲突"],
    participantNames: ["林澈", "许安"],
    structuredOutline: null,
  });

  assert.match(query, /星港疑云/);
  assert.match(query, /夜航前的交易/);
  assert.match(query, /黑箱线索/);
  assert.match(query, /走私商/);
  assert.match(query, /林澈/);
});

test("buildChapterRagQuery falls back to outline query without mission signals", () => {
  const query = buildChapterRagQuery({
    chapterOrder: 3,
    novelTitle: "星港疑云",
    structuredOutline: JSON.stringify([
      { order: 3, title: "旧码头", summary: "主角发现旧案编号" },
    ]),
  });

  assert.equal(query, "chapter 3 旧码头 主角发现旧案编号 星港疑云");
});
