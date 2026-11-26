import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import type { AuthRole, AuthUser, ManagedUser } from "@/types/auth";

const SESSION_COOKIE = "cadena_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_KEY_LENGTH = 64;

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: AuthRole | null;
  is_active?: number;
  created_at?: Date;
};

let schemaPromise: Promise<void> | undefined;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(row: UserRow): AuthUser {
  if (!row.role) throw new Error("El usuario activo no tiene un rol asignado.");
  return {
    id: String(row.id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

async function initializeAuthSchema() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(80) NOT NULL UNIQUE,
      display_name VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','supervisor','operator') NULL DEFAULT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    ALTER TABLE users
      MODIFY role ENUM('admin','supervisor','operator') NULL DEFAULT NULL,
      MODIFY is_active BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_sessions_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const initialUsername = process.env.INITIAL_ADMIN_USERNAME?.trim() || "Admin";
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "admin123";
  const [existing] = await pool.execute<UserRow[]>(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    [initialUsername],
  );

  if (existing.length === 0) {
    await pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO users (username, display_name, password_hash, role, is_active) VALUES (?, 'Administrador', ?, 'admin', TRUE)",
      [initialUsername, hashPassword(initialPassword)],
    );
  }
}

export function ensureAuthSchema() {
  schemaPromise ??= initializeAuthSchema().catch((error) => {
    schemaPromise = undefined;
    throw error;
  });
  return schemaPromise;
}

export async function authenticateUser(username: string, password: string) {
  await ensureAuthSchema();
  const [rows] = await getPool().execute<UserRow[]>(
    "SELECT id, username, display_name, password_hash, role, is_active FROM users WHERE username = ? LIMIT 1",
    [username],
  );
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return { status: "invalid" as const };
  if (!user.is_active || !user.role) return { status: "pending" as const };
  return { status: "active" as const, user: toAuthUser(user) };
}

export async function registerUser(input: { username: string; displayName: string; password: string }) {
  await ensureAuthSchema();
  try {
    await getPool().execute<ResultSetHeader>(
      "INSERT INTO users (username, display_name, password_hash, role, is_active) VALUES (?, ?, ?, NULL, FALSE)",
      [input.username, input.displayName, hashPassword(input.password)],
    );
    return { created: true as const };
  } catch (error) {
    if ((error as { errno?: number }).errno === 1062) return { created: false as const, reason: "duplicate" as const };
    throw error;
  }
}

export async function listUsers(): Promise<ManagedUser[]> {
  await ensureAuthSchema();
  const [rows] = await getPool().query<UserRow[]>(
    "SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY is_active ASC, created_at DESC",
  );
  return rows.map((row) => ({
    id: String(row.id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function updateManagedUser(userId: string, input: { role: AuthRole | null; isActive: boolean }) {
  await ensureAuthSchema();
  await getPool().execute(
    "UPDATE users SET role = ?, is_active = ? WHERE id = ?",
    [input.role, input.isActive, userId],
  );
  if (!input.isActive || !input.role) {
    await getPool().execute("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
  }
}

export async function createSession(userId: string) {
  await ensureAuthSchema();
  const token = randomBytes(32).toString("base64url");

  await getPool().execute("DELETE FROM user_sessions WHERE expires_at <= NOW()");
  await getPool().execute(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [hashSessionToken(token), userId],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  await ensureAuthSchema();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [rows] = await getPool().execute<UserRow[]>(`
    SELECT u.id, u.username, u.display_name, u.password_hash, u.role
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.is_active = TRUE AND u.role IS NOT NULL
    LIMIT 1
  `, [hashSessionToken(token)]);

  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await ensureAuthSchema();
    await getPool().execute("DELETE FROM user_sessions WHERE token_hash = ?", [hashSessionToken(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}
