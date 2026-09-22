import { SubscriptionClient } from "@/components/subscription/subscription-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscription & Billing | Zentravo BMS",
  description: "Manage your SaaS plan, resource limits, and invoices",
};

export const dynamic = "force-dynamic";

export default function SubscriptionPage() {
  return <SubscriptionClient />;
}
