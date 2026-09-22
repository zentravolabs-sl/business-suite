import { BusinessesClient } from "@/components/super-admin/businesses-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tenants & Businesses | Super Admin",
  description: "Manage tenant businesses, subscriptions, and operational statuses",
};

export const dynamic = "force-dynamic";

export default function SuperAdminBusinessesPage() {
  return <BusinessesClient />;
}
