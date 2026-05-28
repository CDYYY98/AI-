import axios, { AxiosError } from "axios";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { API_BASE_URL, API_TIMEOUT_MS } from "@/lib/constants";
import { toast } from "@/components/ui/toast";

export interface ApiHttpError extends Error {
  status?: number;
  details?: unknown;
}

declare module "axios" {
  interface AxiosRequestConfig {
    silentErrorStatuses?: number[];
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

const TOKEN_KEY = "ai_novel_token";

apiClient.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTO_DISMISS_SERVER_ERROR_TOAST = {
  duration: 4000,
  closeButton: false,
} as const;

const INSPIRATION_PER_USD = 33333;

function normalizeQuotaErrorMessage(message: string): string | null {
  const normalized = message.replace(/＄/g, "$");
  const isQuotaError = /token quota is not enough|insufficient balance|quota.*not enough|额度不足|余额不足|预扣费额度失败|用户剩余额度|需要预扣费额度/i
    .test(normalized);
  if (!isQuotaError) {
    return null;
  }

  const match = normalized.match(/(?:remain quota|用户剩余额度)[:：]\s*\$?\s*([0-9.]+).*?(?:need quota|需要预扣费额度)[:：]\s*\$?\s*([0-9.]+)/i);
  if (/预扣费额度失败|需要预扣费额度/i.test(normalized)) {
    const remain = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(remain)) {
      return "灵感值不足，请补充灵感值后继续。";
    }
    const remainInspiration = Math.max(0, Math.floor(remain * INSPIRATION_PER_USD));
    return `灵感值不足，当前剩余 ${remainInspiration.toLocaleString("zh-CN")} 灵感值，请补充后继续。`;
  }
  if (!match) {
    return "灵感值不足，请补充灵感值后继续。";
  }

  const remain = Number(match[1]);
  const need = Number(match[2]);
  if (!Number.isFinite(remain) || !Number.isFinite(need)) {
    return "灵感值不足，请补充灵感值后继续。";
  }

  const remainInspiration = Math.max(0, Math.floor(remain * INSPIRATION_PER_USD));
  const needInspiration = Math.max(1, Math.ceil(need * INSPIRATION_PER_USD));
  return `灵感值不足，本次操作预计需要 ${needInspiration.toLocaleString("zh-CN")} 灵感值，当前剩余 ${remainInspiration.toLocaleString("zh-CN")} 灵感值。`;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status;
    const backendError = error.response?.data?.error;
    const backendMessage = error.response?.data?.message;
    const silentErrorStatuses = error.config?.silentErrorStatuses ?? [];
    let title = backendError ?? error.message ?? "请求失败。";
    let description = backendMessage && backendMessage !== backendError ? backendMessage : undefined;

    const quotaMessage = normalizeQuotaErrorMessage(`${title} ${description ?? ""}`);
    if (quotaMessage) {
      title = quotaMessage;
      description = undefined;
    }

    if (!status) {
      title = "网络连接失败，请检查网络后重试。";
      description = undefined;
    } else if (status >= 500) {
      title = backendError ?? "服务器错误，请稍后重试。";
      description = backendMessage && backendMessage !== title ? backendMessage : undefined;
    }

    const finalQuotaMessage = normalizeQuotaErrorMessage(`${title} ${description ?? ""}`);
    if (finalQuotaMessage) {
      title = finalQuotaMessage;
      description = undefined;
    }

    if (!status || !silentErrorStatuses.includes(status)) {
      const isGenericServerErrorToast = title === "服务器错误，请稍后重试。";

      if (description) {
        toast.error(
          title,
          isGenericServerErrorToast
            ? {
                description,
                ...AUTO_DISMISS_SERVER_ERROR_TOAST,
              }
            : { description },
        );
      } else {
        toast.error(title, isGenericServerErrorToast ? AUTO_DISMISS_SERVER_ERROR_TOAST : undefined);
      }
    }

    const message = description ? `${title} ${description}` : title;

    const normalizedError = new Error(
      message,
    ) as ApiHttpError;
    normalizedError.status = status;
    normalizedError.details = error.response?.data;
    return Promise.reject(normalizedError);
  },
);
