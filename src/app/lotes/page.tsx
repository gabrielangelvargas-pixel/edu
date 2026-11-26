import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppNavigation } from "@/components/app-navigation";
import { LotsView } from "@/components/lots-view";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { getWorkshopDateLabel } from "@/lib/workshop-date";

export const instant = false;

export default async function LotsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { lots, models, operators, source, databaseMessage } = await getDashboardData({ allLots: true });
  return (
    <>
      <AppNavigation user={user} current="lots" dateLabel={getWorkshopDateLabel()} databaseConnected={source === "mysql"} />
      <LotsView data={{ lots, models, operators, databaseMessage }} />
    </>
  );
}
