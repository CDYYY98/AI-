import { z } from "zod";
import type { BookAnalysisStatus } from "@ai-novel/shared/types/bookAnalysis";
import {
  toolCountSchema,
  toolListLimitSchema,
  toolNullableTextSchema,
  toolOptionalTextSchema,
  toolProgressSchema,
  toolRequiredIdSchema,
  toolSummarySchema,
  toolTimestampSchema,
} from "./toolSchemaPrimitives";

const BOOK_ANALYSIS_STATUS_VALUES = [
  "draft",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "archived",
] as const satisfies readonly BookAnalysisStatus[];

export const bookAnalysisStatusSchema = z.enum(BOOK_ANALYSIS_STATUS_VALUES);

export const listBookAnalysesInputSchema = z.object({
  documentId: toolOptionalTextSchema,
  status: bookAnalysisStatusSchema.optional(),
  limit: toolListLimitSchema,
});

export const bookAnalysisSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  status: bookAnalysisStatusSchema,
  progress: toolProgressSchema,
  currentStage: toolNullableTextSchema,
  lastError: toolNullableTextSchema,
  updatedAt: toolTimestampSchema,
});

export const listBookAnalysesOutputSchema = z.object({
  items: z.array(bookAnalysisSummarySchema),
  summary: toolSummarySchema,
});

export const bookAnalysisIdInputSchema = z.object({
  analysisId: toolRequiredIdSchema,
});

export const getBookAnalysisDetailOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  status: bookAnalysisStatusSchema,
  summary: toolNullableTextSchema,
  progress: toolProgressSchema,
  currentStage: toolNullableTextSchema,
  currentItemLabel: toolNullableTextSchema,
  lastError: toolNullableTextSchema,
  sectionCount: toolCountSchema,
  updatedAt: toolTimestampSchema,
});

export const getBookAnalysisFailureReasonOutputSchema = z.object({
  analysisId: z.string(),
  status: bookAnalysisStatusSchema,
  failureSummary: toolSummarySchema,
  failureDetails: toolNullableTextSchema,
  recoveryHint: toolSummarySchema,
  summary: toolSummarySchema,
});

export const analyzeQualityDebtAttributionInputSchema = z.object({
  novelId: toolRequiredIdSchema,
  startOrder: z.number().int().min(1).optional(),
  endOrder: z.number().int().min(1).optional(),
});

export const qualityDebtChapterAttributionSchema = z.object({
  chapterOrder: toolCountSchema,
  chapterId: z.string(),
  title: z.string(),
  firstFailureIssueCodes: z.array(z.string()),
  secondFailureIssueCodes: z.array(z.string()),
  firstFailureClassificationCode: z.string().nullable(),
  patchAnchorFailed: z.boolean(),
  sameObligationRepeated: z.boolean(),
  planMisaligned: z.boolean(),
  lengthVsContentDrift: z.boolean(),
  missingObligationKinds: z.array(z.string()),
  primaryRootCause: z.enum(["A", "B", "D", "E", "unknown"]),
});

export const analyzeQualityDebtAttributionOutputSchema = z.object({
  novelId: z.string(),
  checkedRange: z.string(),
  totalDeferredChapters: toolCountSchema,
  attributedChapters: toolCountSchema,
  rootCauseRatios: z.object({
    A: z.number(),
    B: z.number(),
    D: z.number(),
    E: z.number(),
    unknown: z.number(),
  }),
  topFailureIssueCodes: z.array(z.object({
    code: z.string(),
    count: toolCountSchema,
  })),
  topMissingObligationKinds: z.array(z.object({
    kind: z.string(),
    count: toolCountSchema,
  })),
  chapters: z.array(qualityDebtChapterAttributionSchema),
  recommendation: toolSummarySchema,
});
