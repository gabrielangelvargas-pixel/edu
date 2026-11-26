import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { CatalogOption } from "@/types/domain";

export const rollingSlug = "laminacion-trefilacion";

let receiptSetup: Promise<void> | undefined;

export function ensureRollingReceipts() {
  receiptSetup ??= getPool().query(`
    CREATE TABLE IF NOT EXISTS lot_process_receipts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lot_process_id BIGINT UNSIGNED NOT NULL,
      operator_id BIGINT UNSIGNED NOT NULL,
      recorded_by BIGINT UNSIGNED NOT NULL,
      received_at DATETIME NOT NULL,
      INDEX idx_process_receipts (lot_process_id, id),
      FOREIGN KEY (lot_process_id) REFERENCES lot_processes(id),
      FOREIGN KEY (operator_id) REFERENCES operators(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    ) ENGINE=InnoDB
  `).then(() => undefined).catch((error) => {
    receiptSetup = undefined;
    throw error;
  });
  return receiptSetup;
}

let setup: Promise<void> | undefined;

export function ensureRollingSetup() {
  setup ??= (async () => {
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
  id: string;
  code: string;
  model: string;
  operator: string;
  operatorId: string | null;
  recipientId: string | null;
  recipient: string | null;
  receivedAt: string | null;
  receivedOn: string | null;
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
  await ensureRollingReceipts();
  const [rows] = await getPool().execute<RollingRecord[]>(`
    SELECT CAST(lp.id AS CHAR) AS id, l.code, cm.name AS model, o.name AS operator,
      CAST(lp.operator_id AS CHAR) AS operatorId, CAST(r.operator_id AS CHAR) AS recipientId,
      recipient.name AS recipient, DATE_FORMAT(r.received_at, '%d/%m/%Y %H:%i') AS receivedAt,
      DATE_FORMAT(r.received_at, '%Y-%m-%d') AS receivedOn,
      lp.status, lp.input_weight AS inputWeight, l.current_weight AS availableWeight,
      DATE_FORMAT(l.entered_at, '%Y-%m-%d') AS lotDate, lp.output_weight AS outputWeight,
      lp.scrap_weight AS scrapWeight, DATE_FORMAT(lp.started_at, '%Y-%m-%d') AS enteredOn,
      DATE_FORMAT(lp.finished_at, '%Y-%m-%d') AS finishedOn, lp.notes
    FROM lot_processes lp
    JOIN lots l ON l.id = lp.lot_id
    JOIN chain_models cm ON cm.id = l.model_id
    JOIN processes p ON p.id = lp.process_id
    LEFT JOIN operators o ON o.id = lp.operator_id
    LEFT JOIN lot_process_receipts r ON r.id = (
      SELECT MAX(previous.id) FROM lot_process_receipts previous WHERE previous.lot_process_id = lp.id
    )
    LEFT JOIN operators recipient ON recipient.id = r.operator_id
    WHERE p.slug = ?
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
