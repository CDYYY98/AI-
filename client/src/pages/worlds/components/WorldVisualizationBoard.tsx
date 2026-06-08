import { useMemo, useState } from "react";
import type { WorldVisualizationPayload } from "@ai-novel/shared/types/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraggableGraph } from "./visualization/WorldGraphCanvas";

interface WorldVisualizationBoardProps {
  payload?: WorldVisualizationPayload;
}


const FACTION_TYPE_LABELS: Record<string, string> = {
  all: "全部类型",
  state: "政权",
  faction: "阵营",
  race: "种族",
  organization: "组织",
  other: "其他",
};

const FACTION_TYPE_COLORS: Record<string, string> = {
  state: "#2563eb",
  faction: "#16a34a",
  race: "#ea580c",
  organization: "#7c3aed",
  other: "#64748b",
};


export default function WorldVisualizationBoard({ payload }: WorldVisualizationBoardProps) {
  const [mode, setMode] = useState<"faction" | "geography" | "power" | "timeline">("faction");
  const [keyword, setKeyword] = useState("");
  const [factionType, setFactionType] = useState("all");
  const [timelineLimit, setTimelineLimit] = useState(8);

  const factionTypeOptions = useMemo(() => {
    const types = Array.from(
      new Set((payload?.factionGraph.nodes ?? []).map((node) => node.type?.trim()).filter(Boolean)),
    );
    return ["all", ...types];
  }, [payload?.factionGraph.nodes]);

  const factionNodes = useMemo(() => {
    const source = payload?.factionGraph.nodes ?? [];
    return source.filter((node) => {
      const matchType = factionType === "all" ? true : node.type === factionType;
      const matchKeyword = keyword.trim()
        ? node.label.toLowerCase().includes(keyword.trim().toLowerCase())
        : true;
      return matchType && matchKeyword;
    });
  }, [factionType, keyword, payload?.factionGraph.nodes]);

  const factionNodeIds = useMemo(() => new Set(factionNodes.map((node) => node.id)), [factionNodes]);

  const factionEdges = useMemo(
    () =>
      (payload?.factionGraph.edges ?? []).filter(
        (edge) => factionNodeIds.has(edge.source) && factionNodeIds.has(edge.target),
      ),
    [factionNodeIds, payload?.factionGraph.edges],
  );

  const geographyNodes = useMemo(() => {
    const source = payload?.geographyMap.nodes ?? [];
    return source.filter((node) =>
      keyword.trim() ? node.label.toLowerCase().includes(keyword.trim().toLowerCase()) : true,
    );
  }, [keyword, payload?.geographyMap.nodes]);

  const geographyNodeIds = useMemo(
    () => new Set(geographyNodes.map((node) => node.id)),
    [geographyNodes],
  );

  const geographyEdges = useMemo(
    () =>
      (payload?.geographyMap.edges ?? []).filter(
        (edge) => geographyNodeIds.has(edge.source) && geographyNodeIds.has(edge.target),
      ),
    [geographyNodeIds, payload?.geographyMap.edges],
  );

  const filteredPower = useMemo(() => {
    const source = payload?.powerTree ?? [];
    if (!keyword.trim()) {
      return source;
    }
    const lower = keyword.trim().toLowerCase();
    return source.filter(
      (item) =>
        item.level.toLowerCase().includes(lower)
        || item.description.toLowerCase().includes(lower),
    );
  }, [keyword, payload?.powerTree]);

  const filteredTimeline = useMemo(() => {
    const source = payload?.timeline ?? [];
    const byKeyword = keyword.trim()
      ? source.filter((item) =>
        `${item.year} ${item.event}`.toLowerCase().includes(keyword.trim().toLowerCase()),
      )
      : source;
    return byKeyword.slice(0, timelineLimit);
  }, [keyword, payload?.timeline, timelineLimit]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={mode === "faction" ? "default" : "secondary"} onClick={() => setMode("faction")}>
          势力图谱
        </Button>
        <Button size="sm" variant={mode === "geography" ? "default" : "secondary"} onClick={() => setMode("geography")}>
          地理地图
        </Button>
        <Button size="sm" variant={mode === "power" ? "default" : "secondary"} onClick={() => setMode("power")}>
          力量体系
        </Button>
        <Button size="sm" variant={mode === "timeline" ? "default" : "secondary"} onClick={() => setMode("timeline")}>
          世界时间线
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="按名称或关键词筛选"
        />
        {mode === "faction" ? (
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={factionType}
            onChange={(event) => setFactionType(event.target.value)}
          >
            {factionTypeOptions.map((type) => (
              <option key={type} value={type}>
                {FACTION_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        ) : (
          <div />
        )}
        {mode === "timeline" ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>显示数量</span>
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={timelineLimit}
              onChange={(event) => setTimelineLimit(Number(event.target.value))}
            />
            <span>{timelineLimit}</span>
          </div>
        ) : (
          <div />
        )}
      </div>

      {mode === "faction" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {factionTypeOptions
              .filter((type) => type !== "all")
              .map((type) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: FACTION_TYPE_COLORS[type] ?? FACTION_TYPE_COLORS.other }}
                  />
                  <span>{FACTION_TYPE_LABELS[type] ?? type}</span>
                </div>
              ))}
          </div>
          <DraggableGraph
            title={`势力图谱（${factionNodes.length} 个节点）`}
            nodes={factionNodes}
            edges={factionEdges}
            colorByType={(type) => FACTION_TYPE_COLORS[type ?? "other"] ?? FACTION_TYPE_COLORS.other}
          />
        </div>
      ) : null}

      {mode === "geography" ? (
        <DraggableGraph
          title={`世界地图（${geographyNodes.length} 个地点）`}
          nodes={geographyNodes}
          edges={geographyEdges}
          colorByType={() => "#ea580c"}
          layout="map"
        />
      ) : null}

      {mode === "power" ? (
        <div className="rounded-md border p-3 text-sm">
          <div className="mb-2 font-medium">力量体系（{filteredPower.length} 项）</div>
          <div className="space-y-2">
            {filteredPower.map((item) => (
              <div key={`${item.level}-${item.description}`} className="rounded border p-2">
                <div className="text-xs font-semibold text-muted-foreground">{item.level}</div>
                <div>{item.description}</div>
              </div>
            ))}
            {filteredPower.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无匹配内容</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "timeline" ? (
        <div className="rounded-md border p-3 text-sm">
          <div className="mb-2 font-medium">世界时间线（{filteredTimeline.length} 条）</div>
          <div className="space-y-2">
            {filteredTimeline.map((item, index) => (
              <div key={`${item.year}-${item.event}-${index}`} className="flex gap-3 rounded border p-2">
                <div className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">{item.year}</div>
                <div>{item.event}</div>
              </div>
            ))}
            {filteredTimeline.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无匹配内容</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
