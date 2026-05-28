import type { LLMProvider } from "@ai-novel/shared/types/llm";
import type { ModelRouteRequestProtocol } from "@ai-novel/shared/types/novel";
import { ChatOpenAI } from "@langchain/openai";
import type { PromptInvocationMeta } from "../prompting/core/promptTypes";
import { prisma } from "../db/prisma";
import { newApiService } from "../services/auth/NewApiService";
import {
  getAccountTierModelSettings,
  resolveAccountTierModelKey,
  type AccountTierModelConfig,
  type AccountTierModelKey,
} from "../services/settings/AccountTierModelSettingsService";
import { secretStore } from "../services/settings/secretStore";
import { resolveModelTemperature } from "./capabilities";
import { createAnthropicLLM } from "./anthropicClient";
import { attachLLMDebugLogging } from "./debugLogging";
import { attachLLMRequestLimiter } from "./requestLimiter";
import { attachLLMRequestGuard } from "./requestGuard";
import { resolveProviderReasoningBehavior } from "./reasoning";
import {
  resolveStructuredOutputProfile,
  type StructuredExecutionMode,
  type StructuredOutputProfile,
  type StructuredOutputStrategy,
} from "./structuredOutput";
import { attachLLMUsageTracking, getCurrentLlmUsageTrackingContext } from "./usageTracking";
import { resolveModel, toStructuredOutputStrategy, type TaskType } from "./modelRouter";
import {
  getProviderEnvApiKey,
  getProviderEnvModel,
  isBuiltInProvider,
  providerRequiresApiKey,
  PROVIDERS,
  resolveProviderBaseUrl,
} from "./providers";

interface LLMOptions {
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  timeoutMs?: number;
  reasoningEnabled?: boolean;
  executionMode?: StructuredExecutionMode;
  structuredStrategy?: StructuredOutputStrategy;
  requestProtocol?: ModelRouteRequestProtocol;
  modelKwargs?: Record<string, unknown>;
  fallbackProvider?: LLMProvider;
  taskType?: TaskType;
  promptMeta?: PromptInvocationMeta;
  modelRoute?: string;
  routeDegraded?: boolean;
  skipAccountTierModelRouting?: boolean;
}

export interface ProviderSecret {
  key?: string;
  model?: string;
  baseURL?: string;
  displayName?: string;
  reasoningEnabled?: boolean;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
}

export interface ResolvedLLMClientOptions {
  provider: LLMProvider;
  providerName: string;
  model: string;
  temperature: number;
  apiKey?: string;
  baseURL: string;
  maxTokens?: number;
  timeoutMs?: number;
  concurrencyLimit: number;
  requestIntervalMs: number;
  reasoningEnabled: boolean;
  modelKwargs?: Record<string, unknown>;
  includeRawResponse: boolean;
  requestProtocol: ModelRouteRequestProtocol;
  executionMode: StructuredExecutionMode;
  structuredProfile?: StructuredOutputProfile | null;
  structuredStrategy?: StructuredOutputStrategy | null;
  reasoningForcedOff: boolean;
  taskType?: TaskType;
  promptMeta?: PromptInvocationMeta;
  modelRoute?: string;
  routeDegraded?: boolean;
}

const providerSecrets = new Map<LLMProvider, ProviderSecret>();
const RESOLVED_LLM_OPTIONS = Symbol("RESOLVED_LLM_OPTIONS");

type ChatOpenAIWithResolvedOptions = ChatOpenAI & {
  [RESOLVED_LLM_OPTIONS]?: ResolvedLLMClientOptions;
};

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "P2021"
  );
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeNewApiBaseUrl(value: string | undefined): string {
  return (value?.trim() || "http://127.0.0.1:3001").replace(/\/+$/u, "") + "/v1";
}

function shouldNormalizeDeveloperRole(baseURL: string): boolean {
  try {
    const host = new URL(baseURL).host.toLowerCase();
    return host !== "api.openai.com";
  } catch {
    return true;
  }
}

