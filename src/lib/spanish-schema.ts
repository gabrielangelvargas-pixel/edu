import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

type TableRename = readonly [string, string, Readonly<Record<string, string>>];

const nomenclature: readonly TableRename[] = [
  ["users", "usuarios", {
    username: "nombre_usuario",
    display_name: "nombre_visible",
    password_hash: "hash_contrasena",
    role: "rol",
    is_active: "activo",
    created_at: "fecha_creacion",
    updated_at: "fecha_actualizacion",
  }],
  ["user_sessions", "sesiones_usuario", {
    token_hash: "hash_token",
    user_id: "usuario_id",
    expires_at: "fecha_vencimiento",
    created_at: "fecha_creacion",
  }],
  ["processes", "procesos", {
    name: "nombre",
    slug: "identificador_url",
    display_order: "orden_visualizacion",
    accent: "color_acento",
    is_active: "activo",
    created_at: "fecha_creacion",
  }],
  ["chain_models", "modelos_cadena", {
    code: "codigo",
    name: "nombre",
    description: "descripcion",
    is_active: "activo",
    created_at: "fecha_creacion",
  }],
  ["model_processes", "procesos_modelo", {
    model_id: "modelo_id",
    process_id: "proceso_id",
    step_order: "orden_etapa",
    tolerance_percent: "porcentaje_tolerancia",
  }],
  ["operators", "operarios", {
    name: "nombre",
    code: "codigo",
    is_active: "activo",
    created_at: "fecha_creacion",
  }],
  ["lot_daily_sequences", "secuencias_diarias_lotes", {
    entry_date: "fecha_alta",
    last_number: "ultimo_numero",
  }],
  ["lots", "lotes", {
    code: "codigo",
    model_id: "modelo_id",
    current_process_id: "proceso_actual_id",
    assigned_operator_id: "operario_asignado_id",
    initial_weight: "gramaje_inicial",
    current_weight: "gramaje_actual",
    progress: "avance",
    status: "estado",
    priority: "prioridad",
    entered_at: "fecha_alta",
    due_at: "fecha_entrega",
    completed_at: "fecha_finalizacion",
    created_at: "fecha_creacion",
    updated_at: "fecha_actualizacion",
  }],
  ["lot_processes", "procesos_lote", {
    lot_id: "lote_id",
    process_id: "proceso_id",
    operator_id: "operario_id",
    status: "estado",
    input_weight: "gramaje_entrada",
    output_weight: "gramaje_salida",
    scrap_weight: "gramaje_recortes",
    waste_weight: "gramaje_merma",
    started_at: "fecha_inicio",
    started_time_known: "hora_inicio_registrada",
    finished_at: "fecha_fin",
    notes: "notas",
    created_at: "fecha_creacion",
  }],
  ["metal_movements", "movimientos_metal", {
    lot_process_id: "proceso_lote_id",
    movement_type: "tipo_movimiento",
    weight: "gramaje",
    notes: "notas",
    created_at: "fecha_creacion",
  }],
  ["lot_process_receipts", "recepciones_proceso_lote", {
    lot_process_id: "proceso_lote_id",
    operator_id: "operario_id",
    recorded_by: "registrado_por",
    received_at: "fecha_recepcion",
  }],
];

declare global {
  var cadenasSpanishSchema: Promise<void> | undefined;
}

// Only identifiers from the fixed mapping above are interpolated in DDL.
function identifier(name: string) {
  return `\`${name}\``;
}

async function migrateSpanishSchema() {
  const connection = await getPool().getConnection();
  try {
    const [locks] = await connection.query<(RowDataPacket & { acquired: number | null })[]>(
      "SELECT GET_LOCK(SHA2(CONCAT(DATABASE(), ':nomenclatura-cadenas'), 256), 20) AS acquired",
    );
    if (locks[0]?.acquired !== 1) throw new Error("No se pudo reservar la migración de nomenclatura.");

    try {
      const [metadata] = await connection.query<(RowDataPacket & { tableName: string; columnName: string })[]>(`
        SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
      `);
      const existing = new Map<string, Set<string>>();
      for (const { tableName, columnName } of metadata) {
        const table = existing.get(tableName) ?? new Set<string>();
        table.add(columnName);
        existing.set(tableName, table);
      }

      const tableRenames: string[] = [];
      const columnRenames: Array<{ table: string; clauses: string[] }> = [];
      for (const [previous, spanish, columns] of nomenclature) {
        const previousColumns = existing.get(previous);
        const spanishColumns = existing.get(spanish);
        if (previousColumns && spanishColumns) {
          throw new Error(`Las tablas ${previous} y ${spanish} existen simultáneamente.`);
        }
        const presentColumns = previousColumns ?? spanishColumns;
        if (!presentColumns) continue;
        if (previousColumns) tableRenames.push(`${identifier(previous)} TO ${identifier(spanish)}`);

        const clauses: string[] = [];
        for (const [oldColumn, newColumn] of Object.entries(columns)) {
          if (!presentColumns.has(oldColumn)) continue;
          if (presentColumns.has(newColumn)) {
            throw new Error(`Las columnas ${oldColumn} y ${newColumn} existen simultáneamente en ${spanish}.`);
          }
          clauses.push(`RENAME COLUMN ${identifier(oldColumn)} TO ${identifier(newColumn)}`);
        }
        if (clauses.length) columnRenames.push({ table: spanish, clauses });
      }

      if (tableRenames.length) await connection.query(`RENAME TABLE ${tableRenames.join(", ")}`);
      for (const { table, clauses } of columnRenames) {
        await connection.query(`ALTER TABLE ${identifier(table)} ${clauses.join(", ")}`);
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(), ':nomenclatura-cadenas'), 256))");
    }
  } finally {
    connection.release();
  }
}

export function ensureSpanishSchema() {
  global.cadenasSpanishSchema ??= migrateSpanishSchema().catch((error) => {
    global.cadenasSpanishSchema = undefined;
    throw error;
  });
  return global.cadenasSpanishSchema;
}
