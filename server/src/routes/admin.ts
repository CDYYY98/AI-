import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { prisma } from "../db/prisma";
import { MODEL_ROUTE_TASK_TYPES } from "../llm/modelRouter";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { newApiService } from "../services/auth/NewApiService";
import {
  getAccountTierModelSettings,
  saveAccountTierModelSettings,
} from "../services/settings/AccountTierModelSettingsService";
import { saveLLMSelectionSettings } from "../services/settings/LLMSelectionSettingsService";

const router = Router();
const INSPIRATION_PER_QUOTA_UNIT = 33333;
const RECHARGE_PACKAGES = [
  { yuan: 1, inspiration: 5000 },
  { yuan: 5, inspiration: 26000 },
  { yuan: 10, inspiration: 55000 },
  { yuan: 20, inspiration: 115000 },
  { yuan: 50, inspiration: 300000 },
] as const;

function quotaToInspiration(value: number): number {
  return Math.max(0, Math.round(value * INSPIRATION_PER_QUOTA_UNIT));
}

function inspirationToQuota(value: number): number {
  return value / INSPIRATION_PER_QUOTA_UNIT;
}

function paymentAmountToInspiration(value: number): number {
  const packageMatch = RECHARGE_PACKAGES.find((item) => item.yuan === value);
  return packageMatch?.inspiration ?? Math.max(0, Math.round(value * 5000));
}

async function enrichAdminUser<T extends { email: string; apiQuota: number }>(user: T) {
  let remainQuota = user.apiQuota;
  let usedQuota = 0;
  try {
    const info = await newApiService.getUserQuota(user.email);
    if (info) {
      remainQuota = info.remainQuota;
      usedQuota = info.usedQuota;
    }
  } catch {
    // Keep local quota visible if the New API DB is temporarily unavailable.
  }
  return { ...user, remainQuota, usedQuota, totalQuota: remainQuota + usedQuota };
}

router.use(authMiddleware);

router.get("/users", requireAdmin, async (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        apiToken: true,
        apiTokenName: true,
        apiQuota: true,
        accountTier: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(users.map((user) => enrichAdminUser(user)));

    res.status(200).json({
      success: true,
      data: enriched,
      message: "用户列表已加载。",
    } satisfies ApiResponse<typeof enriched>);
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/quota", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as Record<string, unknown>;
    const inspirationAmount = Number(body.inspirationAmount);
    const paymentAmount = Number(body.paymentAmount);
    const legacyQuotaAmount = Number(body.amount);
    const resolvedInspirationAmount = Number.isFinite(paymentAmount) && paymentAmount !== 0
      ? paymentAmountToInspiration(paymentAmount)
      : inspirationAmount;
    const amount = Number.isFinite(resolvedInspirationAmount) && resolvedInspirationAmount !== 0
      ? inspirationToQuota(resolvedInspirationAmount)
      : (Number.isFinite(legacyQuotaAmount) ? legacyQuotaAmount : 0);
    if (!id || amount === 0) {
      res.status(400).json({ success: false, error: "参数错误。" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) {
      res.status(404).json({ success: false, error: "用户不存在。" });
      return;
    }

    await prisma.user.update({
      where: { id },
      data: {
        apiQuota: {
          increment: amount,
        },
        ...(amount > 0 ? { accountTier: "paid" } : {}),
      },
    });

    try {
      await newApiService.updateQuota(user.email, amount);
    } catch {
      // Keep the local account balance authoritative if the New API DB is unavailable.
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        apiToken: true,
        apiTokenName: true,
        apiQuota: true,
        accountTier: true,
        createdAt: true,
      },
    });

    const enrichedUpdated = updated ? await enrichAdminUser(updated) : null;

    res.status(200).json({
      success: true,
      data: enrichedUpdated,
      message: amount > 0
        ? `已增加 ${quotaToInspiration(amount)} 灵感值。`
        : `已扣除 ${quotaToInspiration(Math.abs(amount))} 灵感值。`,
    } satisfies ApiResponse<typeof enrichedUpdated>);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ success: false, error: "缺少用户 ID。" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const role = typeof body.role === "string" ? body.role : undefined;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
    const accountTier = body.accountTier === "paid" || body.accountTier === "trial" ? body.accountTier : undefined;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(accountTier !== undefined ? { accountTier } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        apiToken: true,
        apiTokenName: true,
        apiQuota: true,
        accountTier: true,
        createdAt: true,
      },
    });

    const enriched = await enrichAdminUser(user);

    res.status(200).json({
      success: true,
      data: enriched,
      message: "用户信息已更新。",
    } satisfies ApiResponse<typeof enriched>);
  } catch (error) {
    next(error);
  }
});

