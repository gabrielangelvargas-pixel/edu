import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/dashboard-data";

export const instant = false;

export default async function Home() {
  await connection();
  const data = await getDashboardData();

  return <Dashboard initialData={data} />;
}
