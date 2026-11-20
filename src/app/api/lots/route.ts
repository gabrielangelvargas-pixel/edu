import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool, isDatabaseConfigured } from "@/lib/db";

const createLotSchema = z.object({
  code: z.string().trim().min(3).max(30),
  modelId: z.coerce.number().int().positive(),
  operatorId: z.coerce.number().int().positive().optional(),
  initialWeight: z.coerce.number().positive().max(999999),
  priority: z.enum(["Normal", "Alta", "Urgente"]),
  dueAt: z.iso.date(),
});

export async function POST(request: Request) {
  if (!await getCurrentUser()) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = createLotSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Revisá los datos del lote." }, { status: 400 });
  const input = parsed.data;

  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "La conexión MySQL no está configurada." },
      { status: 503 },
    );
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [processRows] = await connection.query<(RowDataPacket & { id: number })[]>(
      "SELECT process_id AS id FROM model_processes WHERE model_id = ? ORDER BY step_order LIMIT 1",
      [input.modelId],
    );
    const firstProcessId = processRows[0]?.id;
    if (!firstProcessId) {
      await connection.rollback();
      return Response.json({ error: "El modelo seleccionado todavía no tiene una ruta de procesos." }, { status: 409 });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO lots (code, model_id, current_process_id, assigned_operator_id, initial_weight, current_weight, progress, status, priority, entered_at, due_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'Pendiente', ?, NOW(), ?)",
      [input.code, input.modelId, firstProcessId, input.operatorId ?? null, input.initialWeight, input.initialWeight, input.priority, input.dueAt],
    );
    await connection.execute(
      "INSERT INTO lot_processes (lot_id, process_id, operator_id, status, input_weight) VALUES (?, ?, ?, 'Pendiente', ?)",
      [result.insertId, firstProcessId, input.operatorId ?? null, input.initialWeight],
    );
    await connection.commit();
    return Response.json({ id: result.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("No se pudo crear el lote:", error);
    return Response.json({ error: "No se pudo guardar el lote. Verificá que el código no esté repetido." }, { status: 500 });
  } finally {
    connection.release();
  }
}
