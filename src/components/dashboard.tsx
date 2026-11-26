"use client";

import {
  Activity, AlertTriangle, Boxes, CheckCircle2, ChevronRight, CircleGauge, Factory,
  LayoutDashboard, LogOut, Menu, PackagePlus, Search, Users, Weight, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import type { AuthUser } from "@/types/auth";
import type { DashboardData, LotSummary, Priority } from "@/types/domain";
import styles from "./dashboard.module.css";

const navItems = [
  { label: "Resumen", icon: LayoutDashboard, active: true },
  { label: "Lotes", icon: Boxes },
  { label: "Procesos", icon: Activity },
  { label: "Modelos", icon: Factory },
  { label: "Operadores", icon: Users },
];

const formatWeight = (value: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));

export function Dashboard({ initialData, user, dateLabel }: { initialData: DashboardData; user: AuthUser; dateLabel: string }) {
  const router = useRouter();
  const data = initialData;
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const firstName = user.displayName.split(/\s+/)[0];
  const initials = user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const roleLabel = user.role === "admin" ? "Administrador" : user.role === "supervisor" ? "Supervisor" : "Operario";

  async function logout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const filteredLots = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return data.lots;
    return data.lots.filter((lot) => [lot.code, lot.model, lot.process, lot.operator].some((value) => value.toLocaleLowerCase("es").includes(normalized)));
  }, [data.lots, query]);

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><span /></span>
          <div><strong>CADENA</strong><small>Control de producción</small></div>
          <button className={styles.closeMenu} onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <nav className={styles.nav} aria-label="Navegación principal">
          <p>OPERACIÓN</p>
          {navItems.map(({ label, icon: Icon, active }) => (
            <button className={active ? styles.navActive : ""} key={label}><Icon size={18} /><span>{label}</span>{active && <i />}</button>
          ))}
          {user.role === "admin" && <><p>ADMINISTRACIÓN</p><button onClick={() => router.push("/admin/users")}><Users size={18} /><span>Usuarios</span></button></>}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.avatar}>{initials}</div>
          <div><strong>{user.displayName}</strong><small>{roleLabel}</small></div>
          <button onClick={logout} disabled={signingOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </aside>

      {menuOpen && <button className={styles.scrim} onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
          <div><p>{dateLabel}</p><h1>Buen día, {firstName}</h1></div>
          <div className={styles.topActions}>
            <label className={styles.search}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lote..." /></label>
            <button className={styles.primaryButton} onClick={() => setModalOpen(true)}><PackagePlus size={18} />Nuevo lote</button>
          </div>
        </header>

        <div className={styles.content}>
          <section className={styles.hero}>
            <div><span className={styles.eyebrow}>PANEL DE PRODUCCIÓN</span><h2>Todo el taller, de un vistazo.</h2><p>Seguimiento de lotes, pesos y procesos en tiempo real.</p></div>
            <div className={`${styles.modeBadge} ${data.source === "mysql" ? styles.live : ""}`}><span />{data.source === "mysql" ? "MySQL conectado" : "Sin conexión"}</div>
          </section>

          {data.databaseMessage && <div className={styles.warning}><AlertTriangle size={17} />{data.databaseMessage}</div>}

          <section className={styles.stats} aria-label="Indicadores">
            <Metric icon={<Boxes size={20} />} label="Lotes activos" value={String(data.stats.activeLots)} detail="En 5 procesos" />
            <Metric icon={<Weight size={20} />} label="Metal en proceso" value={`${formatWeight(data.stats.totalWeight)} g`} detail="Peso actual registrado" />
            <Metric icon={<CheckCircle2 size={20} />} label="Finalizados hoy" value={String(data.stats.completedToday)} detail="Listos para entrega" />
            <Metric icon={<CircleGauge size={20} />} label="Rendimiento medio" value={`${data.stats.averageYield.toFixed(1)}%`} detail="Sobre lotes terminados" highlight />
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>FLUJO ACTUAL</span><h3>Lotes por proceso</h3></div><button>Ver procesos <ChevronRight size={16} /></button></div>
            <div className={styles.pipeline}>
              {data.processes.map((process, index) => (
                <div className={styles.processStep} key={process.id}>
                  <span className={styles.processDot} style={{ background: process.accent }}>{index + 1}</span>
                  <div><strong>{process.name}</strong><small>{process.activeLots} {process.activeLots === 1 ? "lote" : "lotes"}</small></div>
                  {index < data.processes.length - 1 && <i />}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>ACTIVIDAD</span><h3>Lotes recientes</h3></div><button>Ver todos <ChevronRight size={16} /></button></div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Lote / modelo</th><th>Proceso actual</th><th>Operador</th><th>Peso</th><th>Avance</th><th>Entrega</th></tr></thead>
                <tbody>
                  {filteredLots.map((lot) => <LotRow lot={lot} key={lot.id} />)}
                </tbody>
              </table>
              {filteredLots.length === 0 && <div className={styles.empty}>No encontramos lotes para “{query}”.</div>}
            </div>
          </section>
        </div>
      </main>

      {modalOpen && <NewLotModal data={data} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function Metric({ icon, label, value, detail, highlight = false }: { icon: React.ReactNode; label: string; value: string; detail: string; highlight?: boolean }) {
  return <article className={`${styles.metric} ${highlight ? styles.metricHighlight : ""}`}><div className={styles.metricIcon}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function LotRow({ lot }: { lot: LotSummary }) {
  return (
    <tr>
      <td><div className={styles.lotTitle}><span className={styles.lotIcon}>{lot.code.slice(-2)}</span><div><strong>{lot.code}</strong><small>{lot.model} · <em className={styles[`priority${lot.priority}`]}>{lot.priority}</em></small></div></div></td>
      <td><span className={styles.processPill}>{lot.process}</span></td>
      <td>{lot.operator}</td>
      <td><strong>{formatWeight(lot.currentWeight)} g</strong><small className={styles.cellSub}>de {formatWeight(lot.initialWeight)} g</small></td>
      <td><div className={styles.progressLabel}><span>{lot.progress}%</span><small>{lot.status}</small></div><div className={styles.progress}><i style={{ width: `${lot.progress}%` }} /></div></td>
      <td><strong>{formatDate(lot.dueAt)}</strong><small className={styles.cellSub}>Programada</small></td>
    </tr>
  );
}

function NewLotModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const nextCode = `LT-${String(265 + data.lots.length).padStart(4, "0")}`;
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
