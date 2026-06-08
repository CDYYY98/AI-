import type { WorldGeographyDirection, WorldGeographyRegionType, WorldGeographyRouteType } from "@ai-novel/shared/types/world";
import type { FactionNodeType } from "./types";

export const MAX_FACTION_NODES = 12;
export const MAX_FACTION_EDGES = 18;
export const MAX_GEO_NODES = 10;
export const MAX_TIMELINE_ITEMS = 12;
export const MAX_POWER_ITEMS = 8;

export const GEO_DIRECTIONS = new Set<WorldGeographyDirection>([
  "north",
  "south",
  "east",
  "west",
  "center",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
]);

export const GEO_REGION_TYPES = new Set<WorldGeographyRegionType>([
  "continent",
  "country",
  "region",
  "city",
  "landmark",
  "border",
  "route",
  "other",
]);

export const GEO_ROUTE_TYPES = new Set<WorldGeographyRouteType>([
  "road",
  "river",
  "sea",
  "portal",
  "trade",
  "military",
  "border",
  "other",
]);

export const DIRECTION_COORDINATES: Record<WorldGeographyDirection, { x: number; y: number }> = {
  north: { x: 50, y: 18 },
  south: { x: 50, y: 82 },
  east: { x: 82, y: 50 },
  west: { x: 18, y: 50 },
  center: { x: 50, y: 50 },
  northeast: { x: 76, y: 24 },
  northwest: { x: 24, y: 24 },
  southeast: { x: 76, y: 76 },
  southwest: { x: 24, y: 76 },
};

export const FACTION_TYPE_ALIASES: Record<string, FactionNodeType> = {
  state: "state",
  country: "state",
  kingdom: "state",
  empire: "state",
  republic: "state",
  federation: "state",
  government: "state",
  "国家": "state",
  "政权": "state",
  "政府": "state",
  faction: "faction",
  force: "faction",
  camp: "faction",
  "势力": "faction",
  "阵营": "faction",
  race: "race",
  tribe: "race",
  species: "race",
  "种族": "race",
  "族群": "race",
  "民族": "race",
  organization: "organization",
  org: "organization",
  army: "organization",
  party: "organization",
  group: "organization",
  guild: "organization",
  "组织": "organization",
  "公司": "organization",
  "企业": "organization",
  "部门": "organization",
  "机构": "organization",
  "社群": "organization",
  "圈层": "organization",
  "家庭共同体": "organization",
  "社区组织": "organization",
  "中介机构": "organization",
  "机关": "organization",
  "军队": "organization",
  "部队": "organization",
  "军团": "organization",
  "地下组织": "organization",
  other: "other",
  "其他": "other",
};

export const EDGE_RELATION_LABELS = [
  "同盟",
  "合作",
  "支援",
  "对抗",
  "敌对",
  "统属",
  "压制",
  "贸易",
  "竞争",
  "中立",
  "关联",
] as const;
