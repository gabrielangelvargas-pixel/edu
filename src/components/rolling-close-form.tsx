"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatGrams, toMilligrams } from "@/lib/weights";
import styles from "./dashboard.module.css";

export function RollingCloseForm({ id, enteredOn, inputWeight, today }: {
  id: string;
  enteredOn: string;
  inputWeight: number;
  today: string;
}) {
  const router = useRouter();
  const [output, setOutput] = useState("");
  const [scrap, setScrap] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const difference = toMilligrams(inputWeight) - toMilligrams(Number(output)) - toMilligrams(Number(scrap));
  const hasWeights = output !== "" && scrap !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/processes/rolling", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId: id, finishedOn: form.get("finishedOn"),
          outputWeight: Number(output), scrapWeight: Number(scrap), notes: form.get("notes"),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "No se pudo guardar la salida.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la salida.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.rollingForm}>
      <fieldset disabled={saving} className={styles.formGrid}>
        <label><span>Fecha de salida</span><input name="finishedOn" type="date" defaultValue={today} min={enteredOn} max={today} required /></label>
        <label><span>Peso de salida del alambre (g)</span><input value={output} onChange={(event) => setOutput(event.target.value)} type="number" min="0" max="999999" step="0.001" required /></label>
        <label><span>Peso de recortes en el contenedor (g)</span><input value={scrap} onChange={(event) => setScrap(event.target.value)} type="number" min="0" max="999999" step="0.001" required /></label>
        <label><span>Observación{hasWeights && difference !== 0 ? " (obligatoria)" : ""}</span><input name="notes" maxLength={1000} required={hasWeights && difference !== 0} /></label>
        {hasWeights && <p aria-live="polite">Diferencia de peso: {formatGrams(difference / 1000)} g</p>}
        {error && <p className={styles.formError} role="alert">{error}</p>}
        <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Guardando..." : "Finalizar etapa"}</button>
      </fieldset>
    </form>
  );
}
