import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Admin Login | Zentravo",
  description: "Restricted administrative access for platform management",
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
