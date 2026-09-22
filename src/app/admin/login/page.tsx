"use client";

import { useActionState, useState } from "react";
import { adminLoginAction } from "./actions";
import {
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Lock,
  Mail,
  Globe,
  Server,
  Users,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminLoginPage() {
  const [state, action, isPending] = useActionState(adminLoginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-red-950 via-red-900 to-rose-800">
        {/* Animated rings */}
        <div className="absolute inset-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-red-400/10"
              style={{
                width: `${(i + 1) * 160}px`,
                height: `${(i + 1) * 160}px`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15),transparent_70%)]" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/20 backdrop-blur-sm border border-red-400/30 shadow-lg">
              <ShieldAlert className="h-6 w-6 text-red-300" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Zentravo Admin</p>
              <p className="text-xs text-red-300/70 tracking-widest uppercase">
                Root Control Panel
              </p>
            </div>
          </div>

          {/* Center content */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300 mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                Restricted Access
              </div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
                Super Admin
                <br />
                Control Center
              </h1>
              <p className="mt-3 text-lg text-red-200/60">
                Platform management, tenant oversight, and system configuration.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Managed Businesses", value: "1,200+", icon: Globe },
                { label: "Platform Users", value: "28,000+", icon: Users },
                { label: "Uptime SLA", value: "99.98%", icon: Activity },
                { label: "DB Region", value: "AP-SE-1", icon: Server },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl bg-red-500/10 backdrop-blur-sm border border-red-400/15 p-4"
                >
                  <Icon className="h-4 w-4 text-red-300/60 mb-1.5" />
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-red-200/50">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-red-200/30">
            © 2026 Zentravo. Authorized personnel only. All access is logged.
          </p>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/30">
              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-lg font-bold">Zentravo Admin</p>
          </div>

          {/* Header */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500 mb-3">
              <Lock className="h-3 w-3" />
              Super Admin Access Only
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Administrator Sign In
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your admin credentials to access the control panel.
            </p>
          </div>

          {/* Error */}
          {state?.error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.error}
            </div>
          )}

          {/* Form */}
          <form action={action} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="admin@zentravo.com"
                  className={cn(
                    "w-full rounded-xl border bg-background pl-10 pr-4 py-2.5 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50",
                    "placeholder:text-muted-foreground transition-all"
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className={cn(
                    "w-full rounded-xl border bg-background pl-10 pr-10 py-2.5 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50",
                    "placeholder:text-muted-foreground transition-all"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                "w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white",
                "transition-all hover:bg-red-700 active:scale-[0.99]",
                "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg shadow-red-600/20"
              )}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Sign in to Admin Panel
                </span>
              )}
            </button>
          </form>

          {/* Back link */}
          <div className="border-t pt-5 text-center">
            <a
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Business Login
            </a>
          </div>

          {/* Security notice */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-semibold text-foreground/70">
                  Security Notice
                </p>
                <p>
                  This is a restricted administrative interface. All login
                  attempts are logged. Unauthorized access is prohibited.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
