import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { ensureRollingReceipts, rollingSlug } from "@/lib/rolling";
import { getWorkshopTimestamp } from "@/lib/workshop-date";

const id = z.string().regex(/^[1-9]\d{0,19}$/);
const receiptSchema = z.object({ processId: id, operatorId: id });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado." }, { status: 401 });
  const parsed = receiptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "La asignación no es válida." }, { status: 400 });
  const { processId, operatorId } = parsed.data;

  try {
    await ensureRollingReceipts();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [processes] = await connection.execute<RowDataPacket[]>(`
        SELECT lp.id FROM lot_processes lp
        JOIN processes p ON p.id = lp.process_id AND p.slug = ?
        JOIN lots l ON l.id = lp.lot_id AND l.current_process_id = lp.process_id
        WHERE lp.id = ? AND lp.operator_id = ? AND lp.status = 'En proceso'
          AND lp.started_at IS NOT NULL AND l.status = 'En proceso'
        FOR UPDATE
      `, [rollingSlug, processId, operatorId]);
      if (!processes.length) {
        await connection.rollback();
        return Response.json({ error: "La asignación cambió o el proceso ya no está activo. Actualizá la pantalla." }, { status: 409 });
      }
      const [receipts] = await connection.execute<(RowDataPacket & { operatorId: string })[]>(`
        SELECT CAST(operator_id AS CHAR) AS operatorId FROM lot_process_receipts
        WHERE lot_process_id = ? ORDER BY id DESC LIMIT 1
      `, [processId]);
      if (receipts[0]?.operatorId === operatorId) {
        await connection.rollback();
        return Response.json({ error: "La recepción de este operario ya está registrada." }, { status: 409 });
      }
      await connection.execute(`
        INSERT INTO lot_process_receipts (lot_process_id, operator_id, recorded_by, received_at)
        VALUES (?, ?, ?, ?)
      `, [processId, operatorId, user.id, getWorkshopTimestamp()]);
      await connection.commit();
      return Response.json({ ok: true }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("No se pudo registrar la recepción:", error);
    return Response.json({ error: "No se pudo registrar la recepción. Intentá nuevamente." }, { status: 500 });
  }
}
