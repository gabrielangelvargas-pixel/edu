import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export const rollingSlug = "laminacion-trefilacion";

let setup: Promise<void> | undefined;

export function ensureRollingSetup() {
  setup ??= (async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lot_daily_sequences (
        entry_date DATE PRIMARY KEY,
        last_number TINYINT UNSIGNED NOT NULL DEFAULT 0
      ) ENGINE=InnoDB
    `);
    await pool.execute(`
      INSERT INTO processes (name, slug, display_order, accent)
      VALUES ('Laminación y trefilación', ?, 0, '#3f8067')
      ON DUPLICATE KEY UPDATE slug = slug
    `, [rollingSlug]);
  })().catch((error) => {
    setup = undefined;
    throw error;
  });
  return setup;
}

type RollingRecord = RowDataPacket & {
  id: string;
  code: string;
  model: string;
  operator: string;
  status: string;
  inputWeight: number | string;
  outputWeight: number | string | null;
  scrapWeight: number | string;
  enteredOn: string;
  finishedOn: string | null;
  notes: string | null;
};

export async function getRollingRecords() {
  const [rows] = await getPool().execute<RollingRecord[]>(`
    SELECT CAST(lp.id AS CHAR) AS id, l.code, cm.name AS model, o.name AS operator,
      lp.status, lp.input_weight AS inputWeight, lp.output_weight AS outputWeight,
      lp.scrap_weight AS scrapWeight, DATE_FORMAT(lp.started_at, '%Y-%m-%d') AS enteredOn,
      DATE_FORMAT(lp.finished_at, '%Y-%m-%d') AS finishedOn, lp.notes
    FROM lot_processes lp
    JOIN lots l ON l.id = lp.lot_id
    JOIN chain_models cm ON cm.id = l.model_id
    JOIN processes p ON p.id = lp.process_id
    LEFT JOIN operators o ON o.id = lp.operator_id
    WHERE p.slug = ?
    ORDER BY (lp.finished_at IS NULL) DESC, lp.started_at DESC, lp.id DESC
  `, [rollingSlug]);
  return rows;
}