router.post("/set-default-model", requireAdmin, async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const provider = typeof body.provider === "string" ? body.provider : "";
    const model = typeof body.model === "string" ? body.model : "";
    if (!provider || !model) {
      res.status(400).json({ success: false, error: "缺少 provider 或 model。" });
      return;
    }

    // 1. 写数据库路由
    const tasks = Array.from(new Set([
      ...MODEL_ROUTE_TASK_TYPES,
      "creative_hub_chat",
      "chapter_generation",
      "chapter_review",
      "chapter_repair",
      "director_planner",
    ]));
    const requestProtocol = provider === "anthropic" ? "anthropic" : "openai_compatible";
    for (const task of tasks) {
      await prisma.modelRouteConfig.upsert({
        where: { taskType: task },
        create: {
          taskType: task,
          provider,
          model,
          temperature: 0.7,
          requestProtocol,
          structuredResponseFormat: "prompt_json",
        },
        update: {
          provider,
          model,
          requestProtocol,
          structuredResponseFormat: "prompt_json",
        },
      });
    }

    // 2. 写 LLM 选择
    await saveLLMSelectionSettings({ provider, model, temperature: 0.7 });

    // 3. 更新默认提供商状态
    const apiKey = await prisma.aPIKey.findUnique({ where: { provider } });
    if (apiKey) {
      await prisma.aPIKey.update({ where: { provider }, data: { model } });
    }

    res.status(200).json({ success: true, message: `已切换默认模型为 ${provider}/${model}。重启生效。` });
  } catch (error) {
    next(error);
  }
});

// 管理员联系方式（所有人可读）
router.get("/contact", async (_req, res) => {
  const setting = await prisma.appSetting.findUnique({ where: { key: "admin_contact" } });
  const data = setting ? JSON.parse(setting.value) : {};
  res.json({ success: true, data, message: "" });
});

// 设置管理员联系方式
router.put("/contact", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const value = JSON.stringify({
    wechat: typeof body.wechat === "string" ? body.wechat : "",
    qq: typeof body.qq === "string" ? body.qq : "",
    tips: typeof body.tips === "string" ? body.tips : "付款后截图发送给管理员，秒到账",
  });
  await prisma.appSetting.upsert({
    where: { key: "admin_contact" },
    create: { key: "admin_contact", value },
    update: { value },
  });
  res.json({ success: true, message: "联系方式已更新" });
});

// 模型故障切换链
router.get("/model-fallbacks", requireAdmin, async (_req, res) => {
  const setting = await prisma.appSetting.findUnique({ where: { key: "model_fallbacks" } });
  const data = setting ? JSON.parse(setting.value) : [];
  res.json({ success: true, data });
});

router.put("/model-fallbacks", requireAdmin, async (req, res) => {
  await prisma.appSetting.upsert({
    where: { key: "model_fallbacks" },
    create: { key: "model_fallbacks", value: JSON.stringify(req.body) },
    update: { value: JSON.stringify(req.body) },
  });
  res.json({ success: true, message: "故障切换链已更新" });
});

router.get("/account-tier-models", requireAdmin, async (_req, res, next) => {
  try {
    const data = await getAccountTierModelSettings();
    res.json({ success: true, data, message: "账户模型策略已加载。" });
  } catch (error) {
    next(error);
  }
});

router.put("/account-tier-models", requireAdmin, async (req, res, next) => {
  try {
    const data = await saveAccountTierModelSettings(req.body);
    res.json({ success: true, data, message: "账户模型策略已更新。" });
  } catch (error) {
    next(error);
  }
});

router.get("/logs", requireAdmin, async (_req, res) => {
  try {
    const db = new (require("better-sqlite3"))(process.env.NEW_API_DB_PATH || "/root/new-api/data/one-api.db");
    const rows = db.prepare(
      "SELECT datetime(created_at,'unixepoch','localtime') as time, username as user, model_name as model, prompt_tokens as inputTokens, completion_tokens as outputTokens, quota as cost FROM logs ORDER BY id DESC LIMIT 100",
    ).all() as any[];
    db.close();
    const data = rows.map((r: any) => ({
      time: r.time,
      user: r.user,
      model: r.model,
      inputTokens: r.inputTokens || 0,
      outputTokens: r.outputTokens || 0,
      totalTokens: (r.inputTokens || 0) + (r.outputTokens || 0),
      cost: Math.abs(r.cost || 0) / 100,
    }));
    res.json({ success: true, data });
  } catch {
    res.json({ success: true, data: [] });
  }
});

export default router;
