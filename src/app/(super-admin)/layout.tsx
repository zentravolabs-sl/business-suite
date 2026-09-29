import { requireAdminSession } from "@/lib/admin-auth";
import { logoutAdminAction } from "./actions";
import SuperAdminLayoutClient from "./layout-client";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminSession();

  return (
    <SuperAdminLayoutClient
      admin={admin}
      logoutAction={logoutAdminAction}
    >
      {children}
    </SuperAdminLayoutClient>
  );
}
