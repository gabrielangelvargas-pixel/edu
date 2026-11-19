import type { DashboardData } from "@/types/domain";

export const demoDashboard: DashboardData = {
  source: "demo",
  stats: { activeLots: 12, totalWeight: 1842.6, completedToday: 3, averageYield: 96.8 },
  processes: [
    { id: "1", name: "Fundición", activeLots: 2, accent: "#3f8067" },
    { id: "2", name: "Laminación", activeLots: 4, accent: "#6c8e79" },
    { id: "3", name: "Trefilado", activeLots: 3, accent: "#aa8a4e" },
    { id: "4", name: "Armado", activeLots: 2, accent: "#7e789d" },
    { id: "5", name: "Acabado", activeLots: 1, accent: "#587b97" },
  ],
  models: [
    { id: "1", name: "Forzada 45" }, { id: "2", name: "Rolo 60" }, { id: "3", name: "Cartier 80" },
  ],
  operators: [
    { id: "1", name: "Carlos Méndez" }, { id: "2", name: "Lucía Torres" }, { id: "3", name: "Miguel Ríos" },
  ],
  lots: [
    { id: "1", code: "LT-0264", model: "Forzada 45", modelId: "1", process: "Laminación", processId: "2", operator: "Lucía Torres", initialWeight: 215.4, currentWeight: 211.8, progress: 38, status: "En proceso", priority: "Alta", enteredAt: "2026-11-18T09:20:00-03:00", dueAt: "2026-11-21" },
    { id: "2", code: "LT-0263", model: "Rolo 60", modelId: "2", process: "Trefilado", processId: "3", operator: "Carlos Méndez", initialWeight: 186.2, currentWeight: 181.9, progress: 57, status: "En proceso", priority: "Normal", enteredAt: "2026-11-17T14:10:00-03:00", dueAt: "2026-11-22" },
    { id: "3", code: "LT-0262", model: "Cartier 80", modelId: "3", process: "Fundición", processId: "1", operator: "Miguel Ríos", initialWeight: 302.8, currentWeight: 302.8, progress: 12, status: "Observado", priority: "Urgente", enteredAt: "2026-11-17T08:45:00-03:00", dueAt: "2026-11-20" },
    { id: "4", code: "LT-0261", model: "Forzada 45", modelId: "1", process: "Armado", processId: "4", operator: "Lucía Torres", initialWeight: 148.5, currentWeight: 141.7, progress: 76, status: "En proceso", priority: "Normal", enteredAt: "2026-11-16T11:30:00-03:00", dueAt: "2026-11-19" },
  ],
};
