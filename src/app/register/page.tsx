import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { RegisterForm } from "@/components/register-form";
import { getCurrentUser } from "@/lib/auth";
import styles from "@/app/login/login.module.css";

export const instant = false;

export default async function RegisterPage() {
  await connection();
  if (await getCurrentUser()) redirect("/");

  return (
    <main className={styles.page}>
      <section className={`${styles.card} ${styles.registerCard}`}>
        <div className={styles.brandMark}><span /></div>
        <span className={styles.eyebrow}>SOLICITUD DE ACCESO</span>
        <h1>Crear una cuenta</h1>
        <p>Tu cuenta quedará pendiente hasta que un administrador le asigne un rol y la active.</p>
        <RegisterForm />
        <p className={styles.authLink}>¿Ya tenés una cuenta? <Link href="/login">Volver al ingreso</Link></p>
      </section>
      <p className={styles.footer}>Cadena · Gestión de procesos y lotes</p>
    </main>
  );
}
