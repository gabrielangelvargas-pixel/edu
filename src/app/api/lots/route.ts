import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { ensureRollingSetup } from "@/lib/rolling";
import { toMilligrams } from "@/lib/weights";
import { getWorkshopDate } from "@/lib/workshop-date";

const createLotSchema = z.object({
  modelId: z.string().regex(/^[1-9]\d{0,18}$/),
  initialWeight: z.number().min(0.001).max(999999)
    .refine((value) => toMilligrams(value) / 1000 === value),
  enteredOn: z.iso.date(),
  priority: z.enum(["Normal", "Alta", "Urgente"]),
});

export async function POST(request: Request) {
  if (!await getCurrentUser()) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = createLotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Revisá los datos del lote." }, { status: 400 });
  const input = parsed.data;

  if (input.enteredOn > getWorkshopDate()) {
    return Response.json({ error: "La fecha de alta no puede ser futura." }, { status: 400 });
  }

  try {
    await ensureRollingSetup();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM chain_models WHERE id = ? AND is_active = TRUE", [input.modelId],
      );
      if (!rows[0]) {
        await connection.rollback();
        return Response.json({ error: "Verificá que el modelo esté activo." }, { status: 409 });
      }

      // Lock the day's counter until the lot is saved.
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
        INSERT INTO lots (code, model_id, initial_weight,
          current_weight, status, priority, entered_at)
        VALUES (?, ?, ?, ?, 'Pendiente', ?, ?)
      `, [code, input.modelId, input.initialWeight,
        input.initialWeight, input.priority, enteredAt]);
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
