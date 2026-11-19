import { Dashboard } from "@/components/dashboard";
import { demoDashboard } from "@/lib/demo-data";

export default function Home() {
  return <Dashboard initialData={demoDashboard} />;
}
