import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool, isDatabaseConfigured } from "@/lib/db";
import { ensureUnassignedLots } from "@/lib/rolling";
import type { DashboardData, LotSummary, ProcessSummary } from "@/types/domain";

type ProcessRow = RowDataPacket & { id: number; name: string; accent: string; active_lots: number };
type OptionRow = RowDataPacket & { id: number; name: string };
type LotRow = RowDataPacket & {
  id: number; code: string; model: string; model_id: number; process: string | null; process_id: number | null;
  operator: string | null; initial_weight: number; current_weight: number; progress: number;
  status: LotSummary["status"]; priority: LotSummary["priority"]; entered_at: Date; due_at: Date | null;
};

const emptyDashboard: DashboardData = {
  source: "error",
  stats: { activeLots: 0, totalWeight: 0, completedToday: 0, averageYield: 0 },
  processes: [],
  models: [],
  operators: [],
  lots: [],
};

export async function getDashboardData({ allLots = false } = {}): Promise<DashboardData> {
  if (!isDatabaseConfigured()) {
    return {
      ...emptyDashboard,
      databaseMessage: "La conexión MySQL todavía no está configurada.",
    };
  }

  try {
    await ensureUnassignedLots();
    const pool = getPool();
    const [[processRows], [modelRows], [operatorRows], [lotRows], [metricRows]] = await Promise.all([
      pool.query<ProcessRow[]>(`
        SELECT p.id, p.nombre AS name, p.color_acento AS accent, COUNT(l.id) AS active_lots
        FROM procesos p
        LEFT JOIN lotes l ON l.proceso_actual_id = p.id AND l.estado <> 'Terminado'
          AND (p.identificador_url <> 'laminacion-trefilacion' OR l.estado <> 'Pendiente')
          AND NOT EXISTS (
            SELECT 1 FROM procesos_lote lp
            WHERE lp.lote_id = l.id AND lp.proceso_id = p.id AND lp.estado = 'Terminado'
          )
        WHERE p.activo = 1 GROUP BY p.id ORDER BY p.orden_visualizacion
      `),
      pool.query<OptionRow[]>("SELECT id, nombre AS name FROM modelos_cadena WHERE activo = 1 ORDER BY nombre"),
      pool.query<OptionRow[]>("SELECT id, nombre AS name FROM operarios WHERE activo = 1 ORDER BY nombre"),
      pool.query<LotRow[]>(`SELECT l.id, l.codigo AS code, cm.nombre AS model, cm.id AS model_id, p.nombre AS process, p.id AS process_id, o.nombre AS operator, l.gramaje_inicial AS initial_weight, l.gramaje_actual AS current_weight, l.avance AS progress, l.estado AS status, l.prioridad AS priority, l.fecha_alta AS entered_at, l.fecha_entrega AS due_at FROM lotes l JOIN modelos_cadena cm ON cm.id = l.modelo_id LEFT JOIN procesos p ON p.id = l.proceso_actual_id LEFT JOIN operarios o ON o.id = l.operario_asignado_id ORDER BY l.fecha_creacion DESC, l.id DESC${allLots ? "" : " LIMIT 20"}`),
      pool.query<RowDataPacket[]>(`SELECT SUM(estado <> 'Terminado') AS active_lots, COALESCE(SUM(CASE WHEN estado <> 'Terminado' THEN gramaje_actual ELSE 0 END), 0) AS total_weight, SUM(estado = 'Terminado' AND DATE(fecha_finalizacion) = CURRENT_DATE()) AS completed_today, COALESCE(AVG(CASE WHEN estado = 'Terminado' THEN gramaje_actual / NULLIF(gramaje_inicial, 0) * 100 END), 0) AS average_yield FROM lotes`),
    ]);
    const metrics = metricRows[0] ?? {};
    const processes: ProcessSummary[] = processRows.map((row) => ({ id: String(row.id), name: row.name, activeLots: Number(row.active_lots), accent: row.accent }));

    return {
      source: "mysql",
      stats: { activeLots: Number(metrics.active_lots ?? 0), totalWeight: Number(metrics.total_weight ?? 0), completedToday: Number(metrics.completed_today ?? 0), averageYield: Number(metrics.average_yield ?? 0) },
      processes,
      models: modelRows.map((row) => ({ id: String(row.id), name: row.name })),
      operators: operatorRows.map((row) => ({ id: String(row.id), name: row.name })),
      lots: lotRows.map((row) => ({
        id: String(row.id), code: row.code, model: row.model, modelId: String(row.model_id), process: row.process ?? "Sin proceso",
        processId: row.process_id === null ? null : String(row.process_id), operator: row.operator ?? "Sin asignar", initialWeight: Number(row.initial_weight),
        currentWeight: Number(row.current_weight), progress: Number(row.progress), status: row.status, priority: row.priority,
        enteredAt: row.entered_at.toISOString(), dueAt: row.due_at?.toISOString().slice(0, 10) ?? null,
      })),
    };
  } catch (error) {
    console.error("No se pudo consultar MySQL:", error);
    return {
      ...emptyDashboard,
      databaseMessage: "No se pudo consultar MySQL. Intentá recargar la página en unos instantes.",
    };
  }
}
