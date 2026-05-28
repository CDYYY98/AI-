import Database from "better-sqlite3";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const NEW_API_DB_PATH = process.env.NEW_API_DB_PATH || "/root/new-api/data/one-api.db";
const NEW_API_CONTAINER = process.env.NEW_API_CONTAINER || "new-api";
const NEW_API_DEFAULT_QUOTA = Number(process.env.NEW_API_DEFAULT_QUOTA || "0.03");
const NEW_API_QUOTA_PER_UNIT = Number(process.env.NEW_API_QUOTA_PER_UNIT || "500000");
const NEW_API_URL = process.env.NEW_API_URL || "http://127.0.0.1:3001";
const TOKEN_VALIDATION_TTL_MS = Number(process.env.NEW_API_TOKEN_VALIDATION_TTL_MS || "300000");

const tokenValidationCache = new Map<string, { key: string; checkedAt: number }>();

function openDb(): Database.Database {
  return new Database(NEW_API_DB_PATH);
}

const KEY_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateKey(): string {
  const bytes = crypto.randomBytes(48);
  return Array.from(bytes, (byte) => KEY_CHARS[byte % KEY_CHARS.length]).join("");
}

function toBearerKey(key: string): string {
  const trimmed = key.trim();
  return trimmed.startsWith("sk-") ? trimmed : `sk-${trimmed}`;
}

function toQuotaUnits(amount: number): number {
  return Math.max(0, Math.round(amount * NEW_API_QUOTA_PER_UNIT));
}

function fromQuotaUnits(quota: number): number {
  return quota / NEW_API_QUOTA_PER_UNIT;
}

function refreshNewApiCache(): void {
  try {
    execSync(`docker restart ${NEW_API_CONTAINER}`, { timeout: 15000, stdio: "ignore" });
  } catch { /*noop*/ }
}

function normalizeNewApiUrl(): string {
  return NEW_API_URL.trim().replace(/\/+$/u, "");
}

function buildTokenName(email: string): string {
  return `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function buildNewApiUsername(email: string): string {
  return email.trim().toLowerCase() || "ai_novel_user";
}

function randomPasswordHash(): string {
  return crypto.randomBytes(24).toString("hex");
}

function ensureNewApiUser(db: Database.Database, email: string): number {
  const normalizedEmail = email.trim().toLowerCase();
  const username = buildNewApiUsername(email);
  const existing = db.prepare(
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
  ).get(normalizedEmail) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE users SET username = ?, status = 1 WHERE id = ?",
    ).run(username, existing.id);
    return existing.id;
  }

  const byUsername = db.prepare(
    "SELECT id FROM users WHERE username = ? AND deleted_at IS NULL",
  ).get(username) as { id: number } | undefined;
  if (byUsername) {
    db.prepare(
      "UPDATE users SET email = ?, status = 1 WHERE id = ?",
    ).run(normalizedEmail, byUsername.id);
    return byUsername.id;
  }

  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(
    `INSERT INTO users (username, password, display_name, role, status, email, quota, used_quota, request_count, \`group\`, created_at)
     VALUES (?, ?, ?, 1, 1, ?, 0, 0, 0, 'default', ?)`,
  ).run(username, randomPasswordHash(), username, normalizedEmail, now);
  return Number(result.lastInsertRowid);
}

function syncNewApiUserQuotaFloor(db: Database.Database, userId: number, quotaUnits: number): void {
  const normalizedQuota = Math.max(0, Math.round(quotaUnits));
  db.prepare(
    "UPDATE users SET quota = CASE WHEN quota < ? THEN ? ELSE quota END WHERE id = ?",
  ).run(normalizedQuota, normalizedQuota, userId);
}

async function isTokenAccepted(name: string, key: string): Promise<boolean | null> {
  const cached = tokenValidationCache.get(name);
  if (cached?.key === key && Date.now() - cached.checkedAt < TOKEN_VALIDATION_TTL_MS) {
    return true;
  }
  try {
    const response = await fetch(`${normalizeNewApiUrl()}/v1/models`, {
      headers: {
        Authorization: `Bearer ${toBearerKey(key)}`,
      },
    });
    if (response.status === 401) {
      tokenValidationCache.delete(name);
      return false;
    }
    if (response.ok) {
      tokenValidationCache.set(name, { key, checkedAt: Date.now() });
      return true;
    }
    return null;
  } catch {
    return null;
  }
}


export class NewApiService {
  async createToken(email: string): Promise<{ key: string; name: string }> {
    const name = buildTokenName(email);
    const db = openDb();
    try {
      const newApiUserId = ensureNewApiUser(db, email);
      const existing = db.prepare(
        "SELECT id, user_id, `key`, remain_quota FROM tokens WHERE name = ? AND deleted_at IS NULL",
      ).get(name) as { id: number; user_id: number; key: string; remain_quota: number } | undefined;
      if (existing) {
        if (existing.user_id !== newApiUserId) {
          db.prepare("UPDATE tokens SET user_id = ? WHERE id = ?").run(newApiUserId, existing.id);
          refreshNewApiCache();
        }
        syncNewApiUserQuotaFloor(db, newApiUserId, existing.remain_quota);
        const accepted = await isTokenAccepted(name, existing.key);
        if (accepted === true) {
          return { key: toBearerKey(existing.key), name };
        }
        const key = generateKey();
        const now = Math.floor(Date.now() / 1000);
        db.prepare(
          "UPDATE tokens SET `key` = ?, status = 1, accessed_time = ? WHERE id = ?",
        ).run(key, now, existing.id);
        refreshNewApiCache();
        tokenValidationCache.set(name, { key, checkedAt: Date.now() });
        return { key: toBearerKey(key), name };
      }

      const key = generateKey();
      const now = Math.floor(Date.now() / 1000);
      const expiredTime = now + 365 * 24 * 3600;

      db.prepare(
        `INSERT INTO tokens (user_id, name, \`key\`, status, remain_quota, unlimited_quota, expired_time, created_time, accessed_time)
         VALUES (?, ?, ?, 1, ?, 0, ?, ?, ?)`,
      ).run(newApiUserId, name, key, toQuotaUnits(NEW_API_DEFAULT_QUOTA), expiredTime, now, now);
      syncNewApiUserQuotaFloor(db, newApiUserId, toQuotaUnits(NEW_API_DEFAULT_QUOTA));

      refreshNewApiCache();
      tokenValidationCache.set(name, { key, checkedAt: Date.now() });
      return { key: toBearerKey(key), name };
    } finally {
      db.close();
    }
  }

