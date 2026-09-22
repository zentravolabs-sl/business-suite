import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zentravo BMS — Business Management System",
    template: "%s | Zentravo BMS",
  },
  description:
    "All-in-one business management platform for Sri Lankan retail businesses. POS, Inventory, Accounting, Warranty, Service & more.",
  keywords: [
    "business management",
    "POS",
    "inventory",
    "accounting",
    "warranty",
    "Sri Lanka",
    "retail",
  ],
  authors: [{ name: "Zentravo" }],
  creator: "Zentravo",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_LK",
    title: "Zentravo BMS",
    description: "All-in-one Business Management for Sri Lankan Retail",
    siteName: "Zentravo BMS",
  },
  robots: {
    index: false, // Private SaaS app
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
