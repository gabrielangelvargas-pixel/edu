"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CatalogOption } from "@/types/domain";
import styles from "./dashboard.module.css";

export function RollingStartForm({ id, lotDate, today, currentTime, operators, assignment }: {
  id: string;
  lotDate: string;
  today: string;
  currentTime: string;
  operators: CatalogOption[];
  assignment?: { enteredOn: string; enteredTime: string | null; operatorId: string };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/processes/rolling", {
        method: assignment ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(assignment ? { processId: id } : { lotId: id }), operatorId: form.get("operatorId"),
          enteredOn: form.get("enteredOn"), enteredTime: form.get("enteredTime") || null,
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "No se pudo iniciar la etapa.");
      }
      router.refresh();
      if (assignment) setSaving(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar la etapa.");
      setSaving(false);
    }
  }

  if (operators.length === 0) return <p>No hay operarios activos para asignar.</p>;

  return (
    <form onSubmit={submit} className={styles.rollingForm}>
      <fieldset disabled={saving} className={styles.formGrid}>
        <label><span>Fecha de entrada</span><input name="enteredOn" type="date" defaultValue={assignment?.enteredOn ?? today} min={lotDate} max={today} required /></label>
        <label>
          <span>Hora de entrada</span>
          <input name="enteredTime" type="time" defaultValue={assignment ? assignment.enteredTime ?? "" : currentTime}
            required={!assignment || assignment.enteredTime !== null} />
        </label>
        <label>
          <span>Operario de la etapa</span>
          <select name="operatorId" defaultValue={assignment?.operatorId ?? ""} required>
            <option value="" disabled>Seleccioná un operario</option>
            {operators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name}</option>)}
          </select>
        </label>
        {error && <p className={styles.formError} role="alert">{error}</p>}
        <button type="submit" className={styles.primaryButton}>{saving ? "Guardando..." : assignment ? "Guardar cambios" : "Iniciar etapa"}</button>
      </fieldset>
    </form>
  );
}
