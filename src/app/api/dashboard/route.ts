import { getDashboardData } from "@/lib/dashboard-data";

export async function GET() {
  return Response.json(await getDashboardData(), { headers: { "Cache-Control": "no-store" } });
}
