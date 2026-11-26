import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { ensureSpanishSchema } from "@/lib/spanish-schema";
import type { AuthRole, AuthUser, ManagedUser } from "@/types/auth";

const SESSION_COOKIE = "cadena_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_KEY_LENGTH = 64;

type UserRow = RowDataPacket & {
  id: number;
  nombre_usuario: string;
  nombre_visible: string;
  hash_contrasena: string;
  rol: AuthRole | null;
  activo?: number;
  fecha_creacion?: Date;
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
  if (!row.rol) throw new Error("El usuario activo no tiene un rol asignado.");
  return {
    id: String(row.id),
    username: row.nombre_usuario,
    displayName: row.nombre_visible,
    role: row.rol,
  };
}

async function initializeAuthSchema() {
  await ensureSpanishSchema();
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nombre_usuario VARCHAR(80) NOT NULL UNIQUE,
      nombre_visible VARCHAR(120) NOT NULL,
      hash_contrasena VARCHAR(255) NOT NULL,
      rol ENUM('admin','supervisor','operator') NULL DEFAULT NULL,
      activo BOOLEAN NOT NULL DEFAULT FALSE,
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    ALTER TABLE usuarios
      MODIFY rol ENUM('admin','supervisor','operator') NULL DEFAULT NULL,
      MODIFY activo BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones_usuario (
      hash_token CHAR(64) PRIMARY KEY,
      usuario_id BIGINT UNSIGNED NOT NULL,
      fecha_vencimiento DATETIME NOT NULL,
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      INDEX idx_sesiones_vencimiento (fecha_vencimiento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const initialUsername = process.env.INITIAL_ADMIN_USERNAME?.trim() || "Admin";
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "admin123";
  const [existing] = await pool.execute<UserRow[]>(
    "SELECT id FROM usuarios WHERE nombre_usuario = ? LIMIT 1",
    [initialUsername],
  );

  if (existing.length === 0) {
    await pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO usuarios (nombre_usuario, nombre_visible, hash_contrasena, rol, activo) VALUES (?, 'Administrador', ?, 'admin', TRUE)",
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
    "SELECT id, nombre_usuario, nombre_visible, hash_contrasena, rol, activo FROM usuarios WHERE nombre_usuario = ? LIMIT 1",
    [username],
  );
  const user = rows[0];
  if (!user || !verifyPassword(password, user.hash_contrasena)) return { status: "invalid" as const };
  if (!user.activo || !user.rol) return { status: "pending" as const };
  return { status: "active" as const, user: toAuthUser(user) };
}

export async function registerUser(input: { username: string; displayName: string; password: string }) {
  await ensureAuthSchema();
  try {
    await getPool().execute<ResultSetHeader>(
      "INSERT INTO usuarios (nombre_usuario, nombre_visible, hash_contrasena, rol, activo) VALUES (?, ?, ?, NULL, FALSE)",
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
    "SELECT id, nombre_usuario, nombre_visible, rol, activo, fecha_creacion FROM usuarios ORDER BY activo ASC, fecha_creacion DESC",
  );
  return rows.map((row) => ({
    id: String(row.id),
    username: row.nombre_usuario,
    displayName: row.nombre_visible,
    role: row.rol,
    isActive: Boolean(row.activo),
    createdAt: row.fecha_creacion?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function updateManagedUser(userId: string, input: { role: AuthRole | null; isActive: boolean }) {
  await ensureAuthSchema();
  await getPool().execute(
    "UPDATE usuarios SET rol = ?, activo = ? WHERE id = ?",
    [input.role, input.isActive, userId],
  );
  if (!input.isActive || !input.role) {
    await getPool().execute("DELETE FROM sesiones_usuario WHERE usuario_id = ?", [userId]);
  }
}

export async function createSession(userId: string) {
  await ensureAuthSchema();
  const token = randomBytes(32).toString("base64url");

  await getPool().execute("DELETE FROM sesiones_usuario WHERE fecha_vencimiento <= NOW()");
  await getPool().execute(
    "INSERT INTO sesiones_usuario (hash_token, usuario_id, fecha_vencimiento) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
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
    SELECT u.id, u.nombre_usuario, u.nombre_visible, u.hash_contrasena, u.rol
    FROM sesiones_usuario s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.hash_token = ? AND s.fecha_vencimiento > NOW() AND u.activo = TRUE AND u.rol IS NOT NULL
    LIMIT 1
  `, [hashSessionToken(token)]);

  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await ensureAuthSchema();
    await getPool().execute("DELETE FROM sesiones_usuario WHERE hash_token = ?", [hashSessionToken(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}
