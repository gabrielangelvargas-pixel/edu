import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { rollingSlug } from "@/lib/rolling";
import { toMilligrams } from "@/lib/weights";
import { getWorkshopDate } from "@/lib/workshop-date";

const weight = z.number().min(0).max(999999).refine((value) => toMilligrams(value) / 1000 === value);
const startSchema = z.object({
  processId: z.string().regex(/^[1-9]\d{0,19}$/),
  operatorId: z.string().regex(/^[1-9]\d{0,19}$/),
  enteredOn: z.iso.date(),
});

export async function POST(request: Request) {
  if (!await getCurrentUser()) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.enteredOn > getWorkshopDate()) {
    return Response.json({ error: "Seleccioná un operario y una fecha de entrada válida." }, { status: 400 });
  }
  const { processId, operatorId, enteredOn } = parsed.data;

  try {
    const [result] = await getPool().execute<ResultSetHeader>(`
      UPDATE lot_processes lp
      JOIN lots l ON l.id = lp.lot_id AND l.current_process_id = lp.process_id
      JOIN processes p ON p.id = lp.process_id AND p.slug = ? AND p.is_active = TRUE
      JOIN operators o ON o.id = ? AND o.is_active = TRUE
      SET lp.status = 'En proceso', lp.operator_id = o.id, lp.started_at = ?,
          lp.input_weight = l.current_weight, l.status = 'En proceso', l.assigned_operator_id = o.id
      WHERE lp.id = ? AND lp.status = 'Pendiente' AND lp.started_at IS NULL
        AND l.status = 'Pendiente' AND DATE(l.entered_at) <= ?
    `, [rollingSlug, operatorId, `${enteredOn} 00:00:00`, processId, enteredOn]);
    if (!result.affectedRows) {
      return Response.json({ error: "Verificá que el lote siga pendiente, el operario esté activo y la entrada sea igual o posterior al alta." }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("No se pudo iniciar el proceso:", error);
    return Response.json({ error: "No se pudo iniciar la etapa. Intentá nuevamente." }, { status: 500 });
  }
}

const closureSchema = z.object({
  processId: z.string().regex(/^[1-9]\d{0,19}$/),
  finishedOn: z.iso.date(),
  outputWeight: weight,
  scrapWeight: weight,
  notes: z.string().trim().max(1000),
});

type ProcessRow = RowDataPacket & {
  lotId: string;
  status: string;
  isCurrent: number;
  enteredOn: string;
  inputWeight: number | string;
};

export async function PATCH(request: Request) {
  if (!await getCurrentUser()) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const parsed = closureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Revisá la fecha y los pesos de salida." }, { status: 400 });
  const input = parsed.data;

  try {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<ProcessRow[]>(`
        SELECT CAST(lp.lot_id AS CHAR) AS lotId, lp.status,
          (l.current_process_id = lp.process_id AND l.status = 'En proceso') AS isCurrent,
          DATE_FORMAT(lp.started_at, '%Y-%m-%d') AS enteredOn, lp.input_weight AS inputWeight
        FROM lot_processes lp
        JOIN processes p ON p.id = lp.process_id
        JOIN lots l ON l.id = lp.lot_id
        WHERE lp.id = ? AND p.slug = ?
        FOR UPDATE
      `, [input.processId, rollingSlug]);
      const process = rows[0];
      if (!process || process.status !== "En proceso" || !process.isCurrent) {
        await connection.rollback();
        return Response.json({ error: "El registro ya se cerró o no está disponible." }, { status: 409 });
      }
      if (input.finishedOn < process.enteredOn || input.finishedOn > getWorkshopDate()) {
        await connection.rollback();
        return Response.json({ error: "La salida debe estar entre la fecha de entrada y hoy." }, { status: 400 });
      }
      const difference = toMilligrams(Number(process.inputWeight)) -
        toMilligrams(input.outputWeight) - toMilligrams(input.scrapWeight);
      if (difference !== 0 && !input.notes) {
        await connection.rollback();
        return Response.json({ error: "Anotá el motivo de la diferencia de peso antes de finalizar." }, { status: 400 });
      }

      await connection.execute(`
        UPDATE lot_processes
        SET finished_at = ?, output_weight = ?, scrap_weight = ?, notes = ?, status = 'Terminado'
        WHERE id = ?
      `, [`${input.finishedOn} 00:00:00`, input.outputWeight, input.scrapWeight, input.notes || null, input.processId]);
      await connection.execute("UPDATE lots SET current_weight = ?, status = 'Pendiente' WHERE id = ?", [input.outputWeight, process.lotId]);
      await connection.commit();
      return Response.json({ ok: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("No se pudo cerrar el proceso:", error);
    return Response.json({ error: "No se pudo guardar la salida. Intentá nuevamente." }, { status: 500 });
  }
}
