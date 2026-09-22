"use server";

import { signInAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export async function adminLoginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const result = await signInAdmin(email, password);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/super-admin");
}
