import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "ai-novel-dev-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

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
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          { username: input.username },
        ],
      },
    });

    if (existing) {
      if (existing.email === input.email) {
        throw new Error("该邮箱已被注册。");
      }
      throw new Error("该用户名已被使用。");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        role: "user",
      },
    });

    const token = this.generateToken(user);
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
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

    const token = this.generateToken(user);
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
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
