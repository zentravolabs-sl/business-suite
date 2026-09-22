"use server";
import { signOutAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export async function logoutAdminAction() {
  await signOutAdmin();
  redirect("/admin/login");
}
