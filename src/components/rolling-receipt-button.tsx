"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export function RollingReceiptButton({ id, operatorId }: { id: string; operatorId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function recordReceipt() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/processes/rolling/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: id, operatorId }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "No se pudo registrar la recepción.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar la recepción.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.rollingDetailsToggle}>
      <button type="button" className={styles.primaryButton} onClick={recordReceipt} disabled={saving}>
        {saving ? "Registrando..." : "Registrar recepción"}
      </button>
      {error && <p className={styles.formError} role="alert">{error}</p>}
    </div>
  );
}
