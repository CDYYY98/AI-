const test = require("node:test");
const assert = require("node:assert/strict");

const {
  timelineStateChangeSchema,
} = require("../../shared/dist/types/timeline.js");

test("timeline state change schema coerces numeric and boolean state values into strings", () => {
  const parsed = timelineStateChangeSchema.parse({
    targetType: "item",
    targetId: "rating",
    field: "value",
    before: 19,
    after: false,
    certainty: "confirmed",
  });

  assert.equal(parsed.before, "19");
  assert.equal(parsed.after, "false");
});

test("timeline state change schema drops empty optional before values", () => {
  const parsed = timelineStateChangeSchema.parse({
    targetType: "world",
    targetId: "public_mood",
    field: "temperature",
    before: "   ",
    after: 76,
    certainty: "likely",
  });

  assert.equal(parsed.before, undefined);
  assert.equal(parsed.after, "76");
});
