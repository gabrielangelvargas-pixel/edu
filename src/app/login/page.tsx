import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import styles from "./login.module.css";

export const instant = false;

export default async function LoginPage() {
  await connection();
  if (await getCurrentUser()) redirect("/");

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brandMark}><span /></div>
        <span className={styles.eyebrow}>CONTROL DE PRODUCCIÓN</span>
        <h1>Bienvenido a Cadena</h1>
        <p>Ingresá con tus credenciales para acceder al seguimiento del taller.</p>
        <LoginForm />
      </section>
      <p className={styles.footer}>Cadena · Gestión de procesos y lotes</p>
    </main>
  );
}
