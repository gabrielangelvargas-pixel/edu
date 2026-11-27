export type LotStatus = "En proceso" | "Pendiente" | "Observado" | "Terminado";
export type Priority = "Normal" | "Alta" | "Urgente";

export type LotSummary = {
  id: string;
  code: string;
  process: string;
  processId: string | null;
  operator: string;
  initialWeight: number;
  currentWeight: number;
  progress: number;
  status: LotStatus;
  priority: Priority;
  enteredAt: string;
};

export type ProcessSummary = { id: string; name: string; activeLots: number; accent: string };
export type CatalogOption = { id: string; name: string };

export type DashboardData = {
  source: "mysql" | "error";
  databaseMessage?: string;
  stats: { activeLots: number; totalWeight: number; completedLots: number; averageYield: number };
  processes: ProcessSummary[];
  lots: LotSummary[];
};
