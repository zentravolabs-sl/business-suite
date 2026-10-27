import type { Metadata } from "next";
import { AdvisorClient } from "@/components/advisor/advisor-client";

export const metadata: Metadata = {
  title: "AI Business & Financial Advisor | Zentravo Suite",
  description:
    "Evidence-based business intelligence, automated daily evening reports, financial risk detection, inventory health, and actionable profit recommendations.",
};

export const dynamic = "force-dynamic";

export default function BusinessAdvisorPage() {
  return <AdvisorClient />;
}
