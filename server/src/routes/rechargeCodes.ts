import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { newApiService } from "../services/auth/NewApiService";

const router = Router();
const INSPIRATION_PER_QUOTA_UNIT = 33333;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECHARGE_CODE_STATUS = new Set(["unused", "redeeming", "redeemed", "disabled"]);

type RechargeCodeRecord = {
  id: string;
  codeHash: string;
  codePrefix: string;
  codeSuffix: string;
  inspirationAmount: number;
  quotaAmount: number;
  status: string;
  batchName: string | null;
  note: string | null;
  redeemedByUserId: string | null;
  redeemedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type UserQuotaRecord = {
  id: string;
  email: string;
  apiQuota: number;
  apiToken: string | null;
};

const generateSchema = z.object({
  inspirationAmount: z.coerce.number().int().positive().max(10_000_000),
  count: z.coerce.number().int().positive().max(500),
  batchName: z.string().trim().max(80).optional(),
  note: z.string().trim().max(240).optional(),
});

const redeemSchema = z.object({
  code: z.string().trim().min(8).max(80),
});

function inspirationToQuota(value: number): number {
  return value / INSPIRATION_PER_QUOTA_UNIT;
}

function normalizeRechargeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function hashRechargeCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeRechargeCode(code)).digest("hex");
}

function createRechargeCode(): string {
  let body = "";
  while (body.length < 20) {
    const bytes = crypto.randomBytes(20);
    for (const byte of bytes) {
      body += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (body.length >= 20) break;
    }
  }
  return `TL-${body.match(/.{1,4}/g)?.join("-") ?? body}`;
}

function maskRechargeCode(code: string): { prefix: string; suffix: string } {
  const normalized = normalizeRechargeCode(code);
  return {
    prefix: normalized.slice(0, 6),
    suffix: normalized.slice(-4),
  };
}

