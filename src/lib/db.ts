import "server-only";

import mysql, { type Pool } from "mysql2/promise";

declare global {
  var cadenasDbPool: Pool | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME));
}

export function getPool() {
  if (!isDatabaseConfigured()) throw new Error("La conexión MySQL todavía no está configurada.");

  if (!global.cadenasDbPool) {
    global.cadenasDbPool = process.env.DATABASE_URL
      ? mysql.createPool(process.env.DATABASE_URL)
      : mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT ?? 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          waitForConnections: true,
          connectionLimit: 8,
          decimalNumbers: true,
          timezone: "Z",
        });
  }
  return global.cadenasDbPool;
}
