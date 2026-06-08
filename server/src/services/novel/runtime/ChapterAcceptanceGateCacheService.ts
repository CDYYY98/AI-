import { createHash } from "node:crypto";
import { prisma } from "../../../db/prisma";
import {
  ChapterAcceptanceAssessmentService,
  type ChapterAcceptanceAssessmentInput,
  type ChapterAcceptanceAssessmentResult,
} from "./ChapterAcceptanceAssessmentService";

interface PersistedAcceptanceGateCachePayload {
  schemaVersion: 1;
  gate: "acceptance";
  contentHash: string;
  requestKey: string;
  result: ChapterAcceptanceAssessmentResult;
}

export interface ChapterAcceptanceGateCacheServiceDeps {
  acceptanceAssessmentService?: Pick<ChapterAcceptanceAssessmentService, "assess">;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function buildRequestKey(input: ChapterAcceptanceAssessmentInput): string {
  return hashContent(JSON.stringify({
    provider: input.provider ?? null,
    model: input.model ?? null,
    temperature: input.temperature ?? null,
  }));
}

function isCacheableAcceptanceResult(result: ChapterAcceptanceAssessmentResult): boolean {
  return !result.assessment.riskTags.includes("acceptance_gate_unavailable")
    && !result.assessment.blockingIssues.some((issue) => issue.code === "acceptance_gate_unavailable");
}

export class ChapterAcceptanceGateCacheService {
  private readonly acceptanceAssessmentService: Pick<ChapterAcceptanceAssessmentService, "assess">;
  private readonly memoryCache = new Map<string, Promise<ChapterAcceptanceAssessmentResult> | ChapterAcceptanceAssessmentResult>();

  constructor(deps: ChapterAcceptanceGateCacheServiceDeps = {}) {
    this.acceptanceAssessmentService = deps.acceptanceAssessmentService ?? new ChapterAcceptanceAssessmentService();
  }

  async assess(input: ChapterAcceptanceAssessmentInput): Promise<ChapterAcceptanceAssessmentResult> {
    const identity = this.buildIdentity(input);
    const memoryKey = [
      input.novelId,
      input.chapterId,
      input.chapterOrder,
      identity.contentHash,
      identity.requestKey,
    ].join(":");
    const cached = this.memoryCache.get(memoryKey);
    if (cached) {
      return cached;
    }

    const persisted = await this.readPersistentCache(input, identity);
    if (persisted) {
      this.memoryCache.set(memoryKey, persisted);
      return persisted;
    }

    const assessmentPromise = this.acceptanceAssessmentService.assess(input);
    this.memoryCache.set(memoryKey, assessmentPromise);
    try {
      const assessment = await assessmentPromise;
      if (isCacheableAcceptanceResult(assessment)) {
        await this.writePersistentCache(input, identity, assessment);
      }
      this.memoryCache.set(memoryKey, assessment);
      return assessment;
    } catch (error) {
      this.memoryCache.delete(memoryKey);
      throw error;
    }
  }

  private buildIdentity(input: ChapterAcceptanceAssessmentInput): {
    contentHash: string;
    requestKey: string;
    artifactType: string;
    syncMode: string;
  } {
    const requestKey = buildRequestKey(input);
    return {
      contentHash: hashContent(input.content),
      requestKey,
      artifactType: "quality_gate_acceptance",
      syncMode: `request_${requestKey.slice(0, 24)}`,
    };
  }

  private async readPersistentCache(
    input: ChapterAcceptanceAssessmentInput,
    identity: ReturnType<ChapterAcceptanceGateCacheService["buildIdentity"]>,
  ): Promise<ChapterAcceptanceAssessmentResult | null> {
    try {
      const row = await prisma.chapterArtifactSyncCheckpoint.findUnique({
        where: {
          novelId_chapterId_contentHash_artifactType_syncMode: {
            novelId: input.novelId,
            chapterId: input.chapterId,
            contentHash: identity.contentHash,
            artifactType: identity.artifactType,
            syncMode: identity.syncMode,
          },
        },
        select: {
          status: true,
          metadataJson: true,
        },
      });
      if (row?.status !== "succeeded" || !row.metadataJson) {
        return null;
      }
      const payload = JSON.parse(row.metadataJson) as PersistedAcceptanceGateCachePayload;
      if (
        payload.schemaVersion !== 1
        || payload.gate !== "acceptance"
        || payload.contentHash !== identity.contentHash
        || payload.requestKey !== identity.requestKey
      ) {
        return null;
      }
      return payload.result;
    } catch (error) {
      console.warn("[chapter-runtime] acceptance gate cache read skipped", {
        novelId: input.novelId,
        chapterId: input.chapterId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async writePersistentCache(
    input: ChapterAcceptanceAssessmentInput,
    identity: ReturnType<ChapterAcceptanceGateCacheService["buildIdentity"]>,
    result: ChapterAcceptanceAssessmentResult,
  ): Promise<void> {
    const payload: PersistedAcceptanceGateCachePayload = {
      schemaVersion: 1,
      gate: "acceptance",
      contentHash: identity.contentHash,
      requestKey: identity.requestKey,
      result,
    };
    try {
      await prisma.chapterArtifactSyncCheckpoint.upsert({
        where: {
          novelId_chapterId_contentHash_artifactType_syncMode: {
            novelId: input.novelId,
            chapterId: input.chapterId,
            contentHash: identity.contentHash,
            artifactType: identity.artifactType,
            syncMode: identity.syncMode,
          },
        },
        create: {
          novelId: input.novelId,
          chapterId: input.chapterId,
          contentHash: identity.contentHash,
          artifactType: identity.artifactType,
          syncMode: identity.syncMode,
          status: "succeeded",
          sourceType: "chapter_quality_gate",
          sourceStage: "acceptance",
          metadataJson: JSON.stringify(payload),
        },
        update: {
          status: "succeeded",
          sourceType: "chapter_quality_gate",
          sourceStage: "acceptance",
          metadataJson: JSON.stringify(payload),
        },
      });
    } catch (error) {
      console.warn("[chapter-runtime] acceptance gate cache write skipped", {
        novelId: input.novelId,
        chapterId: input.chapterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
