import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { AppNavigation } from "@/components/app-navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { getWorkshopDateLabel } from "@/lib/workshop-date";

export const instant = false;

export default async function Home() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getDashboardData();
  return (
    <>
      <AppNavigation user={user} current="summary" dateLabel={getWorkshopDateLabel()} />
      <Dashboard data={data} />
    </>
  );
}