function normalizeDeveloperRolePayload(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const payload = body as { messages?: Array<Record<string, unknown>>; input?: unknown };
  const normalizedMessages = Array.isArray(payload.messages)
    ? payload.messages.map((message) => (
      message?.role === "developer"
        ? { ...message, role: "system" }
        : message
    ))
    : undefined;

  if (!normalizedMessages) {
    return body;
  }

  return {
    ...payload,
    messages: normalizedMessages,
  };
}

function createDeveloperRoleCompatibilityFetch(baseURL: string): typeof fetch | undefined {
  if (!shouldNormalizeDeveloperRole(baseURL) || typeof fetch !== "function") {
    return undefined;
  }

  return async (input, init) => {
    const body = init?.body;
    if (typeof body !== "string" || !body.includes('"developer"')) {
      return fetch(input, init);
    }

    try {
      const normalizedBody = JSON.stringify(normalizeDeveloperRolePayload(JSON.parse(body)));
      return fetch(input, { ...init, body: normalizedBody });
    } catch {
      return fetch(input, init);
    }
  };
}

async function resolveUsageApiToken(): Promise<string | undefined> {
  const usageContext = getCurrentLlmUsageTrackingContext();
  const existingToken = normalizeOptionalText(usageContext?.userApiToken);
  if (existingToken) {
    return existingToken;
  }
  const userEmail = normalizeOptionalText(usageContext?.userEmail);
  if (!userEmail) {
    return undefined;
  }
  const token = await newApiService.createToken(userEmail).catch(() => null);
  return normalizeOptionalText(token?.key);
}

async function resolveAccountTierModelOverride(
  options: LLMOptions,
): Promise<{
  tier: AccountTierModelKey;
  config: AccountTierModelConfig;
} | null> {
  if (options.skipAccountTierModelRouting) {
    return null;
  }

  const usageContext = getCurrentLlmUsageTrackingContext();
  const userId = normalizeOptionalText(usageContext?.userId);
  const userEmail = normalizeOptionalText(usageContext?.userEmail);
  if (!userId && !userEmail) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(userId ? [{ id: userId }] : []),
        ...(userEmail ? [{ email: userEmail }] : []),
      ],
    },
    select: {
      role: true,
      accountTier: true,
    },
  }).catch(() => null);
  if (!user || user.role === "admin") {
    return null;
  }

  const tier = resolveAccountTierModelKey(user.accountTier);
  const settings = await getAccountTierModelSettings().catch(() => null);
  const config = settings?.[tier] ?? null;
  return config ? { tier, config } : null;
}

