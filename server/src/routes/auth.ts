import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { authService } from "../services/auth/AuthService";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const registerSchema = z.object({
  username: z.string().trim().min(2).max(30),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.post(
  "/register",
  validate({ body: registerSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof registerSchema>;
      const result = await authService.register(body);
      res.status(200).json({
        success: true,
        data: result,
        message: "验证码已发送。",
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          error: error.message,
        } satisfies ApiResponse<null>);
        return;
      }
      next(error);
    }
  },
);

const verifySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().length(6),
});

router.post(
  "/verify-email",
  validate({ body: verifySchema }),
  async (req, res, next) => {
    try {
      const { email, code } = req.body as z.infer<typeof verifySchema>;
      const result = await authService.verifyEmail(email, code);
      res.status(201).json({
        success: true,
        data: result,
        message: "注册成功。",
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          error: error.message,
        } satisfies ApiResponse<null>);
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof loginSchema>;
      const result = await authService.login(body);
      res.status(200).json({
        success: true,
        data: result,
        message: "登录成功。",
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({
          success: false,
          error: error.message,
        } satisfies ApiResponse<null>);
        return;
      }
      next(error);
    }
  },
);

router.get("/me", authMiddleware, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: "请先登录。" });
    return;
  }
  const user = await authService.getUserById(userId);
  if (!user) {
    res.status(401).json({
      success: false,
      error: "用户不存在或已禁用。",
    } satisfies ApiResponse<null>);
    return;
  }
  res.status(200).json({
    success: true,
    data: user,
    message: "已获取用户信息。",
  } satisfies ApiResponse<typeof user>);
});

router.get("/quota", authMiddleware, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: "请先登录。" });
    return;
  }
  const user = await authService.getUserById(userId);
  if (!user) {
    res.status(401).json({ success: false, error: "用户不存在。" });
    return;
  }
  const info = await authService.getUserQuota(userId);
  res.status(200).json({
    success: true,
    data: info,
    message: "已获取额度信息。",
  } satisfies ApiResponse<typeof info>);
});

export default router;
