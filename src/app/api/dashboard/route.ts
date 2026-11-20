import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export async function GET() {
  await connection();
  if (!await getCurrentUser()) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  return Response.json(await getDashboardData(), { headers: { "Cache-Control": "no-store" } });
}