function normalizeOptionalTimeoutMs(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function normalizeProviderSecret(secret: ProviderSecret): ProviderSecret {
  return {
    key: normalizeOptionalText(secret.key),
    model: normalizeOptionalText(secret.model),
    baseURL: normalizeOptionalText(secret.baseURL),
    displayName: normalizeOptionalText(secret.displayName),
    reasoningEnabled: secret.reasoningEnabled ?? true,
    concurrencyLimit: normalizeLimitValue(secret.concurrencyLimit),
    requestIntervalMs: normalizeLimitValue(secret.requestIntervalMs),
  };
}

function normalizeLimitValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function toProviderSecret(item: {
  key?: string | null;
  model?: string | null;
  baseURL?: string | null;
  displayName?: string | null;
  reasoningEnabled?: boolean | null;
  concurrencyLimit?: number | null;
  requestIntervalMs?: number | null;
}): ProviderSecret {
  return normalizeProviderSecret({
    key: item.key ?? undefined,
    model: item.model ?? undefined,
    baseURL: item.baseURL ?? undefined,
    displayName: item.displayName ?? undefined,
    reasoningEnabled: item.reasoningEnabled ?? undefined,
    concurrencyLimit: normalizeLimitValue(item.concurrencyLimit),
    requestIntervalMs: normalizeLimitValue(item.requestIntervalMs),
  });
}

export async function loadProviderApiKeys(): Promise<void> {
  try {
    const keys = await secretStore.listProviders({ onlyActive: true });
    providerSecrets.clear();
    for (const item of keys) {
      providerSecrets.set(item.provider as LLMProvider, toProviderSecret(item));
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return;
    }
    throw error;
  }
}

export function setProviderSecretCache(provider: LLMProvider, secret: ProviderSecret | null): void {
  if (!secret) {
    providerSecrets.delete(provider);
    return;
  }
  providerSecrets.set(provider, normalizeProviderSecret(secret));
}

async function resolveProviderSecret(provider: LLMProvider): Promise<ProviderSecret | undefined> {
  const cached = providerSecrets.get(provider);
  if (cached) {
    return cached;
  }
  try {
    const secret = await secretStore.getProvider(provider);
    if (!secret || !secret.isActive) {
      return undefined;
    }
    const value = toProviderSecret(secret);
    providerSecrets.set(provider, value);
    return value;
  } catch (error) {
    if (isMissingTableError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function resolveLLMClientOptions(
  provider?: LLMProvider,
  rawOptions: LLMOptions = {},
): Promise<ResolvedLLMClientOptions> {
  const options: LLMOptions = { ...rawOptions };
  let resolvedProvider = provider ?? options.fallbackProvider ?? "deepseek";
  let resolvedModel = normalizeOptionalText(options.model);
  let resolvedTemperature: number | undefined = options.temperature;
  let resolvedMaxTokens: number | undefined = options.maxTokens;
  let resolvedModelRoute: string | undefined;
  let resolvedRouteDegraded = false;

  if (options.taskType) {
    const hasExplicitProvider = provider != null;
    const hasExplicitModel = options.model != null;
    const shouldUseRouteProvider = !hasExplicitProvider && !hasExplicitModel;
    const route = await resolveModel(options.taskType, {
      ...(shouldUseRouteProvider ? {} : { provider: resolvedProvider }),
      ...(options.model != null ? { model: options.model } : {}),
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.maxTokens != null ? { maxTokens: options.maxTokens } : {}),
    });
    if (shouldUseRouteProvider) {
      resolvedProvider = route.provider;
    }
    if (options.model == null && shouldUseRouteProvider) {
      resolvedModel = normalizeOptionalText(route.model);
    }
    if (options.temperature == null) {
      resolvedTemperature = route.temperature;
    }
    if (options.maxTokens == null) {
      resolvedMaxTokens = route.maxTokens;
    }
    if (options.requestProtocol == null) {
      options.requestProtocol = route.requestProtocol;
    }
    if (options.structuredStrategy == null) {
      const routeStructuredStrategy = toStructuredOutputStrategy(route.structuredResponseFormat);
      if (routeStructuredStrategy) {
        options.structuredStrategy = routeStructuredStrategy;
      }
    }
    resolvedModelRoute = route.routeKey;
    resolvedRouteDegraded = route.routeDegraded;
  }

  const accountTierModel = await resolveAccountTierModelOverride(options);
  if (accountTierModel) {
    resolvedProvider = accountTierModel.config.provider;
    resolvedModel = accountTierModel.config.model;
    resolvedModelRoute = resolvedModelRoute
      ? `${resolvedModelRoute}:account_tier_${accountTierModel.tier}`
      : `account_tier_${accountTierModel.tier}`;
  }

  const dbSecret = await resolveProviderSecret(resolvedProvider);
  const providerName = isBuiltInProvider(resolvedProvider)
    ? PROVIDERS[resolvedProvider].name
    : dbSecret?.displayName ?? resolvedProvider;
  const userApiToken = await resolveUsageApiToken();
  const apiKey = userApiToken
    ?? normalizeOptionalText(options.apiKey)
    ?? dbSecret?.key
    ?? getProviderEnvApiKey(resolvedProvider);
  if (userApiToken) {
    console.log(`[llm.billing] mode=user_token provider=${resolvedProvider} model=${resolvedModel ?? dbSecret?.model ?? getProviderEnvModel(resolvedProvider) ?? "unknown"}`);
  }

  if (!apiKey && providerRequiresApiKey(resolvedProvider)) {
    throw new Error(`未配置 ${providerName} 的 API Key。`);
  }

  const model = resolvedModel
    ?? dbSecret?.model
    ?? getProviderEnvModel(resolvedProvider)
    ?? (isBuiltInProvider(resolvedProvider) ? PROVIDERS[resolvedProvider].defaultModel : undefined);
  if (!model) {
    throw new Error(`未配置 ${providerName} 的默认模型。`);
  }

  const baseURL = userApiToken
    ? normalizeNewApiBaseUrl(process.env.NEW_API_URL)
    : resolveProviderBaseUrl(
      resolvedProvider,
      options.baseURL ?? dbSecret?.baseURL,
      dbSecret?.baseURL,
    );
  if (!baseURL) {
    throw new Error(`未配置 ${providerName} 的 API URL。`);
  }

  const temperature = resolveModelTemperature(resolvedProvider, model, resolvedTemperature);
  const timeoutMs = normalizeOptionalTimeoutMs(options.timeoutMs);
  const concurrencyLimit = normalizeLimitValue(dbSecret?.concurrencyLimit);
  const requestIntervalMs = normalizeLimitValue(dbSecret?.requestIntervalMs);
  const requestProtocol = userApiToken ? "openai_compatible" : (options.requestProtocol === "anthropic" ? "anthropic" : "openai_compatible");
  const structuredStrategy = options.structuredStrategy;
  const executionMode = options.executionMode ?? "plain";
  const structuredProfile = executionMode === "structured"
    ? resolveStructuredOutputProfile({
      provider: resolvedProvider,
      model,
      baseURL,
      executionMode,
      requestProtocol,
    })
    : null;
  const usesNativeStructured = structuredStrategy != null && structuredStrategy !== "prompt_json";
  const requestedReasoningEnabled = options.reasoningEnabled ?? dbSecret?.reasoningEnabled ?? true;
  const shouldForceDisableReasoning = Boolean(
    structuredProfile
      && structuredProfile.requiresNonThinkingForStructured
      && structuredProfile.supportsReasoningToggle,
  );
  const reasoningEnabled = shouldForceDisableReasoning ? false : requestedReasoningEnabled;
  let effectiveMaxTokens = resolvedMaxTokens;
  if (structuredProfile && usesNativeStructured && structuredProfile.omitMaxTokensForNativeStructured) {
    effectiveMaxTokens = undefined;
  } else if (
    structuredProfile
    && typeof structuredProfile.safeStructuredMaxTokens === "number"
    && typeof effectiveMaxTokens === "number"
  ) {
    effectiveMaxTokens = Math.min(effectiveMaxTokens, structuredProfile.safeStructuredMaxTokens);
  }
  const baseModelKwargs: Record<string, unknown> = {
    ...(options.modelKwargs ?? {}),
    ...(shouldForceDisableReasoning ? { enable_thinking: false } : {}),
  };
  const reasoningBehavior = resolveProviderReasoningBehavior({
    provider: resolvedProvider,
    baseURL,
    model,
    reasoningEnabled,
  });
  const modelKwargs = {
    ...(reasoningBehavior.modelKwargs ?? {}),
    ...baseModelKwargs,
  };

  return {
    provider: resolvedProvider,
    providerName,
    model,
    temperature,
    apiKey,
    baseURL,
    maxTokens: effectiveMaxTokens,
    timeoutMs,
    concurrencyLimit,
    requestIntervalMs,
    reasoningEnabled: reasoningBehavior.reasoningEnabled,
    modelKwargs: Object.keys(modelKwargs).length > 0 ? modelKwargs : undefined,
    includeRawResponse: reasoningBehavior.includeRawResponse,
    requestProtocol,
    executionMode,
    structuredProfile,
    structuredStrategy: structuredStrategy ?? null,
    reasoningForcedOff: shouldForceDisableReasoning && requestedReasoningEnabled,
    taskType: options.taskType,
    promptMeta: options.promptMeta,
    modelRoute: resolvedModelRoute,
    routeDegraded: resolvedRouteDegraded,
  };
}

export function createLLMFromResolvedOptions(resolved: ResolvedLLMClientOptions): ChatOpenAI {
  const llm = resolved.requestProtocol === "anthropic"
    ? createAnthropicLLM({
      apiKey: resolved.apiKey,
      model: resolved.model,
      baseURL: resolved.baseURL,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
      timeoutMs: resolved.timeoutMs,
    }) as ChatOpenAI
    : new ChatOpenAI({
      apiKey: resolved.apiKey ?? "ollama",
      model: resolved.model,
      modelName: resolved.model,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
      timeout: resolved.timeoutMs,
      modelKwargs: resolved.modelKwargs,
      __includeRawResponse: resolved.includeRawResponse,
      configuration: {
        baseURL: resolved.baseURL,
        fetch: createDeveloperRoleCompatibilityFetch(resolved.baseURL),
      },
    });
  const meta = {
    provider: resolved.provider,
    model: resolved.model,
    temperature: resolved.temperature,
    maxTokens: resolved.maxTokens,
    timeoutMs: resolved.timeoutMs,
    taskType: resolved.taskType,
    modelRoute: resolved.modelRoute,
    routeDegraded: resolved.routeDegraded,
    baseURL: resolved.baseURL,
    promptMeta: resolved.promptMeta,
  };
  const decorated = attachLLMDebugLogging(attachLLMUsageTracking(attachLLMRequestGuard(llm, meta), meta), meta);
  const limited = attachLLMRequestLimiter(decorated, {
    provider: resolved.provider,
    model: resolved.model,
    concurrencyLimit: resolved.concurrencyLimit,
    requestIntervalMs: resolved.requestIntervalMs,
  });
  (limited as ChatOpenAIWithResolvedOptions)[RESOLVED_LLM_OPTIONS] = resolved;
  return limited;
}

async function getFallbackProviders(): Promise<Array<{ provider: string; model: string }>> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "model_fallbacks" } });
    if (!setting?.value) return [];
    const list = JSON.parse(setting.value) as Array<{ provider: string; model: string }>;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function getLLM(provider?: LLMProvider, options: LLMOptions = {}): Promise<ChatOpenAI> {
  const resolved = await resolveLLMClientOptions(provider, options);
  const fallbacks = await getFallbackProviders();
  const llm = createLLMFromResolvedOptions(resolved);

  if (fallbacks.length === 0) return llm;

  // 包装 invoke/stream，失败时自动切换
  return wrapWithFallback(llm, resolved, fallbacks, options) as ChatOpenAI;
}

