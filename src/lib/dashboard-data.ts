import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool, isDatabaseConfigured } from "@/lib/db";
import type { DashboardData, LotSummary, ProcessSummary } from "@/types/domain";

type ProcessRow = RowDataPacket & { id: number; name: string; accent: string; active_lots: number };
type LotRow = RowDataPacket & {
  id: number; code: string; process: string | null; process_id: number | null;
  operator: string | null; initial_weight: number; current_weight: number; progress: number;
  status: LotSummary["status"]; priority: LotSummary["priority"]; entered_at: Date;
};

const emptyDashboard: DashboardData = {
  source: "error",
  stats: { activeLots: 0, totalWeight: 0, completedLots: 0, averageYield: 0 },
  processes: [],
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
    const pool = getPool();
    const [[processRows], [lotRows], [metricRows]] = await Promise.all([
      pool.query<ProcessRow[]>(`
        SELECT p.id, p.nombre AS name, p.color_acento AS accent, COUNT(DISTINCT l.id) AS active_lots
        FROM procesos p
        LEFT JOIN procesos_lote lp ON lp.proceso_id = p.id AND lp.estado IN ('En proceso', 'Observado')
          AND lp.fecha_inicio IS NOT NULL AND lp.fecha_fin IS NULL
        LEFT JOIN lotes l ON l.id = lp.lote_id AND l.estado <> 'Terminado'
        WHERE p.activo = 1 GROUP BY p.id ORDER BY p.orden_visualizacion
      `),
      pool.query<LotRow[]>(`
        SELECT l.id, l.codigo AS code, p.nombre AS process, p.id AS process_id, o.nombre AS operator,
          l.gramaje_inicial AS initial_weight, l.gramaje_actual AS current_weight, l.avance AS progress,
          l.estado AS status, l.prioridad AS priority, l.fecha_alta AS entered_at
        FROM lotes l
        LEFT JOIN procesos_lote lp ON lp.id = (
          SELECT actual.id FROM procesos_lote actual
          WHERE actual.lote_id = l.id AND actual.estado IN ('En proceso', 'Observado')
            AND actual.fecha_inicio IS NOT NULL AND actual.fecha_fin IS NULL
          ORDER BY actual.fecha_inicio DESC, actual.id DESC LIMIT 1
        ) AND l.estado <> 'Terminado'
        LEFT JOIN procesos p ON p.id = lp.proceso_id
        LEFT JOIN operarios o ON o.id = lp.operario_id
        ORDER BY l.id DESC${allLots ? "" : " LIMIT 20"}
      `),
      pool.query<RowDataPacket[]>(`
        SELECT SUM(estado <> 'Terminado') AS active_lots,
          COALESCE(SUM(CASE WHEN estado <> 'Terminado' THEN gramaje_actual ELSE 0 END), 0) AS total_weight,
          SUM(estado = 'Terminado') AS completed_lots,
          COALESCE(AVG(CASE WHEN estado = 'Terminado' THEN gramaje_actual / NULLIF(gramaje_inicial, 0) * 100 END), 0) AS average_yield
        FROM lotes
      `),
    ]);
    const metrics = metricRows[0] ?? {};
    const processes: ProcessSummary[] = processRows.map((row) => ({ id: String(row.id), name: row.name, activeLots: Number(row.active_lots), accent: row.accent }));

    return {
      source: "mysql",
      stats: { activeLots: Number(metrics.active_lots ?? 0), totalWeight: Number(metrics.total_weight ?? 0), completedLots: Number(metrics.completed_lots ?? 0), averageYield: Number(metrics.average_yield ?? 0) },
      processes,
      lots: lotRows.map((row) => ({
        id: String(row.id), code: row.code, process: row.process ?? "Sin proceso",
        processId: row.process_id === null ? null : String(row.process_id), operator: row.operator ?? "Sin asignar", initialWeight: Number(row.initial_weight),
        currentWeight: Number(row.current_weight), progress: Number(row.progress), status: row.status, priority: row.priority,
        enteredAt: row.entered_at.toISOString(),
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
