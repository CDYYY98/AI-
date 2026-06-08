import type { WorldVisualizationPayload } from "@ai-novel/shared/types/world";
import { MAX_FACTION_EDGES, MAX_FACTION_NODES, MAX_POWER_ITEMS, MAX_TIMELINE_ITEMS } from "./constants";
import type { VisualizationDraft, VisualizationSource } from "./types";
import { normalizeGeographyEdges, normalizeGeographyNodes, normalizeGraphEdges, normalizeGraphNodes } from "./normalizers";

export function sanitizeVisualizationPayload(
  world: VisualizationSource,
  draft: VisualizationDraft | null,
  fallback: WorldVisualizationPayload,
): WorldVisualizationPayload {
  const factionNodes = normalizeGraphNodes(draft?.factionGraph?.nodes ?? fallback.factionGraph.nodes, "faction")
    .slice(0, MAX_FACTION_NODES);
  const factionEdges = normalizeGraphEdges(
    draft?.factionGraph?.edges ?? [],
    factionNodes,
    fallback.factionGraph.edges,
  );

  const geographyNodes = normalizeGeographyNodes(
    draft?.geographyMap?.nodes ?? fallback.geographyMap.nodes,
    fallback.geographyMap.nodes,
  );
  const geographyEdges = normalizeGeographyEdges(
    draft?.geographyMap?.edges ?? [],
    geographyNodes,
    fallback.geographyMap.edges,
  );

  const powerTree = (draft?.powerTree ?? fallback.powerTree)
    .map((item, index) => ({
      level: typeof item.level === "string" && item.level.trim() ? item.level.trim() : `L${index + 1}`,
      description: typeof item.description === "string" ? item.description.trim() : "",
    }))
    .filter((item) => item.description)
    .slice(0, MAX_POWER_ITEMS);

  const timeline = (draft?.timeline ?? fallback.timeline)
    .map((item, index) => ({
      year: typeof item.year === "string" && item.year.trim() ? item.year.trim() : `阶段${index + 1}`,
      event: typeof item.event === "string" ? item.event.trim() : "",
    }))
    .filter((item) => item.event)
    .slice(0, MAX_TIMELINE_ITEMS);

  return {
    worldId: world.id,
    factionGraph: {
      nodes: factionNodes.length > 0 ? factionNodes : fallback.factionGraph.nodes,
      edges: factionEdges,
    },
    powerTree: powerTree.length > 0 ? powerTree : fallback.powerTree,
    geographyMap: {
      nodes: geographyNodes.length > 0 ? geographyNodes : fallback.geographyMap.nodes,
      edges: geographyEdges,
    },
    timeline: timeline.length > 0 ? timeline : fallback.timeline,
  };
}
