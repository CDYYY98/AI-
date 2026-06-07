import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "NovelAutoDirectorProgressPanel.tsx"), "utf8");

test("auto director progress panel keeps title warnings from overriding live progress", () => {
  assert.match(source, /const rawChapterTitleWarning = taskChapterTitleWarning \?\? fallbackChapterTitleWarning/);
  assert.match(source, /displayState\?\.mode === "running" \|\| task\?\.status === "queued"[\s\S]*\? null[\s\S]*: rawChapterTitleWarning/);
});

test("auto director progress panel uses the snapshot query key for full task snapshots", () => {
  assert.match(source, /queryKey:\s*queryKeys\.tasks\.directorTaskSnapshot\(runtimeTaskId \|\| "none"\)/);
  assert.doesNotMatch(source, /queryKey:\s*queryKeys\.tasks\.directorRuntime\(runtimeTaskId \|\| "none"\)/);
});

test("auto director progress panel keeps previous snapshot data during polling", () => {
  assert.match(source, /placeholderData:\s*\(previousData\)\s*=>\s*previousData/);
});
