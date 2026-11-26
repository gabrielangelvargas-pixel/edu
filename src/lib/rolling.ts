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
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'procesos_lote'
        AND COLUMN_NAME = 'hora_inicio_registrada'
    `);
    if (columns.length) return;
    try {
      await pool.query("ALTER TABLE procesos_lote ADD COLUMN hora_inicio_registrada BOOLEAN NOT NULL DEFAULT FALSE");
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
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lotes' AND COLUMN_NAME = 'proceso_actual_id'
    `);
    if (columns[0]?.nullable === "NO") {
      await pool.query("ALTER TABLE lotes MODIFY COLUMN proceso_actual_id BIGINT UNSIGNED NULL DEFAULT NULL");
    }
    // Clear the old automatic assignment only when the lot has no process activity.
    await pool.execute(`
      UPDATE lotes l
      JOIN procesos p ON p.id = l.proceso_actual_id AND p.identificador_url = ?
      SET l.proceso_actual_id = NULL
      WHERE l.estado = 'Pendiente' AND l.avance = 0 AND l.operario_asignado_id IS NULL
        AND EXISTS (
          SELECT 1 FROM procesos_lote lp
          WHERE lp.lote_id = l.id AND lp.proceso_id = p.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM procesos_lote lp WHERE lp.lote_id = l.id
            AND (lp.proceso_id <> p.id OR lp.estado <> 'Pendiente' OR lp.fecha_inicio IS NOT NULL
              OR lp.fecha_fin IS NOT NULL OR lp.operario_id IS NOT NULL OR lp.gramaje_entrada IS NOT NULL
              OR lp.gramaje_salida IS NOT NULL OR lp.gramaje_recortes <> 0 OR lp.gramaje_merma <> 0
              OR lp.notas IS NOT NULL
              OR EXISTS (SELECT 1 FROM movimientos_metal m WHERE m.proceso_lote_id = lp.id))
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
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lotes' AND COLUMN_NAME = 'fecha_entrega'
    `);
    if (columns[0]?.nullable === "NO") {
      await pool.query("ALTER TABLE lotes MODIFY COLUMN fecha_entrega DATE NULL DEFAULT NULL");
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS secuencias_diarias_lotes (
        fecha_alta DATE PRIMARY KEY,
        ultimo_numero TINYINT UNSIGNED NOT NULL DEFAULT 0
      ) ENGINE=InnoDB
    `);
    await pool.execute(`
      INSERT INTO procesos (nombre, identificador_url, orden_visualizacion, color_acento)
      VALUES ('Laminación y trefilación', ?, 0, '#3f8067')
      ON DUPLICATE KEY UPDATE identificador_url = identificador_url
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
    SELECT CAST(lp.id AS CHAR) AS id, CAST(l.id AS CHAR) AS lotId, l.codigo AS code, cm.nombre AS model, o.nombre AS operator,
      CAST(lp.operario_id AS CHAR) AS operatorId,
      CASE WHEN lp.hora_inicio_registrada THEN DATE_FORMAT(lp.fecha_inicio, '%H:%i') END AS enteredTime,
      COALESCE(lp.estado, l.estado) AS status, lp.gramaje_entrada AS inputWeight, l.gramaje_actual AS availableWeight,
      DATE_FORMAT(l.fecha_alta, '%Y-%m-%d') AS lotDate, lp.gramaje_salida AS outputWeight,
      lp.gramaje_recortes AS scrapWeight, DATE_FORMAT(lp.fecha_inicio, '%Y-%m-%d') AS enteredOn,
      DATE_FORMAT(lp.fecha_fin, '%Y-%m-%d') AS finishedOn, lp.notas AS notes
    FROM lotes l
    JOIN modelos_cadena cm ON cm.id = l.modelo_id
    LEFT JOIN procesos_lote lp ON lp.lote_id = l.id AND lp.fecha_inicio IS NOT NULL
      AND lp.proceso_id = (SELECT id FROM procesos WHERE identificador_url = ?)
    LEFT JOIN operarios o ON o.id = lp.operario_id
    WHERE lp.id IS NOT NULL OR (l.proceso_actual_id IS NULL AND l.estado = 'Pendiente')
    ORDER BY (lp.fecha_fin IS NULL) DESC, COALESCE(lp.fecha_inicio, l.fecha_alta) DESC, lp.id DESC
  `, [rollingSlug]);
  return rows;
}

export async function getRollingOperators(): Promise<CatalogOption[]> {
  const [rows] = await getPool().query<(RowDataPacket & CatalogOption)[]>(`
    SELECT CAST(id AS CHAR) AS id, nombre AS name FROM operarios WHERE activo = TRUE ORDER BY nombre
  `);
  return rows.map(({ id, name }) => ({ id, name }));
}
