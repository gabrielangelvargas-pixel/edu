export type LotStatus = "En proceso" | "Pendiente" | "Observado" | "Terminado";
export type Priority = "Normal" | "Alta" | "Urgente";

export type LotSummary = {
  id: string;
  code: string;
  model: string;
  modelId: string;
  process: string;
  processId: string;
  operator: string;
  initialWeight: number;
  currentWeight: number;
  progress: number;
  status: LotStatus;
  priority: Priority;
  enteredAt: string;
  dueAt: string;
};

export type ProcessSummary = { id: string; name: string; activeLots: number; accent: string };
export type CatalogOption = { id: string; name: string };

export type DashboardData = {
  source: "demo" | "mysql";
  databaseMessage?: string;
  stats: { activeLots: number; totalWeight: number; completedToday: number; averageYield: number };
  processes: ProcessSummary[];
  lots: LotSummary[];
  models: CatalogOption[];
  operators: CatalogOption[];
};
