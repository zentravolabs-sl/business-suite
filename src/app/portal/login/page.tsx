"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Smartphone, ArrowRight, CheckCircle2, Lock, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CustomerPortalLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError("Please enter a valid mobile phone number");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setDemoNotice(data.message);
      setOtp(data.devOtp || "123456");
      setStep("OTP");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError("Please enter the 6-digit OTP code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      localStorage.setItem("zentravo_customer_id", data.customer.id);
      localStorage.setItem("zentravo_customer_name", data.customer.name);
      router.push("/portal");
    } catch (err: any) {
      setError(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-2">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Customer Portal</h1>
          <p className="text-sm text-indigo-200/70">
            Access your digital warranty cards, live repair tracker, and loyalty rewards
          </p>
        </div>

        {/* Card Form */}
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-white">
              {step === "PHONE" ? "Enter Mobile Number" : "Verify OTP Code"}
            </CardTitle>
            <CardDescription className="text-indigo-200/60 text-xs">
              {step === "PHONE"
                ? "We'll send a 6-digit verification code to your phone"
                : `Enter the 6-digit code sent to ${phone}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            {demoNotice && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{demoNotice}</span>
              </div>
            )}

            {step === "PHONE" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-indigo-200">Mobile Phone</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-indigo-300/50" />
                    <Input
                      type="tel"
                      placeholder="077 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-indigo-200/50">Sri Lankan mobile numbers (e.g. 077, 071, 076, 070)</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold h-10"
                >
                  {loading ? "Sending Code..." : "Continue with OTP"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-indigo-200">Verification Code</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-indigo-300/50" />
                    <Input
                      type="text"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="pl-9 tracking-widest text-center text-lg font-mono bg-white/5 border-white/10 text-white h-11"
                      maxLength={6}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold h-10"
                >
                  {loading ? "Verifying..." : "Verify & Access Portal"}
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setStep("PHONE")}
                    className="text-xs text-indigo-300/70 hover:text-white underline transition-colors"
                  >
                    Change phone number
                  </button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="border-t border-white/5 pt-4 text-center justify-center text-xs text-indigo-200/40">
            Powered by Zentravo Retail Cloud
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
