import type { NextFunction, Request, Response } from "express";
import { setUsageTrackingUser } from "../llm/usageTracking";
import { prisma } from "../db/prisma";
import { newApiService } from "../services/auth/NewApiService";

const QUOTA_CHECKED_PREFIXES = [
  "/api/novels",
  "/api/creative-hub",
  "/api/chat",
  "/api/writing-formula",
  "/api/style-",
  "/api/anti-ai-rules",
  "/api/worlds",
  "/api/base-characters",
  "/api/prompt-workbench",
  "/api/knowledge",
  "/api/book-analysis",
  "/api/rag",
  "/api/title-library",
  "/api/genres",
  "/api/story-modes",
];

function shouldCheckQuota(path: string): boolean {
  return QUOTA_CHECKED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function quotaCheckMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.auth?.role === "admin") {
    next();
    return;
  }

  const userId = req.auth?.userId;
  if (!userId) {
    next();
    return;
  }

  const quotaChecked = shouldCheckQuota(req.path);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, apiQuota: true, apiToken: true },
    });
    if (!user) {
      next();
      return;
    }

    let apiToken = user.apiToken?.trim() || null;
    setUsageTrackingUser(userId, user.email, apiToken);

    if (!quotaChecked) {
      next();
      return;
    }

    try {
      const token = await newApiService.createToken(user.email);
      apiToken = token.key;
      await newApiService.repairLegacyQuotaScale(user.email, user.apiQuota);
      if (user.apiToken !== token.key) {
        await prisma.user.update({
          where: { id: userId },
          data: { apiToken: token.key, apiTokenName: token.name },
        });
      }
      setUsageTrackingUser(userId, user.email, apiToken);
    } catch {
      apiToken = user.apiToken?.trim() || null;
      setUsageTrackingUser(userId, user.email, apiToken);
    }

    let remainQuota = user.apiQuota;
    try {
      const quota = await newApiService.getUserQuota(user.email);
      if (quota) {
        remainQuota = quota.remainQuota;
      }
    } catch {
      // Fall back to the local account balance when the New API DB is unavailable.
    }

    if (remainQuota <= 0) {
      res.status(402).json({
        success: false,
        error: "灵感值不足，请补充灵感值后继续。",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