function publicRechargeCode(row: RechargeCodeRecord) {
  return {
    id: row.id,
    codePrefix: row.codePrefix,
    codeSuffix: row.codeSuffix,
    inspirationAmount: row.inspirationAmount,
    quotaAmount: row.quotaAmount,
    status: row.status,
    batchName: row.batchName,
    note: row.note,
    redeemedByUserId: row.redeemedByUserId,
    redeemedAt: row.redeemedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getRechargeCodeByHash(hash: string): Promise<RechargeCodeRecord | null> {
  const rows = await prisma.$queryRaw<RechargeCodeRecord[]>`
    SELECT *
    FROM "RechargeCode"
    WHERE "codeHash" = ${hash}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function resetReservedCode(codeId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "RechargeCode"
    SET "status" = 'unused',
        "redeemedByUserId" = NULL,
        "redeemedAt" = NULL,
        "updatedAt" = ${new Date()}
    WHERE "id" = ${codeId}
      AND "status" = 'redeeming'
  `;
}

router.post(
  "/redeem",
  requireAuth,
  validate({ body: redeemSchema }),
  async (req, res, next) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "请先登录。" } satisfies ApiResponse<null>);
      return;
    }

    try {
      const { code } = req.body as z.infer<typeof redeemSchema>;
      const codeHash = hashRechargeCode(code);

      const reserved = await prisma.$transaction(async (tx) => {
        const users = await tx.$queryRaw<UserQuotaRecord[]>`
          SELECT "id", "email", "apiQuota", "apiToken"
          FROM "User"
          WHERE "id" = ${userId}
            AND "isActive" = true
          LIMIT 1
        `;
        const user = users[0];
        if (!user) {
          throw new Error("用户不存在或已禁用。");
        }

        const codes = await tx.$queryRaw<RechargeCodeRecord[]>`
          SELECT *
          FROM "RechargeCode"
          WHERE "codeHash" = ${codeHash}
          LIMIT 1
        `;
        const rechargeCode = codes[0];
        if (!rechargeCode) {
          throw new Error("卡密不存在。");
        }
        if (rechargeCode.status === "redeemed") {
          throw new Error("这张卡密已经被兑换。");
        }
        if (rechargeCode.status === "disabled") {
          throw new Error("这张卡密已停用。");
        }
        if (rechargeCode.status !== "unused") {
          throw new Error("这张卡密正在处理，请稍后刷新。");
        }

        const updated = await tx.$executeRaw`
          UPDATE "RechargeCode"
          SET "status" = 'redeeming',
              "redeemedByUserId" = ${user.id},
              "redeemedAt" = ${new Date()},
              "updatedAt" = ${new Date()}
          WHERE "id" = ${rechargeCode.id}
            AND "status" = 'unused'
        `;
        if (updated !== 1) {
          throw new Error("这张卡密正在处理，请稍后刷新。");
        }

        return { user, rechargeCode };
      });

      try {
        const token = await newApiService.createToken(reserved.user.email);
        await newApiService.updateQuota(reserved.user.email, reserved.rechargeCode.quotaAmount);

        await prisma.$transaction(async (tx) => {
          const afterQuota = reserved.user.apiQuota + reserved.rechargeCode.quotaAmount;
          await tx.$executeRaw`
            UPDATE "User"
            SET "apiQuota" = "apiQuota" + ${reserved.rechargeCode.quotaAmount},
                "apiToken" = ${token.key},
                "apiTokenName" = ${token.name},
                "accountTier" = 'paid',
                "updatedAt" = ${new Date()}
            WHERE "id" = ${reserved.user.id}
          `;
          await tx.$executeRaw`
            UPDATE "RechargeCode"
            SET "status" = 'redeemed',
                "updatedAt" = ${new Date()}
            WHERE "id" = ${reserved.rechargeCode.id}
          `;
          await tx.$executeRaw`
            INSERT INTO "CreditTransaction" (
              "id",
              "userId",
              "type",
              "inspirationDelta",
              "quotaDelta",
              "beforeQuota",
              "afterQuota",
              "referenceId",
              "note",
              "createdAt"
            ) VALUES (
              ${crypto.randomUUID()},
              ${reserved.user.id},
              'recharge_code',
              ${reserved.rechargeCode.inspirationAmount},
              ${reserved.rechargeCode.quotaAmount},
              ${reserved.user.apiQuota},
              ${afterQuota},
              ${reserved.rechargeCode.id},
              ${reserved.rechargeCode.batchName ?? reserved.rechargeCode.note ?? null},
              ${new Date()}
            )
          `;
        });
      } catch (error) {
        await resetReservedCode(reserved.rechargeCode.id).catch(() => {});
        throw error;
      }

      const updatedCode = await getRechargeCodeByHash(codeHash);
      let remainQuota = reserved.user.apiQuota + reserved.rechargeCode.quotaAmount;
      let usedQuota = 0;
      try {
        const quota = await newApiService.getUserQuota(reserved.user.email);
        if (quota) {
          remainQuota = quota.remainQuota;
          usedQuota = quota.usedQuota;
        }
      } catch {
        // Keep the local balance in the response if New API is temporarily unavailable.
      }

      const data = {
        code: updatedCode ? publicRechargeCode(updatedCode) : null,
        quota: {
          remainQuota,
          usedQuota,
          totalQuota: remainQuota + usedQuota,
          accountTier: "paid",
        },
      };

      res.status(200).json({
        success: true,
        data,
        message: `兑换成功，已增加 ${reserved.rechargeCode.inspirationAmount.toLocaleString("zh-CN")} 灵感值。`,
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, error: error.message } satisfies ApiResponse<null>);
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/admin/generate",
  requireAdmin,
  validate({ body: generateSchema }),
  async (req, res, next) => {
    try {
      const adminId = req.auth?.userId ?? null;
      const body = req.body as z.infer<typeof generateSchema>;
      const quotaAmount = inspirationToQuota(body.inspirationAmount);
      const batchName = body.batchName || null;
      const note = body.note || null;
      const generated: Array<ReturnType<typeof publicRechargeCode> & { code: string }> = [];

      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < body.count; index += 1) {
          const code = createRechargeCode();
          const { prefix, suffix } = maskRechargeCode(code);
          const row = {
            id: crypto.randomUUID(),
            codeHash: hashRechargeCode(code),
            codePrefix: prefix,
            codeSuffix: suffix,
            inspirationAmount: body.inspirationAmount,
            quotaAmount,
            status: "unused",
            batchName,
            note,
            redeemedByUserId: null,
            redeemedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await tx.$executeRaw`
            INSERT INTO "RechargeCode" (
              "id",
              "codeHash",
              "codePrefix",
              "codeSuffix",
              "inspirationAmount",
              "quotaAmount",
              "status",
              "batchName",
              "note",
              "createdByAdminId",
              "createdAt",
              "updatedAt"
            ) VALUES (
              ${row.id},
              ${row.codeHash},
              ${row.codePrefix},
              ${row.codeSuffix},
              ${row.inspirationAmount},
              ${row.quotaAmount},
              ${row.status},
              ${row.batchName},
              ${row.note},
              ${adminId},
              ${row.createdAt},
              ${row.updatedAt}
            )
          `;
          generated.push({ ...publicRechargeCode(row), code });
        }
      });

      res.status(201).json({
        success: true,
        data: generated,
        message: `已生成 ${generated.length} 张卡密。完整卡密只在本次显示。`,
      } satisfies ApiResponse<typeof generated>);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    const rawStatus = typeof req.query.status === "string" ? req.query.status : "";
    const status = RECHARGE_CODE_STATUS.has(rawStatus) ? rawStatus : "";
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const statusFilter = status ? Prisma.sql`WHERE rc."status" = ${status}` : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<RechargeCodeRecord & {
      redeemedByEmail: string | null;
      createdByEmail: string | null;
    }>>(Prisma.sql`
      SELECT
        rc.*,
        redeemed."email" AS "redeemedByEmail",
        creator."email" AS "createdByEmail"
      FROM "RechargeCode" rc
      LEFT JOIN "User" redeemed ON redeemed."id" = rc."redeemedByUserId"
      LEFT JOIN "User" creator ON creator."id" = rc."createdByAdminId"
      ${statusFilter}
      ORDER BY rc."createdAt" DESC
      LIMIT ${limit}
    `);

    const data = rows.map((row) => ({
      ...publicRechargeCode(row),
      redeemedByEmail: row.redeemedByEmail,
      createdByEmail: row.createdByEmail,
    }));

    res.status(200).json({
      success: true,
      data,
      message: "卡密列表已加载。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/:id/disable", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    const updated = await prisma.$executeRaw`
      UPDATE "RechargeCode"
      SET "status" = 'disabled',
          "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
        AND "status" = 'unused'
    `;

    if (updated !== 1) {
      res.status(400).json({
        success: false,
        error: "只能停用未使用的卡密。",
      } satisfies ApiResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      message: "卡密已停用。",
    } satisfies ApiResponse<null>);
  } catch (error) {
    next(error);
  }
});

export default router;
