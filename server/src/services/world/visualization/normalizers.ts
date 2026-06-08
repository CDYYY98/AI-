import type {
  WorldGeographyDirection,
  WorldGeographyMapEdge,
  WorldGeographyMapNode,
  WorldGeographyRegionType,
  WorldGeographyRouteType,
} from "@ai-novel/shared/types/world";
import {
  DIRECTION_COORDINATES,
  EDGE_RELATION_LABELS,
  FACTION_TYPE_ALIASES,
  GEO_DIRECTIONS,
  GEO_REGION_TYPES,
  GEO_ROUTE_TYPES,
  MAX_FACTION_EDGES,
  MAX_GEO_NODES,
} from "./constants";
import type { FactionNodeType, GeographyEdgeInput, GeographyNodeInput } from "./types";

export function normalizeAliasKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_\-:/\\|（）()【】\[\]·、，,。.!?？：:]/g, "");
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function splitIntoLines(source: string): string[] {
  return source
    .split(/[\n;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitIntoSentences(source: string): string[] {
  return source
    .split(/[\n。！？!?；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseListFromText(content: string, fallback: string[]): string[] {
  const parsed = content
    .split(/[\n,，;；]/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

export function normalizeNodeLabel(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim().replace(/^[-*]\s*/, "");
}

export function inferFactionNodeType(label: string): FactionNodeType {
  const normalized = normalizeAliasKey(label);
  const alias = FACTION_TYPE_ALIASES[normalized];
  if (alias) {
    return alias;
  }
  if (/(国家|政府|政权|王朝|王国|帝国|联邦|共和国|朝廷|官府|军阀)/.test(label)) {
    return "state";
  }
  if (/(公司|集团|企业|部门|机构|中介|物业|学校|医院|机关|家庭联盟|共同体|社群|圈|圈层|军|军队|部队|军团|旅|团|司令部|地下党|组织|协会|会|盟|帮|派|社|教团)/.test(label)) {
    return "organization";
  }
  if (/(族|族群|民族|裔)/.test(label)) {
    return "race";
  }
  if (/(势力|阵营|集团|同盟|联盟)/.test(label)) {
    return "faction";
  }
  if (/(state|kingdom|empire|republic|federation|government)/i.test(label)) {
    return "state";
  }
  if (/(army|organization|guild|party|group)/i.test(label)) {
    return "organization";
  }
  if (/(race|tribe|clan)/i.test(label)) {
    return "race";
  }
  return "faction";
}

export function normalizeNodeType(raw: unknown, label: string): FactionNodeType {
  if (typeof raw === "string") {
    const alias = FACTION_TYPE_ALIASES[normalizeAliasKey(raw)];
    if (alias) {
      return alias;
    }
    if (/(公司|企业|部门|机构|社群|圈层|家庭共同体|社区组织|中介机构|机关|生活社群|兴趣联盟|地缘势力)/.test(raw)) {
      return "organization";
    }
    if (/(临时联盟|人物|角色|情感|关系线)/.test(raw)) {
      return "other";
    }
  }
  return inferFactionNodeType(label);
}

export function normalizeEdgeRelation(raw: unknown, sentence?: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value) {
    if (EDGE_RELATION_LABELS.includes(value as (typeof EDGE_RELATION_LABELS)[number])) {
      return value;
    }
    const normalized = normalizeAliasKey(value);
    if (/(alliance|ally|同盟|联合|联手)/.test(normalized)) {
      return "同盟";
    }
    if (/(cooperate|合作|协作|配合)/.test(normalized)) {
      return "合作";
    }
    if (/(support|援助|支援)/.test(normalized)) {
      return "支援";
    }
    if (/(conflict|对抗|敌对|交战|围剿|镇压)/.test(normalized)) {
      return "对抗";
    }
    if (/(trade|交易|贸易)/.test(normalized)) {
      return "贸易";
    }
    if (/(subordinate|统属|隶属|管辖|控制)/.test(normalized)) {
      return "统属";
    }
    if (/(rival|竞争|争夺)/.test(normalized)) {
      return "竞争";
    }
  }
  if (!sentence) {
    return "关联";
  }
  if (/同盟|联合|联手|结盟/.test(sentence)) {
    return "同盟";
  }
  if (/合作|协作|配合|联合抗敌|共同/.test(sentence)) {
    return "合作";
  }
  if (/支援|援助|接应|策应/.test(sentence)) {
    return "支援";
  }
  if (/敌对|对抗|冲突|围剿|镇压|交战|打击|进攻|压迫/.test(sentence)) {
    return "对抗";
  }
  if (/隶属|统辖|控制|管辖|附属/.test(sentence)) {
    return "统属";
  }
  if (/贸易|交易|输送|通商/.test(sentence)) {
    return "贸易";
  }
  if (/竞争|争夺|角力/.test(sentence)) {
    return "竞争";
  }
  return "关联";
}

export function clampMapCoordinate(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeDirection(raw: unknown): WorldGeographyDirection | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const normalized = normalizeAliasKey(raw);
  const aliases: Record<string, WorldGeographyDirection> = {
    north: "north",
    北: "north",
    北方: "north",
    北部: "north",
    south: "south",
    南: "south",
    南方: "south",
    南部: "south",
    east: "east",
    东: "east",
    东方: "east",
    东部: "east",
    west: "west",
    西: "west",
    西方: "west",
    西部: "west",
    center: "center",
    central: "center",
    中: "center",
    中央: "center",
    中部: "center",
    核心: "center",
    northeast: "northeast",
    东北: "northeast",
    northwest: "northwest",
    西北: "northwest",
    southeast: "southeast",
    东南: "southeast",
    southwest: "southwest",
    西南: "southwest",
  };
  const alias = aliases[normalized];
  return alias && GEO_DIRECTIONS.has(alias) ? alias : undefined;
}

export function inferDirectionFromText(text: string, index: number): WorldGeographyDirection {
  if (/东北|北东/.test(text)) {
    return "northeast";
  }
  if (/西北|北西/.test(text)) {
    return "northwest";
  }
  if (/东南|南东/.test(text)) {
    return "southeast";
  }
  if (/西南|南西/.test(text)) {
    return "southwest";
  }
  if (/北方|北部|北境|北岸|北线|冰原|雪原/.test(text)) {
    return "north";
  }
  if (/南方|南部|南境|南岸|南线|雨林|热带/.test(text)) {
    return "south";
  }
  if (/东方|东部|东境|东岸|东线|海港|港口|海岸/.test(text)) {
    return "east";
  }
  if (/西方|西部|西境|西岸|西线|荒漠|沙漠/.test(text)) {
    return "west";
  }
  if (/中心|中央|王城|帝都|首都|核心|腹地|内城/.test(text)) {
    return "center";
  }
  const sequence: WorldGeographyDirection[] = [
    "center",
    "north",
    "east",
    "south",
    "west",
    "northeast",
    "southwest",
    "northwest",
    "southeast",
  ];
  return sequence[index % sequence.length] ?? "center";
}

export function offsetCoordinate(base: { x: number; y: number }, index: number): { x: number; y: number } {
  const ringOffsets = [
    { x: 0, y: 0 },
    { x: 6, y: -5 },
    { x: -6, y: 5 },
    { x: 8, y: 6 },
    { x: -8, y: -6 },
  ];
  const offset = ringOffsets[index % ringOffsets.length] ?? ringOffsets[0];
  return {
    x: Math.max(8, Math.min(92, base.x + offset.x)),
    y: Math.max(8, Math.min(92, base.y + offset.y)),
  };
}

export function inferRegionType(text: string): WorldGeographyRegionType {
  if (/大陆|洲|陆/.test(text)) {
    return "continent";
  }
  if (/国|王朝|王国|帝国|联邦|共和国|领/.test(text)) {
    return "country";
  }
  if (/城|都|镇|港|堡|关/.test(text)) {
    return "city";
  }
  if (/山|谷|河|湖|海|岛|林|原|漠|矿|塔|遗迹|神殿/.test(text)) {
    return "landmark";
  }
  if (/边境|边疆|边界|防线|封锁线/.test(text)) {
    return "border";
  }
  if (/路|道|航线|商道|铁路|河道/.test(text)) {
    return "route";
  }
  return "region";
}

export function normalizeRegionType(raw: unknown, label: string): WorldGeographyRegionType {
  if (typeof raw === "string") {
    const normalized = normalizeAliasKey(raw);
    if (GEO_REGION_TYPES.has(normalized as WorldGeographyRegionType)) {
      return normalized as WorldGeographyRegionType;
    }
  }
  return inferRegionType(label);
}

export function normalizeRouteType(raw: unknown, relation: string): WorldGeographyRouteType {
  if (typeof raw === "string") {
    const normalized = normalizeAliasKey(raw);
    if (GEO_ROUTE_TYPES.has(normalized as WorldGeographyRouteType)) {
      return normalized as WorldGeographyRouteType;
    }
    if (/路|road|道路/.test(normalized)) {
      return "road";
    }
    if (/river|河/.test(normalized)) {
      return "river";
    }
    if (/sea|海|航/.test(normalized)) {
      return "sea";
    }
    if (/portal|传送|门/.test(normalized)) {
      return "portal";
    }
    if (/trade|商|贸易/.test(normalized)) {
      return "trade";
    }
    if (/military|军|战/.test(normalized)) {
      return "military";
    }
    if (/border|边/.test(normalized)) {
      return "border";
    }
  }
  if (/控制|封锁|边境|边界/.test(relation)) {
    return "border";
  }
  if (/通道|道路|商道/.test(relation)) {
    return "road";
  }
  return "other";
}

export function normalizeTextField(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function makeId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

export function normalizeGraphNodes(
  nodes: Array<{ id?: string; label?: string; type?: string }>,
  prefix: string,
): Array<{ id: string; label: string; type: string }> {
  const seenLabels = new Set<string>();
  const result: Array<{ id: string; label: string; type: string }> = [];
  for (const node of nodes) {
    const label = normalizeNodeLabel(node.label);
    if (!label || seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    result.push({
      id: node.id?.trim() || makeId(prefix, result.length),
      label,
      type: normalizeNodeType(node.type, label),
    });
  }
  return result;
}

export function normalizeGraphEdges(
  edges: Array<{ source?: string; target?: string; relation?: string }>,
  nodes: Array<{ id: string; label: string }>,
  fallbackEdges: Array<{ source: string; target: string; relation: string }>,
): Array<{ source: string; target: string; relation: string }> {
  const idMap = new Map(nodes.map((node) => [node.id, node.id]));
  const labelMap = new Map(nodes.map((node) => [node.label, node.id]));
  const seen = new Set<string>();
  const result: Array<{ source: string; target: string; relation: string }> = [];

  for (const edge of edges) {
    const sourceKey = typeof edge.source === "string" ? edge.source.trim() : "";
    const targetKey = typeof edge.target === "string" ? edge.target.trim() : "";
    const source = idMap.get(sourceKey) ?? labelMap.get(sourceKey);
    const target = idMap.get(targetKey) ?? labelMap.get(targetKey);
    if (!source || !target || source === target) {
      continue;
    }
    const pairKey = [source, target].sort().join("|");
    if (seen.has(pairKey)) {
      continue;
    }
    seen.add(pairKey);
    result.push({
      source,
      target,
      relation: normalizeEdgeRelation(edge.relation),
    });
  }

  if (result.length > 0) {
    return result.slice(0, MAX_FACTION_EDGES);
  }
  return fallbackEdges.slice(0, MAX_FACTION_EDGES);
}

export function normalizeGeographyNodes(
  nodes: GeographyNodeInput[],
  fallbackNodes: WorldGeographyMapNode[],
): WorldGeographyMapNode[] {
  const seenLabels = new Set<string>();
  const result: WorldGeographyMapNode[] = [];
  for (const node of nodes) {
    const label = normalizeNodeLabel(node.label);
    if (!label || seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    const directionHint = normalizeDirection(node.directionHint) ?? inferDirectionFromText(
      [label, node.terrain, node.summary, node.risk, node.storyRelevance].filter(Boolean).join(" "),
      result.length,
    );
    const basePoint = DIRECTION_COORDINATES[directionHint];
    const fallbackPoint = offsetCoordinate(basePoint, result.length);
    result.push({
      id: node.id?.trim() || makeId("geo", result.length),
      label,
      x: clampMapCoordinate(node.x) ?? fallbackPoint.x,
      y: clampMapCoordinate(node.y) ?? fallbackPoint.y,
      directionHint,
      regionType: normalizeRegionType(node.regionType, label),
      terrain: normalizeTextField(node.terrain),
      summary: normalizeTextField(node.summary),
      parentId: normalizeTextField(node.parentId) ?? null,
      controllingForceIds: Array.isArray(node.controllingForceIds)
        ? uniqueStrings(node.controllingForceIds.filter((item): item is string => typeof item === "string"))
        : undefined,
      risk: normalizeTextField(node.risk),
      storyRelevance: normalizeTextField(node.storyRelevance),
    });
  }
  return (result.length > 0 ? result : fallbackNodes).slice(0, MAX_GEO_NODES);
}

export function normalizeGeographyEdges(
  edges: GeographyEdgeInput[],
  nodes: WorldGeographyMapNode[],
  fallbackEdges: WorldGeographyMapEdge[],
): WorldGeographyMapEdge[] {
  const idMap = new Map(nodes.map((node) => [node.id, node.id]));
  const labelMap = new Map(nodes.map((node) => [node.label, node.id]));
  const seen = new Set<string>();
  const result: WorldGeographyMapEdge[] = [];

  for (const edge of edges) {
    const sourceKey = typeof edge.source === "string" ? edge.source.trim() : "";
    const targetKey = typeof edge.target === "string" ? edge.target.trim() : "";
    const source = idMap.get(sourceKey) ?? labelMap.get(sourceKey);
    const target = idMap.get(targetKey) ?? labelMap.get(targetKey);
    if (!source || !target || source === target) {
      continue;
    }
    const pairKey = [source, target].sort().join("|");
    if (seen.has(pairKey)) {
      continue;
    }
    seen.add(pairKey);
    const relation = typeof edge.relation === "string" && edge.relation.trim()
      ? edge.relation.trim()
      : "相邻";
    result.push({
      source,
      target,
      relation,
      routeType: normalizeRouteType(edge.routeType, relation),
      distanceHint: normalizeTextField(edge.distanceHint),
      direction: normalizeDirection(edge.direction),
      risk: normalizeTextField(edge.risk),
    });
  }

  return (result.length > 0 ? result : fallbackEdges).slice(0, MAX_FACTION_EDGES);
}

export function extractNamedEntities(
  source: string,
  matcher: RegExp,
  exclusions: Set<string>,
): string[] {
  const results: string[] = [];
  for (const match of source.matchAll(matcher)) {
    const value = match[0]?.trim();
    if (!value || exclusions.has(value)) {
      continue;
    }
    results.push(value);
  }
  return results;
}
