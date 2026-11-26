import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { UserManagement } from "@/components/user-management";
import { getCurrentUser, listUsers } from "@/lib/auth";
import styles from "./users.module.css";

export const instant = false;

export default async function UsersPage() {
  await connection();
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "admin") redirect("/");

  const users = await listUsers();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><span>ADMINISTRACIÓN</span><h1>Usuarios y accesos</h1><p>Asigná un rol y activá las nuevas solicitudes para permitir su ingreso.</p></div>
        <Link href="/">Volver al panel</Link>
      </header>
      <UserManagement initialUsers={users} currentUserId={currentUser.id} />
    </main>
  );
}
