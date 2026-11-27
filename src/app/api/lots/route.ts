import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { ensureRollingSetup } from "@/lib/rolling";
import { toMilligrams } from "@/lib/weights";
import { getWorkshopDate } from "@/lib/workshop-date";

const createLotSchema = z.object({
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
      // Lock the day's counter until the lot is saved.
      await connection.execute(`
        INSERT INTO secuencias_diarias_lotes (fecha_alta) VALUES (?)
        ON DUPLICATE KEY UPDATE ultimo_numero = ultimo_numero
      `, [input.enteredOn]);
      const [sequence] = await connection.execute<(RowDataPacket & { last_number: number })[]>(
        "SELECT ultimo_numero AS last_number FROM secuencias_diarias_lotes WHERE fecha_alta = ? FOR UPDATE", [input.enteredOn],
      );
      const next = sequence[0].last_number + 1;
      if (next > 99) {
        await connection.rollback();
        return Response.json({ error: "Ya se registraron los 99 lotes permitidos para esa fecha." }, { status: 409 });
      }
      const [year, month, day] = input.enteredOn.split("-");
      const code = `${day}${month}${year.slice(-2)}${String(next).padStart(2, "0")}`;
      const enteredAt = `${input.enteredOn} 00:00:00`;
      await connection.execute("UPDATE secuencias_diarias_lotes SET ultimo_numero = ? WHERE fecha_alta = ?", [next, input.enteredOn]);

      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO lotes (codigo, gramaje_inicial,
          gramaje_actual, estado, prioridad, fecha_alta)
        VALUES (?, ?, ?, 'Pendiente', ?, ?)
      `, [code, input.initialWeight,
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
