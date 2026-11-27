import type { LotSummary } from "@/types/domain";
import { formatGrams } from "@/lib/weights";
import styles from "./dashboard.module.css";
import registry from "./lots-registry.module.css";

const formatWeight = (value: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
const formatUpdate = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires",
});

export function LotsRegistry({ lots, emptyMessage = "Todavía no hay lotes registrados." }: {
  lots: LotSummary[];
  emptyMessage?: string;
}) {
  if (!lots.length) return <p className={styles.empty} role="status">{emptyMessage}</p>;

  return (
    <div className={registry.scroll} role="region" aria-label="Datos de los lotes" tabIndex={0}>
      <table className={registry.table}>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col" className={registry.weight}>Gramaje inicial</th>
            <th scope="col" className={registry.weight}>Gramaje actual</th>
            <th scope="col">Avance</th>
            <th scope="col">Estado</th>
            <th scope="col">Prioridad</th>
            <th scope="col">Fecha de alta</th>
            <th scope="col">Última actualización</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const date = lot.enteredAt.slice(0, 10);
            return (
              <tr key={lot.id}>
                <th scope="row">{lot.code}</th>
                <td className={registry.weight}>{formatGrams(lot.initialWeight)} g</td>
                <td className={registry.weight}><strong>{formatGrams(lot.currentWeight)} g</strong></td>
                <td><span>{lot.progress}%</span><progress value={lot.progress} max={100} aria-label={`Avance del lote ${lot.code}`} /></td>
                <td><span className={registry.status} data-status={lot.status}>{lot.status}</span></td>
                <td><span className={registry.priority} data-priority={lot.priority}>{lot.priority}</span></td>
                <td><time dateTime={date}>{date.split("-").reverse().join("/")}</time></td>
                <td><time dateTime={lot.updatedAt}>{formatUpdate.format(new Date(lot.updatedAt)).replace(",", "")}</time></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LotsTable({ lots, emptyMessage = "Todavía no hay lotes registrados." }: {
  lots: LotSummary[];
  emptyMessage?: string;
}) {
  if (!lots.length) return <p className={styles.empty}>{emptyMessage}</p>;

  return (
    <div className={styles.tableWrap}>
      <table>
        <thead><tr><th>Lote</th><th>Proceso actual</th><th>Operario</th><th>Peso</th><th>Avance</th><th>Alta</th></tr></thead>
        <tbody>{lots.map((lot) => <LotRow lot={lot} key={lot.id} />)}</tbody>
      </table>
    </div>
  );
}

function LotRow({ lot }: { lot: LotSummary }) {
  return (
    <tr>
      <td><div className={styles.lotTitle}><span className={styles.lotIcon}>{lot.code.slice(-2)}</span><div><strong>{lot.code}</strong><small><em className={styles[`priority${lot.priority}`]}>{lot.priority}</em></small></div></div></td>
      <td><span className={styles.processPill}>{lot.process}</span></td>
      <td>{lot.operator}</td>
      <td><strong>{formatWeight(lot.currentWeight)} g</strong><small className={styles.cellSub}>de {formatWeight(lot.initialWeight)} g</small></td>
      <td><div className={styles.progressLabel}><span>{lot.progress}%</span><small>{lot.status}</small></div><div className={styles.progress}><i style={{ width: `${lot.progress}%` }} /></div></td>
      <td>{formatDate(lot.enteredAt.slice(0, 10))}</td>
    </tr>
  );
}
