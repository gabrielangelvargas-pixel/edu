"use client";

import { AlertTriangle, CheckCircle2, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "@/app/login/login.module.css";

export function RegisterForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError("");
    const form = new FormData(formElement);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Las contraseñas no coinciden.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: String(form.get("displayName") ?? ""),
          username: String(form.get("username") ?? ""),
          password,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear la cuenta.");
      setSuccess(result.message);
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className={styles.successPanel}>
        <CheckCircle2 size={28} />
        <strong>Solicitud enviada</strong>
        <p>{success}</p>
        <Link className={styles.submitLink} href="/login">Volver al ingreso</Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label><span>Nombre y apellido</span><div className={styles.field}><UserRound size={18} /><input name="displayName" autoComplete="name" required /></div></label>
      <label><span>Nombre de usuario</span><div className={styles.field}><UserRound size={18} /><input name="username" autoComplete="username" minLength={3} required /></div></label>
      <label><span>Contraseña</span><div className={styles.field}><LockKeyhole size={18} /><input name="password" type="password" autoComplete="new-password" minLength={8} required /></div></label>
      <label><span>Repetir contraseña</span><div className={styles.field}><LockKeyhole size={18} /><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></div></label>
      <small className={styles.hint}>Mínimo 8 caracteres, con al menos una letra y un número.</small>
      {error && <div className={styles.error}><AlertTriangle size={17} />{error}</div>}
      <button className={styles.submit} disabled={submitting}>{submitting ? "Creando cuenta..." : "Crear cuenta"}</button>
    </form>
  );
}
