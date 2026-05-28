import type {
  DirectorArtifactRef,
  DirectorRuntimeSnapshot,
  DirectorStepRun,
} from "@ai-novel/shared/types/directorRuntime";
import { prisma } from "../../../../db/prisma";
import { runWithLlmUsageTracking, type LlmUsageTrackingContext } from "../../../../llm/usageTracking";
import { newApiService } from "../../../auth/NewApiService";
import { DirectorPolicyEngine, type DirectorPolicyRequest } from "./DirectorPolicyEngine";
import { DirectorRuntimeStore } from "./DirectorRuntimeStore";

function buildNodeIdempotencyKey(input: {
  taskId: string;
  nodeKey: string;
  targetType?: DirectorStepRun["targetType"];
  targetId?: string | null;
}): string {
  return `${input.taskId}:${input.nodeKey}:${input.targetType ?? "global"}:${input.targetId ?? "global"}`;
}

async function buildNodeUsageContext(input: {
  taskId: string;
  novelId?: string | null;
  runId?: string | null;
  idempotencyKey?: string | null;
  nodeKey: string;
}): Promise<LlmUsageTrackingContext> {
  const task = await prisma.novelWorkflowTask.findUnique({
    where: { id: input.taskId },
    select: {
      seedPayloadJson: true,
      novel: {
        select: { ownerUserId: true },
      },
    },
  }).catch(() => null);

  let seedUserId: string | null = null;
  try {
    const parsed = task?.seedPayloadJson ? JSON.parse(task.seedPayloadJson) as { createdByUserId?: unknown } : null;
    seedUserId = typeof parsed?.createdByUserId === "string" && parsed.createdByUserId.trim()
      ? parsed.createdByUserId.trim()
      : null;
  } catch {
    seedUserId = null;
  }

  const userId = seedUserId ?? task?.novel?.ownerUserId ?? null;
  const user = userId
    ? await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, apiToken: true },
    }).catch(() => null)
    : null;
  const userApiToken = user?.apiToken?.trim()
    || (user?.email ? (await newApiService.createToken(user.email).catch(() => null))?.key ?? null : null);

  return {
    workflowTaskId: input.taskId,
    directorTelemetry: true,
    novelId: input.novelId ?? null,
    directorRunId: input.runId ?? input.taskId,
    directorStepIdempotencyKey: input.idempotencyKey ?? null,
    directorNodeKey: input.nodeKey,
    userId,
    userEmail: user?.email ?? null,
    userApiToken,
  };
}

export interface DirectorNodeContract<TInput, TOutput> {
  nodeKey: string;
  label: string;
  reads: string[];
  writes: string[];
  policyAction?: DirectorPolicyRequest["action"];
  mayModifyUserContent: boolean;
  requiresApprovalByDefault: boolean;
  supportsAutoRetry: boolean;
  run(input: TInput): Promise<TOutput>;
}

export interface DirectorNodeRunInput<TInput> {
  taskId?: string | null;
  novelId?: string | null;
  targetType?: DirectorStepRun["targetType"];
  targetId?: string | null;
  input: TInput;
  policy?: Omit<Partial<DirectorPolicyRequest>, "action">;
  reuseCompletedStep?: boolean;
}

export interface DirectorNodeRunResult<TOutput> {
  status: "completed" | "needs_approval" | "blocked_scope" | "failed";
  output?: TOutput;
  runtimeSnapshot?: DirectorRuntimeSnapshot | null;
  producedArtifacts: DirectorArtifactRef[];
  reason?: string;
}

export class DirectorNodeRunner {
  constructor(
    private readonly runtimeStore = new DirectorRuntimeStore(),
    private readonly policyEngine = new DirectorPolicyEngine(),
  ) {}

