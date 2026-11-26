import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppNavigation } from "@/components/app-navigation";
import { UserManagement } from "@/components/user-management";
import { getCurrentUser, listUsers } from "@/lib/auth";
import { getWorkshopDateLabel } from "@/lib/workshop-date";
import styles from "./users.module.css";

export const instant = false;

export default async function UsersPage() {
  await connection();
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "admin") redirect("/");

  const users = await listUsers();
  return (
    <>
      <AppNavigation user={currentUser} current="users" dateLabel={getWorkshopDateLabel()} databaseConnected />
      <main className={styles.page}>
        <p className={styles.instructions}>Asigná un rol y activá las nuevas solicitudes para permitir su ingreso.</p>
        <UserManagement initialUsers={users} currentUserId={currentUser.id} />
      </main>
    </>
  );
}
