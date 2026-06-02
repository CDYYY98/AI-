const { spawnSync } = require("node:child_process");

const DEFAULT_OFFICIAL_API_BASE_URL = "http://118.190.162.251:3000/api";

function resolvePnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function main() {
  const target = process.argv.includes("--portable")
    ? "dist:desktop:portable"
    : "dist:desktop:nsis";
  const apiBaseUrl = (process.env.AI_NOVEL_API_BASE_URL || DEFAULT_OFFICIAL_API_BASE_URL).trim();

  if (!apiBaseUrl) {
    throw new Error("AI_NOVEL_API_BASE_URL is required for official desktop packaging.");
  }

  console.log(`[dist:desktop:official] apiBaseUrl=${apiBaseUrl}`);
  const result = spawnSync(resolvePnpmCommand(), ["run", target], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_NOVEL_API_BASE_URL: apiBaseUrl,
      AI_NOVEL_RELEASE_CHANNEL: process.env.AI_NOVEL_RELEASE_CHANNEL || "release",
      AI_NOVEL_ALLOW_UNSIGNED_RELEASE: process.env.AI_NOVEL_ALLOW_UNSIGNED_RELEASE || "true",
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

try {
  main();
} catch (error) {
  console.error("[dist:desktop:official] failed.", error);
  process.exit(1);
}
