import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";
import { newApiService } from "./NewApiService";
import { emailService } from "./EmailService";

const JWT_SECRET = process.env.JWT_SECRET || "ai-novel-dev-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const DEFAULT_USER_API_QUOTA = Number(process.env.NEW_API_DEFAULT_QUOTA || "0.03");

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  apiToken?: string | null;
  apiQuota?: number;
  accountTier?: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export class AuthService {
  private async ensureUserApiToken(user: {
    id: string;
    email: string;
    apiToken?: string | null;
    apiTokenName?: string | null;
  }): Promise<{ key: string; name: string }> {
    const token = await newApiService.createToken(user.email);
    if (user.apiToken !== token.key || user.apiTokenName !== token.name) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          apiToken: token.key,
          apiTokenName: token.name,
        },
      });
    }
    return token;
  }

  async register(input: RegisterInput): Promise<{ message: string; debugCode?: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedUsername = input.username.trim();
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername },
        ],
      },
    });

    if (existing) {
      if (existing.email === normalizedEmail) {
        throw new Error("该邮箱已被注册。");
      }
      throw new Error("该用户名已被使用。");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const result = await emailService.sendVerificationCode(
      normalizedEmail,
      normalizedUsername,
      passwordHash,
    );

    if (!result.sent) {
      throw new Error("验证码发送失败，请检查邮箱地址或稍后再试。");
    }

    return {
      message: "验证码已发送，请查收邮箱。",
      ...(result.debugCode ? { debugCode: result.debugCode } : {}),
    };
  }

  async verifyEmail(email: string, code: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const pending = emailService.verifyCode(normalizedEmail, code);
    if (!pending) {
      throw new Error("验证码错误或已过期。");
    }

    const apiTokenResult = await newApiService.createToken(normalizedEmail).catch((error) => {
      console.error("[AuthService] NEW API token creation failed:", error);
      throw new Error("账户初始化失败，请稍后重试或联系管理员。");
    });

    const user = await prisma.user.create({
      data: {
        username: pending.username,
        email: normalizedEmail,
        passwordHash: pending.passwordHash,
        role: "user",
        apiToken: apiTokenResult.key,
        apiTokenName: apiTokenResult.name,
        apiQuota: DEFAULT_USER_API_QUOTA,
        accountTier: "trial",
      },
    });

    const token = this.generateToken(user);
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        apiToken: user.apiToken,
        apiQuota: user.apiQuota,
        accountTier: user.accountTier,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    let user = await prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });

    if (!user) {
      throw new Error("邮箱或密码不正确。");
    }

    if (!user.isActive) {
      throw new Error("该账号已被禁用，请联系管理员。");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("邮箱或密码不正确。");
    }

    const ensuredToken = await this.ensureUserApiToken(user);
    user = {
      ...user,
      apiToken: ensuredToken.key,
      apiTokenName: ensuredToken.name,
    };

    const token = this.generateToken(user);
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        apiToken: user.apiToken,
        apiQuota: user.apiQuota,
        accountTier: user.accountTier,
      },
      token,
    };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    let user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) {
      return null;
    }

    const ensuredToken = await this.ensureUserApiToken(user);
    user = {
      ...user,
      apiToken: ensuredToken.key,
      apiTokenName: ensuredToken.name,
    };

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      apiToken: user.apiToken,
      apiQuota: user.apiQuota,
      accountTier: user.accountTier,
    };
  }

  async getUserQuota(userId: string): Promise<{
    apiQuota: number;
    apiToken: string | null;
    remainQuota: number;
    usedQuota: number;
    totalQuota: number;
    accountTier: string;
  }> {
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const ensuredToken = await this.ensureUserApiToken(user);
      user = {
        ...user,
        apiToken: ensuredToken.key,
        apiTokenName: ensuredToken.name,
      };
    }

    const baseQuota = user?.apiQuota ?? 0;
    let remainQuota = baseQuota;
    let usedQuota = 0;

    if (user?.email) {
      try {
        const info = await newApiService.getUserQuota(user.email);
        if (info) {
          remainQuota = info.remainQuota;
          usedQuota = info.usedQuota;
        }
      } catch {
        // Fall back to the local account balance when New API is unavailable.
      }
    }

    return {
      apiQuota: baseQuota,
      apiToken: user?.apiToken ?? null,
      remainQuota,
      usedQuota,
      totalQuota: remainQuota + usedQuota,
      accountTier: user?.accountTier ?? "trial",
    };
  }

  verifyToken(token: string): { userId: string; role: string } {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    return { userId: payload.userId, role: payload.role };
  }

  private generateToken(user: { id: string; role: string }): string {
    return jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions,
    );
  }
}

export const authService = new AuthService();
