import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { prisma } from "../db/prisma";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/users", requireAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
      success: true,
      data: users,
      message: "用户列表已加载。",
    } satisfies ApiResponse<typeof users>);
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

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    res.status(200).json({
      success: true,
      data: user,
      message: "用户信息已更新。",
    } satisfies ApiResponse<typeof user>);
  } catch (error) {
    next(error);
  }
});

export default router;
