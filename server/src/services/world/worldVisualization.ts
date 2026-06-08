import { runStructuredPrompt } from "../../prompting/core/promptRunner";
import { worldVisualizationPrompt } from "../../prompting/prompts/world/world.prompts";
import type { WorldVisualizationPayload } from "@ai-novel/shared/types/world";
import { buildFallbackWorldVisualizationPayload } from "./visualization/fallback";
import { buildStructuredWorldVisualizationPayload } from "./visualization/structured";
import { sanitizeVisualizationPayload } from "./visualization/sanitize";
import type { VisualizationDraft, VisualizationSource } from "./visualization/types";

export { buildFallbackWorldVisualizationPayload } from "./visualization/fallback";

function buildVisualizationPrompt(world: VisualizationSource): string {
  return [
    `世界名：${world.name}`,
    `世界类型：${world.worldType ?? "custom"}`,
    `概述：${world.description ?? "无"}`,
    `背景：${world.background ?? "无"}`,
    `势力：${world.factions ?? "无"}`,
    `政治：${world.politics ?? "无"}`,
    `种族：${world.races ?? "无"}`,
    `地理：${world.geography ?? "无"}`,
    `历史：${world.history ?? "无"}`,
    `冲突：${world.conflicts ?? "无"}`,
    `力量/科技：${[world.magicSystem, world.technology].filter(Boolean).join("\n") || "无"}`,
  ].join("\n\n");
}

async function tryBuildWorldVisualizationWithLLM(
  world: VisualizationSource,
): Promise<VisualizationDraft | null> {
  try {
    const result = await runStructuredPrompt({
      asset: worldVisualizationPrompt,
      promptInput: {
        worldPromptSource: buildVisualizationPrompt(world),
      },
      options: {
        temperature: 0.2,
      },
    });
    return result.output;
  } catch {
    return null;
  }
}

export async function buildWorldVisualizationPayload(world: VisualizationSource): Promise<WorldVisualizationPayload> {
  const structured = buildStructuredWorldVisualizationPayload(world);
  if (structured) {
    return structured;
  }
  const fallback = buildFallbackWorldVisualizationPayload(world);
  const draft = await tryBuildWorldVisualizationWithLLM(world);
  return sanitizeVisualizationPayload(world, draft, fallback);
}
