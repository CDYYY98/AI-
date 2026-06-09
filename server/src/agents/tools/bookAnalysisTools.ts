import { prisma } from "../../db/prisma";
import { AgentToolError, type AgentToolName } from "../types";
import type { AgentToolDefinition } from "./toolTypes";
import {
  analyzeQualityDebtAttributionInputSchema,
  analyzeQualityDebtAttributionOutputSchema,
  bookAnalysisIdInputSchema,
  getBookAnalysisDetailOutputSchema,
  getBookAnalysisFailureReasonOutputSchema,
  listBookAnalysesInputSchema,
  listBookAnalysesOutputSchema,
  type qualityDebtChapterAttributionSchema,
} from "./bookAnalysisToolSchemas";
import { z } from "zod";

export const bookAnalysisToolDefinitions: Partial<
  Record<AgentToolName, AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>>
> = {
  list_book_analyses: {
    name: "list_book_analyses",
    title: "列出拆书任务",
    description: "读取拆书分析任务列表、状态和最近错误。",
    category: "read",
    riskLevel: "low",
    domainAgent: "BookAnalysisAgent",
    resourceScopes: ["book_analysis", "knowledge_document", "task"],
    inputSchema: listBookAnalysesInputSchema,
    outputSchema: listBookAnalysesOutputSchema,
    execute: async (_context, rawInput) => {
      const input = listBookAnalysesInputSchema.parse(rawInput);
      const rows = await prisma.bookAnalysis.findMany({
        where: {
          ...(input.documentId ? { documentId: input.documentId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: input.limit ?? 20,
      });
      return listBookAnalysesOutputSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          documentId: row.documentId,
          documentTitle: row.document.title,
          status: row.status,
          progress: row.progress,
          currentStage: row.currentStage ?? null,
          lastError: row.lastError ?? null,
          updatedAt: row.updatedAt.toISOString(),
        })),
        summary: `已读取 ${rows.length} 个拆书任务。`,
      });
    },
  },
  get_book_analysis_detail: {
    name: "get_book_analysis_detail",
    title: "读取拆书详情",
    description: "读取单个拆书任务的进度、章节数和最近状态。",
    category: "read",
    riskLevel: "low",
    domainAgent: "BookAnalysisAgent",
    resourceScopes: ["book_analysis", "knowledge_document"],
    inputSchema: bookAnalysisIdInputSchema,
    outputSchema: getBookAnalysisDetailOutputSchema,
    execute: async (_context, rawInput) => {
      const input = bookAnalysisIdInputSchema.parse(rawInput);
      const row = await prisma.bookAnalysis.findUnique({
        where: { id: input.analysisId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
            },
          },
          sections: {
            select: { id: true },
          },
        },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Book analysis not found.");
      }
      return getBookAnalysisDetailOutputSchema.parse({
        id: row.id,
        title: row.title,
        documentId: row.documentId,
        documentTitle: row.document.title,
        status: row.status,
        summary: row.summary ?? null,
        progress: row.progress,
        currentStage: row.currentStage ?? null,
        currentItemLabel: row.currentItemLabel ?? null,
        lastError: row.lastError ?? null,
        sectionCount: row.sections.length,
        updatedAt: row.updatedAt.toISOString(),
      });
    },
  },
  get_book_analysis_failure_reason: {
    name: "get_book_analysis_failure_reason",
    title: "解释拆书失败原因",
    description: "解释拆书任务失败、阻塞或当前不可继续的原因。",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "BookAnalysisAgent",
    resourceScopes: ["book_analysis", "task"],
    inputSchema: bookAnalysisIdInputSchema,
    outputSchema: getBookAnalysisFailureReasonOutputSchema,
    execute: async (_context, rawInput) => {
      const input = bookAnalysisIdInputSchema.parse(rawInput);
      const row = await prisma.bookAnalysis.findUnique({
        where: { id: input.analysisId },
      });
      if (!row) {
        throw new AgentToolError("NOT_FOUND", "Book analysis not found.");
      }
      const failureSummary = row.status === "failed"
        ? (row.lastError?.trim() || "拆书任务失败，但没有记录明确错误。")
        : row.status === "cancelled"
          ? "拆书任务已取消。"
          : row.status === "running"
            ? "拆书任务仍在执行中，并未失败。"
            : row.status === "queued"
              ? "拆书任务仍在排队，尚未开始执行。"
              : "当前拆书任务没有失败记录。";
      const recoveryHint = row.status === "failed"
        ? "可检查文档内容完整性、模型配置和最近一次章节生成记录，再决定是否重试。"
        : row.status === "running"
          ? "建议等待当前任务完成，或在任务中心查看实时进度。"
          : row.status === "queued"
            ? "建议检查队列压力和模型可用性，确认任务是否被调度。"
            : "当前无需恢复操作。";
      return getBookAnalysisFailureReasonOutputSchema.parse({
        analysisId: row.id,
        status: row.status,
        failureSummary,
        failureDetails: row.lastError ?? null,
        recoveryHint,
        summary: failureSummary,
      });
    },
  },
  analyze_quality_debt_attribution: {
    name: "analyze_quality_debt_attribution",
    title: "质量债务根因归因分析",
    description: "扫描已记录质量债务的章节，聚合根因占比、失败 issue code 和缺失义务种类。",
    category: "inspect",
    riskLevel: "low",
    domainAgent: "NovelAgent",
    resourceScopes: ["novel", "chapter"],
    inputSchema: analyzeQualityDebtAttributionInputSchema,
    outputSchema: analyzeQualityDebtAttributionOutputSchema,
    execute: async (context, rawInput) => {
      const input = analyzeQualityDebtAttributionInputSchema.parse(rawInput);
      const novelId = input.novelId?.trim() || context.novelId;
      if (!novelId) {
        throw new AgentToolError("INVALID_INPUT", "没有当前小说上下文，无法执行质量债务归因分析。");
      }

      const chapters = await prisma.chapter.findMany({
        where: {
          novelId,
          order: {
            gte: input.startOrder ?? 1,
            ...(input.endOrder != null ? { lte: input.endOrder } : {}),
          },
          riskFlags: { not: null },
        },
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, riskFlags: true },
      });

      type AttributionData = z.infer<typeof qualityDebtChapterAttributionSchema>;
      const deferredChapters: AttributionData[] = [];

      for (const chapter of chapters) {
        const riskFlagsObj = parseToolJsonObject(chapter.riskFlags);
        const qualityLoop = riskFlagsObj.qualityLoop;
        if (!qualityLoop || typeof qualityLoop !== "object" || Array.isArray(qualityLoop)) {
          continue;
        }
        const loop = qualityLoop as Record<string, unknown>;
        if (loop.terminalAction !== "defer_and_continue") {
          continue;
        }

        const attribution = loop.qualityDebtAttribution;
        if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) {
          deferredChapters.push({
            chapterOrder: chapter.order,
            chapterId: chapter.id,
            title: chapter.title ?? `第${chapter.order}章`,
            firstFailureIssueCodes: [],
            secondFailureIssueCodes: [],
            firstFailureClassificationCode: null,
            patchAnchorFailed: false,
            sameObligationRepeated: false,
            planMisaligned: false,
            lengthVsContentDrift: false,
            missingObligationKinds: [],
            primaryRootCause: "unknown",
          });
          continue;
        }

        const attr = attribution as Record<string, unknown>;
        const firstIssueCodes = readStringArray(attr.firstFailureIssueCodes);
        const secondIssueCodes = readStringArray(attr.secondFailureIssueCodes);
        const obligationKinds = readStringArray(attr.missingObligationKinds);
        const patchAnchorFailed = attr.patchAnchorFailed === true;
        const sameObligationRepeated = attr.sameObligationRepeated === true;
        const planMisaligned = attr.planMisaligned === true;
        const lengthVsContentDrift = attr.lengthVsContentDrift === true;
        const classCode = typeof attr.firstFailureClassificationCode === "string"
          ? attr.firstFailureClassificationCode
          : null;

        let primaryRootCause: AttributionData["primaryRootCause"] = "unknown";
        if (planMisaligned) {
          primaryRootCause = "D";
        } else if (patchAnchorFailed) {
          primaryRootCause = "B";
        } else if (sameObligationRepeated) {
          primaryRootCause = "A";
        } else if (lengthVsContentDrift) {
          primaryRootCause = "E";
        }

        deferredChapters.push({
          chapterOrder: chapter.order,
          chapterId: chapter.id,
          title: chapter.title ?? `第${chapter.order}章`,
          firstFailureIssueCodes: firstIssueCodes,
          secondFailureIssueCodes: secondIssueCodes,
          firstFailureClassificationCode: classCode,
          patchAnchorFailed,
          sameObligationRepeated,
          planMisaligned,
          lengthVsContentDrift,
          missingObligationKinds: obligationKinds,
          primaryRootCause,
        });
      }

      const attributedChapters = deferredChapters.filter((chapter) => (
        chapter.primaryRootCause !== "unknown" || chapter.firstFailureIssueCodes.length > 0
      ));
      const countByRoot = { A: 0, B: 0, D: 0, E: 0, unknown: 0 };
      for (const chapter of deferredChapters) {
        countByRoot[chapter.primaryRootCause] += 1;
      }
      const denominator = deferredChapters.length || 1;
      const rootCauseRatios = {
        A: Number((countByRoot.A / denominator).toFixed(3)),
        B: Number((countByRoot.B / denominator).toFixed(3)),
        D: Number((countByRoot.D / denominator).toFixed(3)),
        E: Number((countByRoot.E / denominator).toFixed(3)),
        unknown: Number((countByRoot.unknown / denominator).toFixed(3)),
      };

      const topFailureIssueCodes = toTopCounts(
        deferredChapters.flatMap((chapter) => [
          ...chapter.firstFailureIssueCodes,
          ...chapter.secondFailureIssueCodes,
        ]),
        5,
        "code",
      );
      const topMissingObligationKinds = toTopCounts(
        deferredChapters.flatMap((chapter) => chapter.missingObligationKinds),
        3,
        "kind",
      );
      const dominantRoot = Object.entries(countByRoot)
        .filter(([root]) => root !== "unknown")
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
      const recommendation = buildQualityDebtRecommendation(deferredChapters.length, dominantRoot);
      const startOrder = input.startOrder ?? 1;
      const endOrder = input.endOrder ?? chapters[chapters.length - 1]?.order ?? startOrder;

      return analyzeQualityDebtAttributionOutputSchema.parse({
        novelId,
        checkedRange: `ch${startOrder}-${endOrder}`,
        totalDeferredChapters: deferredChapters.length,
        attributedChapters: attributedChapters.length,
        rootCauseRatios,
        topFailureIssueCodes,
        topMissingObligationKinds,
        chapters: deferredChapters,
        recommendation,
      });
    },
  },
};

function parseToolJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function toTopCounts<Key extends "code" | "kind">(
  values: string[],
  limit: number,
  key: Key,
): Array<Record<Key, string> & { count: number }> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ [key]: value, count }) as Record<Key, string> & { count: number });
}

function buildQualityDebtRecommendation(totalDeferredChapters: number, dominantRoot: string): string {
  if (totalDeferredChapters === 0) {
    return "当前小说没有记录质量债务章节，无需处理。";
  }
  const recommendationMap: Record<string, string> = {
    D: "根因 D（义务不可达或计划错位）占主导，优先检查章节任务单是否过早、过细或与当前正文窗口不匹配。",
    A: "根因 A（同一义务重复失败）占主导，优先检查修复器是否拿到了明确的结构化义务和失败原因。",
    B: "根因 B（patch 锚点失配）占主导，优先检查局部修复锚点是否过短、过泛或与正文版本不同步。",
    E: "根因 E（长度与内容问题漂移）占主导，优先拆分字数修复和内容修复预算，避免一次修复引出另一类失败。",
    unknown: "暂无足够归因数据，建议先继续观察新记录的质量债务章节。",
  };
  return recommendationMap[dominantRoot] ?? recommendationMap.unknown;
}
