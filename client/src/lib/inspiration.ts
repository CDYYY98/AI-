export const INSPIRATION_PER_USD = 33333;
export const TRIAL_GRANT_USD = 0.03;
export const RECHARGE_PACKAGES = [
  { yuan: 1, inspiration: 5000 },
  { yuan: 5, inspiration: 26000 },
  { yuan: 10, inspiration: 55000 },
  { yuan: 20, inspiration: 115000 },
  { yuan: 50, inspiration: 300000 },
] as const;

export function quotaToInspiration(value: number | null | undefined): number {
  const quota = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.round(quota * INSPIRATION_PER_USD));
}

export function formatInspiration(value: number | null | undefined): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));
}

export function formatYuan(value: number | null | undefined): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `¥${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(amount)}`;
}

export function paymentAmountToInspiration(value: number | null | undefined): number {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const packageMatch = RECHARGE_PACKAGES.find((item) => item.yuan === amount);
  return packageMatch?.inspiration ?? Math.max(0, Math.round(amount * 5000));
}

export function resolveAccountPlanByTier(accountTier: string | null | undefined): {
  label: string;
  description: string;
  modelLabel: string;
  isTrial: boolean;
} {
  const isTrial = accountTier !== "paid";
  return isTrial
    ? {
        label: "体验账户",
        description: "适合试用选题、设定和少量生成。",
        modelLabel: "体验创作模型",
        isTrial,
      }
    : {
        label: "创作账户",
        description: "已解锁正式创作额度和更完整的生成能力。",
        modelLabel: "高质量创作模型",
        isTrial,
      };
}
