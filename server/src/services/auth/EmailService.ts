const SMTP_HOST = process.env.SMTP_HOST || "smtp.qq.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_SECURE = process.env.SMTP_SECURE?.trim().toLowerCase() !== "false";
const EMAIL_DEBUG_CODE = process.env.EMAIL_DEBUG_CODE?.trim().toLowerCase() === "true";

interface PendingVerificationCode {
  code: string;
  username: string;
  passwordHash: string;
  expiresAt: number;
}

export interface VerificationCodeSendResult {
  sent: boolean;
  debugCode?: string;
}

const pendingCodes = new Map<string, PendingVerificationCode>();

let transporter: any = null;

try {
  const nodemailer = require("nodemailer");
  if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
} catch (error) {
  console.warn("[EmailService] nodemailer is not available:", error);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of pendingCodes) {
    if (now > item.expiresAt) {
      pendingCodes.delete(key);
    }
  }
}, 5 * 60 * 1000);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class EmailService {
  async sendVerificationCode(
    email: string,
    username: string,
    passwordHash: string,
  ): Promise<VerificationCodeSendResult> {
    const normalizedEmail = normalizeEmail(email);
    const code = createVerificationCode();

    pendingCodes.set(normalizedEmail, {
      code,
      username,
      passwordHash,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    if (EMAIL_DEBUG_CODE) {
      console.warn("[EmailService] EMAIL_DEBUG_CODE is enabled; verification email was not sent.");
      return {
        sent: true,
        debugCode: code,
      };
    }

    if (!transporter) {
      console.warn("[EmailService] SMTP is not configured; verification email was not sent.");
      pendingCodes.delete(normalizedEmail);
      return {
        sent: false,
      };
    }

    try {
      await transporter.sendMail({
        from: `图灵网文工作台 <${SMTP_USER}>`,
        to: normalizedEmail,
        subject: "验证码 - 图灵网文工作台",
        text: `你的验证码是：${code}，10 分钟内有效。`,
        html: `
          <div style="padding:20px;background:#f5f5f5;font-family:Arial,'Microsoft YaHei',sans-serif">
            <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:24px">
              <h2 style="margin:0 0 16px;color:#111827">图灵网文工作台</h2>
              <p style="margin:0 0 12px;color:#374151">你的注册验证码是：</p>
              <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#f97316;margin:0 0 16px">${code}</p>
              <p style="margin:0;color:#6b7280">验证码 10 分钟内有效。如非本人操作，请忽略本邮件。</p>
            </div>
          </div>
        `,
      });

      return {
        sent: true,
      };
    } catch (error) {
      pendingCodes.delete(normalizedEmail);
      console.error("[EmailService] failed to send verification email:", error);
      return { sent: false };
    }
  }

  verifyCode(email: string, code: string): { username: string; passwordHash: string } | null {
    const normalizedEmail = normalizeEmail(email);
    const pending = pendingCodes.get(normalizedEmail);
    if (!pending) {
      return null;
    }

    if (Date.now() > pending.expiresAt) {
      pendingCodes.delete(normalizedEmail);
      return null;
    }

    if (pending.code !== code.trim()) {
      return null;
    }

    pendingCodes.delete(normalizedEmail);
    return { username: pending.username, passwordHash: pending.passwordHash };
  }
}

export const emailService = new EmailService();
