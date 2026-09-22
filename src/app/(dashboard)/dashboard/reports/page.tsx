import { ReportsClient } from "@/components/reports/reports-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports & Analytics | Zentravo BMS",
  description: "Executive reports, revenue analytics, branch performance, and inventory health",
};

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return <ReportsClient />;
}
