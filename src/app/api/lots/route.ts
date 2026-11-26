import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { ensureRollingSetup, rollingSlug } from "@/lib/rolling";
import { toMilligrams } from "@/lib/weights";
import { getWorkshopDate } from "@/lib/workshop-date";

const createLotSchema = z.object({
  modelId: z.string().regex(/^[1-9]\d{0,18}$/),
  operatorId: z.string().regex(/^[1-9]\d{0,18}$/),
  initialWeight: z.number().min(0.001).max(999999)
    .refine((value) => toMilligrams(value) / 1000 === value),
  enteredOn: z.iso.date(),
  priority: z.enum(["Normal", "Alta", "Urgente"]),
  dueAt: z.iso.date(),
});

export async function POST(request: Request) {
  if (!await getCurrentUser()) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = createLotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Revisá los datos del lote." }, { status: 400 });
  const input = parsed.data;

  if (input.enteredOn > getWorkshopDate() || input.dueAt < input.enteredOn) {
    return Response.json({ error: "La entrada no puede ser futura ni posterior a la entrega programada." }, { status: 400 });
  }

  try {
    await ensureRollingSetup();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<(RowDataPacket & { processId: number })[]>(`
        SELECT p.id AS processId FROM processes p
        JOIN chain_models m ON m.id = ? AND m.is_active = TRUE
        JOIN operators o ON o.id = ? AND o.is_active = TRUE
        WHERE p.slug = ? AND p.is_active = TRUE
      `, [input.modelId, input.operatorId, rollingSlug]);
      if (!rows[0]) {
        await connection.rollback();
        return Response.json({ error: "Verificá que el modelo, el operario y el proceso estén activos." }, { status: 409 });
      }

      // Lock the day's counter until both the lot and its first process are saved.
      await connection.execute(`
        INSERT INTO lot_daily_sequences (entry_date) VALUES (?)
        ON DUPLICATE KEY UPDATE last_number = last_number
      `, [input.enteredOn]);
      const [sequence] = await connection.execute<(RowDataPacket & { last_number: number })[]>(
        "SELECT last_number FROM lot_daily_sequences WHERE entry_date = ? FOR UPDATE", [input.enteredOn],
      );
      const next = sequence[0].last_number + 1;
      if (next > 99) {
        await connection.rollback();
        return Response.json({ error: "Ya se registraron los 99 lotes permitidos para esa fecha." }, { status: 409 });
      }
      const [year, month, day] = input.enteredOn.split("-");
      const code = `${day}${month}${year.slice(-2)}${String(next).padStart(2, "0")}`;
      const enteredAt = `${input.enteredOn} 00:00:00`;
      await connection.execute("UPDATE lot_daily_sequences SET last_number = ? WHERE entry_date = ?", [next, input.enteredOn]);

      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO lots (code, model_id, current_process_id, assigned_operator_id, initial_weight,
          current_weight, progress, status, priority, entered_at, due_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'En proceso', ?, ?, ?)
      `, [code, input.modelId, rows[0].processId, input.operatorId, input.initialWeight,
        input.initialWeight, input.priority, enteredAt, input.dueAt]);
      await connection.execute(`
        INSERT INTO lot_processes (lot_id, process_id, operator_id, status, input_weight, started_at)
        VALUES (?, ?, ?, 'En proceso', ?, ?)
      `, [result.insertId, rows[0].processId, input.operatorId, input.initialWeight, enteredAt]);
      await connection.commit();
      return Response.json({ id: result.insertId, code }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("No se pudo crear el lote:", error);
    return Response.json({ error: "No se pudo guardar el lote. Intentá nuevamente." }, { status: 500 });
  }
}
