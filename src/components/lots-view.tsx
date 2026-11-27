"use client";

import { AlertTriangle, PackagePlus, Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { DashboardData, Priority } from "@/types/domain";
import { LotsTable } from "./lots-table";
import styles from "./dashboard.module.css";

type LotsData = Pick<DashboardData, "lots" | "databaseMessage">;

export function LotsView({ data, today }: { data: LotsData; today: string }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const search = query.trim().toLocaleLowerCase("es");
  const filteredLots = data.lots.filter((lot) =>
    [lot.code, lot.process, lot.operator].some((value) => value.toLocaleLowerCase("es").includes(search)),
  );

  return (
    <main className={styles.content}>
      <div className={styles.topActions}>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Buscar lote" value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lote..." />
        </label>
        <button id="nuevo-lote" type="button" className={styles.primaryButton} disabled={Boolean(data.databaseMessage)}
          onClick={() => setModalOpen(true)}><PackagePlus size={18} aria-hidden="true" />Nuevo lote</button>
      </div>
      {data.databaseMessage ? (
        <p className={styles.warning}><AlertTriangle size={17} />{data.databaseMessage}</p>
      ) : (
        <section className={styles.panel} aria-label="Listado de lotes">
          <LotsTable lots={filteredLots} emptyMessage={search ? "No encontramos lotes para esa búsqueda." : undefined} />
        </section>
      )}
      {modalOpen && <NewLotModal today={today} onClose={() => setModalOpen(false)} />}
    </main>
  );
}

function NewLotModal({ today, onClose }: { today: string; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      initialWeight: Number(form.get("initialWeight")), enteredOn: String(form.get("enteredOn")),
      priority: String(form.get("priority")) as Priority,
    };
    try {
      const response = await fetch("/api/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear el lote.");
      window.location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo crear el lote."); setSubmitting(false); }
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="new-lot-title">
        <div className={styles.modalHeader}><div><h2 id="new-lot-title">Crear lote de producción</h2><p>El código de 8 dígitos se asigna al guardar. El lote queda pendiente de envío a producción.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label><span>Fecha de alta del lote</span><input name="enteredOn" type="date" defaultValue={today} max={today} required /></label>
            <label><span>Peso de entrada del lingote (g)</span><input name="initialWeight" type="number" min="0.001" max="999999" step="0.001" required /></label>
            <label><span>Prioridad</span><select name="priority" defaultValue="Normal"><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
          </div>
          {error && <p className={styles.formError}><AlertTriangle size={16} />{error}</p>}
          <div className={styles.modalActions}><button type="button" onClick={onClose}>Cancelar</button><button className={styles.primaryButton} disabled={submitting}>{submitting ? "Guardando..." : "Crear lote"}</button></div>
        </form>
      </div>
    </div>
  );
}
