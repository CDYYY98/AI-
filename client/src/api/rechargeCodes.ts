import type { ApiResponse } from "@ai-novel/shared/types/api";
import { apiClient } from "./client";

export interface RechargeCodeInfo {
  id: string;
  codePrefix: string;
  codeSuffix: string;
  inspirationAmount: number;
  quotaAmount: number;
  status: "unused" | "redeeming" | "redeemed" | "disabled" | string;
  batchName?: string | null;
  note?: string | null;
  redeemedByUserId?: string | null;
  redeemedByEmail?: string | null;
  createdByEmail?: string | null;
  redeemedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedRechargeCode extends RechargeCodeInfo {
  code: string;
}

export interface RechargeCodeRedeemResult {
  code: RechargeCodeInfo | null;
  quota: {
    remainQuota: number;
    usedQuota: number;
    totalQuota: number;
    accountTier: string;
  };
}

export async function redeemRechargeCode(code: string) {
  const { data } = await apiClient.post<ApiResponse<RechargeCodeRedeemResult>>("/recharge-codes/redeem", { code });
  return data;
}

export async function listRechargeCodes(status?: string) {
  const { data } = await apiClient.get<ApiResponse<RechargeCodeInfo[]>>("/recharge-codes/admin", {
    params: {
      ...(status ? { status } : {}),
      limit: 200,
    },
  });
  return data;
}

export async function generateRechargeCodes(payload: {
  inspirationAmount: number;
  count: number;
  batchName?: string;
  note?: string;
}) {
  const { data } = await apiClient.post<ApiResponse<GeneratedRechargeCode[]>>("/recharge-codes/admin/generate", payload);
  return data;
}

export async function disableRechargeCode(id: string) {
  const { data } = await apiClient.patch<ApiResponse<null>>(`/recharge-codes/admin/${id}/disable`);
  return data;
}
