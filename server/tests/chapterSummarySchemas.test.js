const test = require("node:test");
const assert = require("node:assert/strict");

const {
  chapterSummaryOutputSchema,
} = require("../dist/services/novel/chapterSummarySchemas.js");

test("chapter summary schema keeps legacy summary-only output compatible", () => {
  const parsed = chapterSummaryOutputSchema.parse({
    summary: "主角完成了本章的关键交易，并留下后续冲突。",
  });

  assert.equal(parsed.summary, "主角完成了本章的关键交易，并留下后续冲突。");
  assert.equal(parsed.concreteFacts, undefined);
});

test("chapter summary schema accepts concrete hard facts for continuity", () => {
  const parsed = chapterSummaryOutputSchema.parse({
    summary: "主角私下接下放映委托，并确认这件事不能走公开流程。",
    concreteFacts: [{
      text: "与王家庄约定后天晚上私下放映一场",
      category: "state_changed",
    }, {
      text: "这次放映不走厂里审批流程",
      category: "revealed",
    }],
  });

  assert.deepEqual(parsed.concreteFacts, [{
    text: "与王家庄约定后天晚上私下放映一场",
    category: "state_changed",
  }, {
    text: "这次放映不走厂里审批流程",
    category: "revealed",
  }]);
});
