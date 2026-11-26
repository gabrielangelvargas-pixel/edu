import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { CatalogOption } from "@/types/domain";

export const rollingSlug = "laminacion-trefilacion";

let entryTimeSetup: Promise<void> | undefined;

export function ensureRollingEntryTime() {
  entryTimeSetup ??= (async () => {
    const pool = getPool();
    const [columns] = await pool.query<RowDataPacket[]>(`
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_processes'
        AND COLUMN_NAME = 'started_time_known'
    `);
    if (columns.length) return;
    try {
      await pool.query("ALTER TABLE lot_processes ADD COLUMN started_time_known BOOLEAN NOT NULL DEFAULT FALSE");
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_FIELDNAME") throw error;
    }
  })().catch((error) => {
    entryTimeSetup = undefined;
    throw error;
  });
  return entryTimeSetup;
}

let setup: Promise<void> | undefined;
let unassignedSetup: Promise<void> | undefined;

export function ensureUnassignedLots() {
  unassignedSetup ??= (async () => {
    const pool = getPool();
    const [columns] = await pool.query<(RowDataPacket & { nullable: string })[]>(`
      SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lots' AND COLUMN_NAME = 'current_process_id'
    `);
    if (columns[0]?.nullable === "NO") {
      await pool.query("ALTER TABLE lots MODIFY COLUMN current_process_id BIGINT UNSIGNED NULL DEFAULT NULL");
    }
    // Clear the old automatic assignment only when the lot has no process activity.
    await pool.execute(`
      UPDATE lots l
      JOIN processes p ON p.id = l.current_process_id AND p.slug = ?
      SET l.current_process_id = NULL
      WHERE l.status = 'Pendiente' AND l.progress = 0 AND l.assigned_operator_id IS NULL
        AND EXISTS (
          SELECT 1 FROM lot_processes lp
          WHERE lp.lot_id = l.id AND lp.process_id = p.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM lot_processes lp WHERE lp.lot_id = l.id
            AND (lp.process_id <> p.id OR lp.status <> 'Pendiente' OR lp.started_at IS NOT NULL
              OR lp.finished_at IS NOT NULL OR lp.operator_id IS NOT NULL OR lp.input_weight IS NOT NULL
              OR lp.output_weight IS NOT NULL OR lp.scrap_weight <> 0 OR lp.waste_weight <> 0
              OR lp.notes IS NOT NULL
              OR EXISTS (SELECT 1 FROM metal_movements m WHERE m.lot_process_id = lp.id))
        )
    `, [rollingSlug]);
  })().catch((error) => {
    unassignedSetup = undefined;
    throw error;
  });
  return unassignedSetup;
}

export function ensureRollingSetup() {
  setup ??= (async () => {
    await ensureUnassignedLots();
    const pool = getPool();
    const [columns] = await pool.query<(RowDataPacket & { nullable: string })[]>(`
      SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lots' AND COLUMN_NAME = 'due_at'
    `);
    if (columns[0]?.nullable === "NO") {
      await pool.query("ALTER TABLE lots MODIFY COLUMN due_at DATE NULL DEFAULT NULL");
    }
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
  id: string | null;
  lotId: string;
  code: string;
  model: string;
  operator: string;
  operatorId: string | null;
  enteredTime: string | null;
  status: string;
  inputWeight: number | string | null;
  availableWeight: number | string;
  outputWeight: number | string | null;
  scrapWeight: number | string;
  enteredOn: string | null;
  lotDate: string;
  finishedOn: string | null;
  notes: string | null;
};

export async function getRollingRecords() {
  await Promise.all([ensureRollingEntryTime(), ensureUnassignedLots()]);
  const [rows] = await getPool().execute<RollingRecord[]>(`
    SELECT CAST(lp.id AS CHAR) AS id, CAST(l.id AS CHAR) AS lotId, l.code, cm.name AS model, o.name AS operator,
      CAST(lp.operator_id AS CHAR) AS operatorId,
      CASE WHEN lp.started_time_known THEN DATE_FORMAT(lp.started_at, '%H:%i') END AS enteredTime,
      COALESCE(lp.status, l.status) AS status, lp.input_weight AS inputWeight, l.current_weight AS availableWeight,
      DATE_FORMAT(l.entered_at, '%Y-%m-%d') AS lotDate, lp.output_weight AS outputWeight,
      lp.scrap_weight AS scrapWeight, DATE_FORMAT(lp.started_at, '%Y-%m-%d') AS enteredOn,
      DATE_FORMAT(lp.finished_at, '%Y-%m-%d') AS finishedOn, lp.notes
    FROM lots l
    JOIN chain_models cm ON cm.id = l.model_id
    LEFT JOIN lot_processes lp ON lp.lot_id = l.id AND lp.started_at IS NOT NULL
      AND lp.process_id = (SELECT id FROM processes WHERE slug = ?)
    LEFT JOIN operators o ON o.id = lp.operator_id
    WHERE lp.id IS NOT NULL OR (l.current_process_id IS NULL AND l.status = 'Pendiente')
    ORDER BY (lp.finished_at IS NULL) DESC, COALESCE(lp.started_at, l.entered_at) DESC, lp.id DESC
  `, [rollingSlug]);
  return rows;
}

export async function getRollingOperators(): Promise<CatalogOption[]> {
  const [rows] = await getPool().query<(RowDataPacket & CatalogOption)[]>(`
    SELECT CAST(id AS CHAR) AS id, name FROM operators WHERE is_active = TRUE ORDER BY name
  `);
  return rows.map(({ id, name }) => ({ id, name }));
}
