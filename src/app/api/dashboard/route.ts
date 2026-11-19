import { connection } from "next/server";
import { getDashboardData } from "@/lib/dashboard-data";

export async function GET() {
  await connection();
  return Response.json(await getDashboardData(), { headers: { "Cache-Control": "no-store" } });
}
