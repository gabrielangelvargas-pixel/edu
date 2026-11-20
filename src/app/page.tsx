import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const instant = false;

export default async function Home() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getDashboardData();
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

  return <Dashboard initialData={data} user={user} dateLabel={dateLabel} />;
}
