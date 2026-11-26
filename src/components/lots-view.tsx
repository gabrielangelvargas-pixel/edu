"use client";

import { AlertTriangle, PackagePlus, Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { DashboardData, Priority } from "@/types/domain";
import { LotsTable } from "./lots-table";
import styles from "./dashboard.module.css";

type LotsData = Pick<DashboardData, "lots" | "models" | "operators" | "databaseMessage">;

export function LotsView({ data }: { data: LotsData }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const search = query.trim().toLocaleLowerCase("es");
  const filteredLots = data.lots.filter((lot) =>
    [lot.code, lot.model, lot.process, lot.operator].some((value) => value.toLocaleLowerCase("es").includes(search)),
  );

  return (
    <main className={styles.content}>
      <div className={styles.topActions}>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Buscar lote" value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lote..." />
        </label>
        <button type="button" className={styles.primaryButton} disabled={Boolean(data.databaseMessage)}
          onClick={() => setModalOpen(true)}><PackagePlus size={18} aria-hidden="true" />Nuevo lote</button>
      </div>
      {data.databaseMessage ? (
        <p className={styles.warning}><AlertTriangle size={17} />{data.databaseMessage}</p>
      ) : (
        <section className={styles.panel} aria-label="Listado de lotes">
          <LotsTable lots={filteredLots} emptyMessage={search ? "No encontramos lotes para esa búsqueda." : undefined} />
        </section>
      )}
      {modalOpen && <NewLotModal data={data} onClose={() => setModalOpen(false)} />}
    </main>
  );
}

function NewLotModal({ data, onClose }: { data: LotsData; onClose: () => void }) {
  const lastNumber = data.lots.reduce((max, lot) => {
    const match = /^LT-(\d{1,12})$/i.exec(lot.code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 264);
  const nextCode = `LT-${String(lastNumber + 1).padStart(4, "0")}`;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { code: String(form.get("code")), modelId: String(form.get("modelId")), operatorId: String(form.get("operatorId")) || undefined, initialWeight: Number(form.get("initialWeight")), priority: String(form.get("priority")) as Priority, dueAt: String(form.get("dueAt")) };
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
        <div className={styles.modalHeader}><div><span className={styles.eyebrow}>NUEVO REGISTRO</span><h2 id="new-lot-title">Crear lote de producción</h2><p>Podrás completar pesos y movimientos durante cada proceso.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label><span>Código del lote</span><input name="code" defaultValue={nextCode} required /></label>
            <label><span>Modelo de cadena</span><select name="modelId" required>{data.models.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label><span>Peso inicial (gramos)</span><input name="initialWeight" type="number" min="0.01" step="0.01" placeholder="0,00" required /></label>
            <label><span>Operador inicial</span><select name="operatorId" defaultValue=""><option value="">Sin asignar</option>{data.operators.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label><span>Prioridad</span><select name="priority" defaultValue="Normal"><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
            <label><span>Fecha de entrega</span><input name="dueAt" type="date" required /></label>
          </div>
          {error && <p className={styles.formError}><AlertTriangle size={16} />{error}</p>}
          <div className={styles.modalActions}><button type="button" onClick={onClose}>Cancelar</button><button className={styles.primaryButton} disabled={submitting}>{submitting ? "Guardando..." : "Crear lote"}</button></div>
        </form>
      </div>
    </div>
  );
}
