import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppNavigation } from "@/components/app-navigation";
import { RollingCloseForm } from "@/components/rolling-close-form";
import { RollingStartForm } from "@/components/rolling-start-form";
import styles from "@/components/dashboard.module.css";
import { getCurrentUser } from "@/lib/auth";
import { getRollingOperators, getRollingRecords } from "@/lib/rolling";
import { formatGrams, toMilligrams } from "@/lib/weights";
import { getWorkshopDateLabel, getWorkshopTimestamp } from "@/lib/workshop-date";

export const instant = false;

function shortDate(date: string) {
  return date.split("-").reverse().join("/");
}

export default async function RollingPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await Promise.all([getRollingRecords(), getRollingOperators()]).catch((error: unknown) => {
    console.error("No se pudieron consultar los registros de laminación y trefilación:", error);
    return null;
  });
  const [records, operators] = data ?? [null, []];
  const timestamp = getWorkshopTimestamp();
  const today = timestamp.slice(0, 10);
  const currentTime = timestamp.slice(11, 16);
  const canEditAssignment = user.role === "admin" || user.role === "supervisor";

  return (
    <>
      <AppNavigation user={user} current="rolling" dateLabel={getWorkshopDateLabel()} databaseConnected={records !== null} />
      <main className={styles.content}>
        <div className={styles.topActions}>
          <Link className={styles.primaryButton} href="/lotes#nuevo-lote">Ir a Lotes</Link>
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
              <div>
                <dt>Entrada</dt>
                <dd>{record.enteredOn
                  ? `${shortDate(record.enteredOn)} ${record.enteredTime ?? "· Hora sin registrar"}`
                  : "Pendiente"}</dd>
              </div>
              <div><dt>Gramaje Inicial</dt><dd>{formatGrams(Number(record.inputWeight ?? record.availableWeight))} g</dd></div>
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
            {record.status === "Pendiente" && !record.enteredOn && (
              <details className={styles.rollingDetailsToggle}>
                <summary>Enviar a proceso</summary>
                <RollingStartForm id={record.id} lotDate={record.lotDate} today={today} currentTime={currentTime} operators={operators} />
              </details>
            )}
            {canEditAssignment && record.enteredOn && (
              <details className={styles.rollingDetailsToggle}>
                <summary>Editar entrada y operario</summary>
                <RollingStartForm
                  key={`${record.enteredOn}:${record.enteredTime}:${record.operatorId}`}
                  id={record.id} lotDate={record.lotDate} today={today} currentTime={currentTime}
                  assignment={{ enteredOn: record.enteredOn, enteredTime: record.enteredTime, operatorId: record.operatorId ?? "" }}
                  operators={record.operatorId && !operators.some((operator) => operator.id === record.operatorId)
                    ? [...operators, { id: record.operatorId, name: record.operator }]
                    : operators}
                />
              </details>
            )}
            {record.status === "En proceso" && record.enteredOn && (
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
