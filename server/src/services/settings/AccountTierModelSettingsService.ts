import type { LLMProvider } from "@ai-novel/shared/types/llm";
import { prisma } from "../../db/prisma";

const ACCOUNT_TIER_MODEL_SETTING_KEY = "llm.accountTierModels";

export type AccountTierModelKey = "trial" | "paid";

export interface AccountTierModelConfig {
  provider: LLMProvider;
  model: string;
}

export interface AccountTierModelSettings {
  trial: AccountTierModelConfig | null;
  paid: AccountTierModelConfig | null;
}

export type SaveAccountTierModelSettingsInput = Partial<AccountTierModelSettings>;

function normalizeProvider(value: unknown): LLMProvider | null {
  return typeof value === "string" && value.trim() ? (value.trim() as LLMProvider) : null;
}

function normalizeModel(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeConfig(value: unknown): AccountTierModelConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  const provider = normalizeProvider(payload.provider);
  const model = normalizeModel(payload.model);
  return provider && model ? { provider, model } : null;
}

function normalizeSettings(value: unknown): AccountTierModelSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { trial: null, paid: null };
  }
  const payload = value as Record<string, unknown>;
  return {
    trial: normalizeConfig(payload.trial),
    paid: normalizeConfig(payload.paid),
  };
}

function parseSettingsPayload(value: string): AccountTierModelSettings {
  try {
    return normalizeSettings(JSON.parse(value));
  } catch {
    return { trial: null, paid: null };
  }
}

function serializeSettings(input: AccountTierModelSettings): string {
  return JSON.stringify(normalizeSettings(input));
}

export async function getAccountTierModelSettings(): Promise<AccountTierModelSettings> {
  const record = await prisma.appSetting.findUnique({
    where: { key: ACCOUNT_TIER_MODEL_SETTING_KEY },
  });
  return record ? parseSettingsPayload(record.value) : { trial: null, paid: null };
}

export async function saveAccountTierModelSettings(
  input: SaveAccountTierModelSettingsInput,
): Promise<AccountTierModelSettings> {
  const current = await getAccountTierModelSettings();
  const settings: AccountTierModelSettings = normalizeSettings({
    trial: input.trial === undefined ? current.trial : input.trial,
    paid: input.paid === undefined ? current.paid : input.paid,
  });
  await prisma.appSetting.upsert({
    where: { key: ACCOUNT_TIER_MODEL_SETTING_KEY },
    update: { value: serializeSettings(settings) },
    create: { key: ACCOUNT_TIER_MODEL_SETTING_KEY, value: serializeSettings(settings) },
  });
  return settings;
}

export function resolveAccountTierModelKey(accountTier: string | null | undefined): AccountTierModelKey {
  return accountTier === "paid" ? "paid" : "trial";
}
