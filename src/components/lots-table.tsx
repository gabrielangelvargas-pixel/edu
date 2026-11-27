import type { LotSummary } from "@/types/domain";
import styles from "./dashboard.module.css";

const formatWeight = (value: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));

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
