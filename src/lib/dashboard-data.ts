import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool, isDatabaseConfigured } from "@/lib/db";
import { demoDashboard } from "@/lib/demo-data";
import type { DashboardData, LotSummary, ProcessSummary } from "@/types/domain";

type ProcessRow = RowDataPacket & { id: number; name: string; accent: string; active_lots: number };
type OptionRow = RowDataPacket & { id: number; name: string };
type LotRow = RowDataPacket & {
  id: number; code: string; model: string; model_id: number; process: string; process_id: number;
  operator: string | null; initial_weight: number; current_weight: number; progress: number;
  status: LotSummary["status"]; priority: LotSummary["priority"]; entered_at: Date; due_at: Date;
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!isDatabaseConfigured()) return demoDashboard;

  try {
    const pool = getPool();
    const [[processRows], [modelRows], [operatorRows], [lotRows], [metricRows]] = await Promise.all([
      pool.query<ProcessRow[]>(`SELECT p.id, p.name, p.accent, COUNT(l.id) AS active_lots FROM processes p LEFT JOIN lots l ON l.current_process_id = p.id AND l.status <> 'Terminado' WHERE p.is_active = 1 GROUP BY p.id ORDER BY p.display_order`),
      pool.query<OptionRow[]>("SELECT id, name FROM chain_models WHERE is_active = 1 ORDER BY name"),
      pool.query<OptionRow[]>("SELECT id, name FROM operators WHERE is_active = 1 ORDER BY name"),
      pool.query<LotRow[]>(`SELECT l.id, l.code, cm.name AS model, cm.id AS model_id, p.name AS process, p.id AS process_id, o.name AS operator, l.initial_weight, l.current_weight, l.progress, l.status, l.priority, l.entered_at, l.due_at FROM lots l JOIN chain_models cm ON cm.id = l.model_id JOIN processes p ON p.id = l.current_process_id LEFT JOIN operators o ON o.id = l.assigned_operator_id ORDER BY l.created_at DESC LIMIT 20`),
      pool.query<RowDataPacket[]>(`SELECT SUM(status <> 'Terminado') AS active_lots, COALESCE(SUM(CASE WHEN status <> 'Terminado' THEN current_weight ELSE 0 END), 0) AS total_weight, SUM(status = 'Terminado' AND DATE(completed_at) = CURRENT_DATE()) AS completed_today, COALESCE(AVG(CASE WHEN status = 'Terminado' THEN current_weight / NULLIF(initial_weight, 0) * 100 END), 0) AS average_yield FROM lots`),
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
        id: String(row.id), code: row.code, model: row.model, modelId: String(row.model_id), process: row.process,
        processId: String(row.process_id), operator: row.operator ?? "Sin asignar", initialWeight: Number(row.initial_weight),
        currentWeight: Number(row.current_weight), progress: Number(row.progress), status: row.status, priority: row.priority,
        enteredAt: row.entered_at.toISOString(), dueAt: row.due_at.toISOString().slice(0, 10),
      })),
    };
  } catch (error) {
    console.error("No se pudo consultar MySQL:", error);
    return { ...demoDashboard, databaseMessage: "MySQL está configurado, pero todavía no responde. La app continúa en modo demostración." };
  }
}