  async getUserQuota(email: string): Promise<{ remainQuota: number; usedQuota: number } | null> {
    const name = buildTokenName(email);
    const db = openDb();
    try {
      const row = db.prepare(
        `SELECT tokens.remain_quota, tokens.used_quota, users.quota AS user_quota, users.used_quota AS user_used_quota
         FROM tokens
         LEFT JOIN users ON users.id = tokens.user_id
         WHERE tokens.name = ? AND tokens.deleted_at IS NULL`,
      ).get(name) as {
        remain_quota: number;
        used_quota: number;
        user_quota: number | null;
        user_used_quota: number | null;
      } | undefined;
      if (!row) return null;
      const effectiveRemainQuota = Math.min(
        row.remain_quota,
        typeof row.user_quota === "number" ? row.user_quota : row.remain_quota,
      );
      return {
        remainQuota: fromQuotaUnits(effectiveRemainQuota),
        usedQuota: fromQuotaUnits(Math.max(row.used_quota, row.user_used_quota ?? 0)),
      };
    } finally {
      db.close();
    }
  }

  async updateQuota(email: string, amount: number): Promise<void> {
    const name = buildTokenName(email);
    const db = openDb();
    try {
      const amountUnits = toQuotaUnits(Math.abs(amount));
      const token = db.prepare(
        "SELECT user_id FROM tokens WHERE name = ? AND deleted_at IS NULL",
      ).get(name) as { user_id: number } | undefined;
      if (amount < 0) {
        db.prepare(
          "UPDATE tokens SET remain_quota = remain_quota + ?, used_quota = used_quota + ? WHERE name = ? AND deleted_at IS NULL",
        ).run(-amountUnits, amountUnits, name);
        if (token) {
          db.prepare(
            "UPDATE users SET quota = quota + ?, used_quota = used_quota + ? WHERE id = ?",
          ).run(-amountUnits, amountUnits, token.user_id);
        }
      } else {
        db.prepare(
          "UPDATE tokens SET remain_quota = remain_quota + ? WHERE name = ? AND deleted_at IS NULL",
        ).run(amountUnits, name);
        if (token) {
          db.prepare("UPDATE users SET quota = quota + ? WHERE id = ?").run(amountUnits, token.user_id);
        }
      }
      refreshNewApiCache();
    } finally {
      db.close();
    }
  }

  async repairLegacyQuotaScale(email: string, accountQuota: number): Promise<void> {
    if (!Number.isFinite(accountQuota) || accountQuota <= 0) return;

    const name = buildTokenName(email);
    const targetTotalUnits = toQuotaUnits(accountQuota);
    const db = openDb();
    try {
      const row = db.prepare(
        "SELECT user_id, remain_quota, used_quota FROM tokens WHERE name = ? AND deleted_at IS NULL",
      ).get(name) as { user_id: number; remain_quota: number; used_quota: number } | undefined;
      if (!row) return;

      const currentTotalUnits = row.remain_quota + row.used_quota;
      const legacyScaleCeiling = Math.max(10000, Math.round(targetTotalUnits * 0.01));
      if (currentTotalUnits > legacyScaleCeiling || currentTotalUnits >= targetTotalUnits) {
        return;
      }

      const repairedRemainUnits = Math.max(0, targetTotalUnits - row.used_quota);
      db.prepare(
        "UPDATE tokens SET remain_quota = ? WHERE name = ? AND deleted_at IS NULL",
      ).run(repairedRemainUnits, name);
      syncNewApiUserQuotaFloor(db, row.user_id, repairedRemainUnits);
      refreshNewApiCache();
    } finally {
      db.close();
    }
  }

  async logUsage(params: {
    email: string;
    modelName?: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    const name = buildTokenName(params.email);
    const db = openDb();
    try {
      const newApiUserId = ensureNewApiUser(db, params.email);
      const token = db.prepare(
        "SELECT id, user_id FROM tokens WHERE name = ? AND deleted_at IS NULL",
      ).get(name) as { id: number; user_id: number } | undefined;
      if (!token) return;
      if (token.user_id !== newApiUserId) {
        db.prepare("UPDATE tokens SET user_id = ? WHERE id = ?").run(newApiUserId, token.id);
      }

      const now = Math.floor(Date.now() / 1000);
      const totalTokens = params.promptTokens + params.completionTokens;
      const quotaUnits = -toQuotaUnits((totalTokens / 1000) * 0.002);
      db.prepare(
        `INSERT INTO logs (user_id, token_id, token_name, model_name, type, content, quota, prompt_tokens, completion_tokens, created_at, username, is_stream, channel_id, channel_name, \`group\`, ip)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, 0, '', '', '')`,
      ).run(
        newApiUserId,
        token.id,
        name,
        params.modelName || "unknown",
        `消耗 ${totalTokens} tokens`,
        quotaUnits,
        params.promptTokens,
        params.completionTokens,
        now,
        params.email,
      );
    } finally {
      db.close();
    }
  }
}

export const newApiService = new NewApiService();
