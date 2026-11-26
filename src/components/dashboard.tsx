import { AlertTriangle, Boxes, CheckCircle2, CircleGauge, Weight } from "lucide-react";
import Link from "next/link";
import type { DashboardData } from "@/types/domain";
import { LotsTable } from "./lots-table";
import styles from "./dashboard.module.css";

const formatWeight = (value: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <main className={styles.content}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>PANEL DE PRODUCCIÓN</span><h1>Todo el taller, de un vistazo.</h1><p>Seguimiento de lotes, pesos y procesos en tiempo real.</p></div>
        <div className={`${styles.modeBadge} ${data.source === "mysql" ? styles.live : ""}`}><span />{data.source === "mysql" ? "MySQL conectado" : "Sin conexión"}</div>
      </section>

      {data.databaseMessage && <div className={styles.warning}><AlertTriangle size={17} />{data.databaseMessage}</div>}

      <section className={styles.stats} aria-label="Indicadores">
        <Metric icon={<Boxes size={20} />} label="Lotes activos" value={String(data.stats.activeLots)} detail="En 5 procesos" />
        <Metric icon={<Weight size={20} />} label="Metal en proceso" value={`${formatWeight(data.stats.totalWeight)} g`} detail="Peso actual registrado" />
        <Metric icon={<CheckCircle2 size={20} />} label="Finalizados hoy" value={String(data.stats.completedToday)} detail="Listos para entrega" />
        <Metric icon={<CircleGauge size={20} />} label="Rendimiento medio" value={`${data.stats.averageYield.toFixed(1)}%`} detail="Sobre lotes terminados" highlight />
      </section>

      <section className={styles.panel} id="procesos" aria-labelledby="procesos-title">
        <div className={styles.panelHeader}><div><span className={styles.eyebrow}>FLUJO ACTUAL</span><h2 id="procesos-title">Lotes por proceso</h2></div></div>
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

      <section className={styles.panel} id="lotes" aria-labelledby="lotes-title">
        <div className={styles.panelHeader}>
          <div><span className={styles.eyebrow}>ACTIVIDAD</span><h2 id="lotes-title">Lotes recientes</h2></div>
          <Link href="/lotes">Ver todos los lotes</Link>
        </div>
        <LotsTable lots={data.lots} />
      </section>
    </main>
  );
}

function Metric({ icon, label, value, detail, highlight = false }: { icon: React.ReactNode; label: string; value: string; detail: string; highlight?: boolean }) {
  return <article className={`${styles.metric} ${highlight ? styles.metricHighlight : ""}`}><div className={styles.metricIcon}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}