function wrapWithFallback(
  primary: ChatOpenAI,
  resolved: ResolvedLLMClientOptions,
  fallbacks: Array<{ provider: string; model: string }>,
  options: LLMOptions,
): ChatOpenAI {
  let triedCount = 0;

  const tryFallback = async (): Promise<ChatOpenAI | null> => {
    if (triedCount >= fallbacks.length) return null;
    const fb = fallbacks[triedCount++];
    try {
      const fbResolved = await resolveLLMClientOptions(fb.provider as LLMProvider, {
        ...options,
        model: fb.model,
        temperature: options.temperature ?? resolved.temperature,
        taskType: options.taskType,
        skipAccountTierModelRouting: true,
      });
      return createLLMFromResolvedOptions(fbResolved);
    } catch {
      return tryFallback();
    }
  };

  const isAuthError = (error: unknown): boolean => {
    const msg = String(error?.toString?.() ?? "");
    return /authentication|unauthorized|invalid.*api.?key|quota.*exceeded|insufficient.*balance|rate.?limit.*exceeded/i.test(msg);
  };

  const patchInvoke = (llm: ChatOpenAI) => {
    const origInvoke = llm.invoke.bind(llm);
    llm.invoke = (async (input: any, options?: any) => {
      try {
        return await origInvoke(input, options);
      } catch (error) {
        if (!isAuthError(error)) throw error;
        const fb = await tryFallback();
        if (!fb) throw error;
        return fb.invoke(input, options);
      }
    }) as any;
  };

  patchInvoke(primary);
  return primary;
}

export function getResolvedLLMClientOptionsFromInstance(llm: ChatOpenAI): ResolvedLLMClientOptions | undefined {
  return (llm as ChatOpenAIWithResolvedOptions)[RESOLVED_LLM_OPTIONS];
}
