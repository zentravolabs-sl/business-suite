"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema, type LoginInput } from "@/schemas/auth";
import { Eye, EyeOff, Globe, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"email" | "otp">("email");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 right-0 h-px bg-white/30" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/10"
              style={{
                width: `${(i + 1) * 120}px`,
                height: `${(i + 1) * 120}px`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold">Zentravo BMS</p>
              <p className="text-xs text-white/60 tracking-widest uppercase">
                Business Suite
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold leading-tight">
                All-in-one Business
                <br />
                Management Platform
              </h1>
              <p className="mt-3 text-lg text-white/70">
                POS · Inventory · Accounting · Warranty · Service & more
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Active Businesses", value: "1,200+" },
                { label: "Transactions/day", value: "50,000+" },
                { label: "Products Tracked", value: "2M+" },
                { label: "Warranties Issued", value: "180,000+" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white/10 backdrop-blur-sm p-4"
                >
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/40">
            © 2026 Zentravo. Built for Sri Lankan businesses.
          </p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <p className="text-lg font-bold">Zentravo BMS</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your business account
            </p>
          </div>

          {/* Mode switcher */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode("email")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-all",
                mode === "email"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              )}
            >
              Email & Password
            </button>
            <button
              onClick={() => setMode("otp")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-all",
                mode === "otp"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              )}
            >
              Mobile OTP
            </button>
          </div>

          {mode === "email" ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="owner@business.com"
                  {...register("email")}
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-2.5 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    "placeholder:text-muted-foreground",
                    errors.email && "border-destructive ring-destructive/20"
                  )}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password")}
                    className={cn(
                      "w-full rounded-lg border bg-background px-3 py-2.5 pr-10 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-ring",
                      "placeholder:text-muted-foreground",
                      errors.password && "border-destructive ring-destructive/20"
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
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground",
                  "transition-all hover:bg-primary/90 active:scale-[0.99]",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          ) : (
            <OtpLoginForm />
          )}

          <div className="border-t pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have a business account?{" "}
              <a href="/onboarding" className="text-primary font-medium hover:underline">
                Register your business
              </a>
            </p>
          </div>

          {/* Demo credentials */}
          <div className="rounded-lg bg-muted/50 p-3.5 text-xs text-muted-foreground">
            <p className="font-medium mb-1.5">Demo credentials</p>
            <div className="space-y-1">
              <p>Owner: <code className="bg-background px-1 rounded">owner@example.com</code> / <code className="bg-background px-1 rounded">Demo@2026</code></p>
              <p>Cashier: <code className="bg-background px-1 rounded">cashier@example.com</code> / <code className="bg-background px-1 rounded">Demo@2026</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OtpLoginForm() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);

  async function sendOtp() {
    setIsLoading(true);
    // TODO: Call OTP API
    await new Promise((r) => setTimeout(r, 1000));
    setStep("otp");
    setIsLoading(false);
  }

  async function verifyOtp() {
    setIsLoading(true);
    // TODO: Call verify API
    await new Promise((r) => setTimeout(r, 1000));
    setIsLoading(false);
  }

  return (
    <div className="space-y-5">
      {step === "phone" ? (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mobile Number</label>
            <div className="flex gap-2">
              <div className="flex h-10 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
                🇱🇰 +94
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="77 123 4567"
                className="flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <button
            onClick={sendOtp}
            disabled={isLoading || phone.length < 9}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send OTP"}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Enter OTP</label>
            <p className="text-xs text-muted-foreground">
              Sent to +94 {phone}
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={verifyOtp}
            disabled={isLoading || otp.length !== 6}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Verifying..." : "Verify & Sign In"}
          </button>
          <button
            onClick={() => setStep("phone")}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            ← Change number
          </button>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
