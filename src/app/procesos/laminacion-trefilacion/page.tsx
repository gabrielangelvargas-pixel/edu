import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppNavigation } from "@/components/app-navigation";
import { RollingCloseForm } from "@/components/rolling-close-form";
import styles from "@/components/dashboard.module.css";
import { getCurrentUser } from "@/lib/auth";
import { getRollingRecords } from "@/lib/rolling";
import { formatGrams, toMilligrams } from "@/lib/weights";
import { getWorkshopDate, getWorkshopDateLabel } from "@/lib/workshop-date";

export const instant = false;

function shortDate(date: string) {
  return date.split("-").reverse().join("/");
}

export default async function RollingPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const records = await getRollingRecords().catch((error: unknown) => {
    console.error("No se pudieron consultar los registros de laminación y trefilación:", error);
    return null;
  });
  const today = getWorkshopDate();

  return (
    <>
      <AppNavigation user={user} current="rolling" dateLabel={getWorkshopDateLabel()} databaseConnected={records !== null} />
      <main className={styles.content}>
        <div className={styles.topActions}>
          <Link className={styles.primaryButton} href="/lotes#nuevo-lote">Registrar entrada desde Lotes</Link>
        </div>
        {records === null && <p className={styles.warning}>No se pudieron consultar los registros. Intentá recargar la página.</p>}
        {records?.length === 0 && <p className={styles.empty}>Todavía no hay registros de esta etapa.</p>}
        {records?.map((record) => (
          <article key={record.id} className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Lote {record.code} · {record.model}</h2>
              <span className={styles.processPill}>{record.status === "Terminado" ? "Finalizado" : record.status}</span>
            </div>
            <dl className={styles.rollingDetails}>
              <div><dt>Fecha de entrada</dt><dd>{shortDate(record.enteredOn)}</dd></div>
              <div><dt>Lingote de entrada</dt><dd>{formatGrams(Number(record.inputWeight))} g</dd></div>
              <div><dt>Operario</dt><dd>{record.operator || "Sin asignar"}</dd></div>
              {record.finishedOn && (
                <>
                  <div><dt>Fecha de salida</dt><dd>{shortDate(record.finishedOn)}</dd></div>
                  <div><dt>Alambre de salida</dt><dd>{formatGrams(Number(record.outputWeight))} g</dd></div>
                  <div><dt>Recortes en el contenedor</dt><dd>{formatGrams(Number(record.scrapWeight))} g</dd></div>
                  <div><dt>Diferencia de peso</dt><dd>{formatGrams((
                    toMilligrams(Number(record.inputWeight)) - toMilligrams(Number(record.outputWeight)) -
                    toMilligrams(Number(record.scrapWeight))
                  ) / 1000)} g</dd></div>
                  {record.notes && <div><dt>Observación</dt><dd>{record.notes}</dd></div>}
                </>
              )}
            </dl>
            {record.status === "En proceso" && (
              <details className={styles.rollingDetailsToggle}>
                <summary>Registrar salida</summary>
                <RollingCloseForm id={record.id} enteredOn={record.enteredOn} inputWeight={Number(record.inputWeight)} today={today} />
              </details>
            )}
          </article>
        ))}
      </main>
    </>
  );
}