  async run<TInput, TOutput>(
    contract: DirectorNodeContract<TInput, TOutput>,
    input: DirectorNodeRunInput<TInput>,
    collectArtifacts?: (output: TOutput) => DirectorArtifactRef[],
  ): Promise<DirectorNodeRunResult<TOutput>> {
    const snapshot = input.taskId?.trim()
      ? await this.runtimeStore.getSnapshot(input.taskId.trim())
      : null;
    const idempotencyKey = input.taskId?.trim()
      ? buildNodeIdempotencyKey({
        taskId: input.taskId.trim(),
        nodeKey: contract.nodeKey,
        targetType: input.targetType,
        targetId: input.targetId,
      })
      : null;
    const policyDecision = this.policyEngine.decide({
      reads: contract.reads,
      writes: contract.writes,
      targetType: input.targetType,
      targetId: input.targetId,
      mayOverwriteUserContent: contract.mayModifyUserContent,
      requiresApprovalByDefault: contract.requiresApprovalByDefault,
      ...input.policy,
      action: contract.policyAction ?? "run_node",
      policy: input.policy?.policy ?? snapshot?.policy ?? null,
    });
    const completedStep = (
      input.reuseCompletedStep !== false
      && idempotencyKey
      ? snapshot?.steps.find((step) => (
        step.idempotencyKey === idempotencyKey
        && step.status === "succeeded"
      )) ?? null
      : null
    );
    if (completedStep) {
      return {
        status: "completed",
        runtimeSnapshot: snapshot ?? null,
        producedArtifacts: completedStep.producedArtifacts ?? [],
      };
    }
    if (!policyDecision.canRun || policyDecision.requiresApproval) {
      let runtimeSnapshot: DirectorRuntimeSnapshot | null = snapshot;
      if (input.taskId?.trim()) {
        await this.runtimeStore.recordNodeGate({
          taskId: input.taskId.trim(),
          novelId: input.novelId,
          nodeKey: contract.nodeKey,
          label: contract.label,
          targetType: input.targetType,
          targetId: input.targetId,
          status: policyDecision.gateType === "blocked_scope" ? "blocked_scope" : "waiting_approval",
          decision: policyDecision,
        });
        runtimeSnapshot = await this.runtimeStore.getSnapshot(input.taskId.trim());
      }
      return {
        status: policyDecision.gateType === "blocked_scope" ? "blocked_scope" : "needs_approval",
        runtimeSnapshot,
        producedArtifacts: [],
        reason: policyDecision.reason,
      };
    }

    if (input.taskId?.trim()) {
      await this.runtimeStore.recordStepStarted({
        taskId: input.taskId.trim(),
        novelId: input.novelId,
        nodeKey: contract.nodeKey,
        label: contract.label,
        targetType: input.targetType,
        targetId: input.targetId,
      });
    }

    try {
      const output = input.taskId?.trim()
        ? await runWithLlmUsageTracking(await buildNodeUsageContext({
          taskId: input.taskId.trim(),
          novelId: input.novelId,
          runId: snapshot?.runId ?? input.taskId.trim(),
          idempotencyKey,
          nodeKey: contract.nodeKey,
        }), () => contract.run(input.input))
        : await contract.run(input.input);
      const producedArtifacts = collectArtifacts?.(output) ?? [];
      let runtimeSnapshot: DirectorRuntimeSnapshot | null = null;
      if (input.taskId?.trim()) {
        await this.runtimeStore.recordStepCompleted({
          taskId: input.taskId.trim(),
          novelId: input.novelId,
          nodeKey: contract.nodeKey,
          label: contract.label,
          targetType: input.targetType,
          targetId: input.targetId,
          producedArtifacts,
        });
        runtimeSnapshot = await this.runtimeStore.getSnapshot(input.taskId.trim());
      }
      return {
        status: "completed",
        output,
        runtimeSnapshot,
        producedArtifacts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (input.taskId?.trim()) {
        await this.runtimeStore.recordStepFailed({
          taskId: input.taskId.trim(),
          novelId: input.novelId,
          nodeKey: contract.nodeKey,
          label: contract.label,
          targetType: input.targetType,
          targetId: input.targetId,
          error: message,
        });
      }
      throw error;
    }
  }
}
