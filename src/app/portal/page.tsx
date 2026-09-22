"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Wrench,
  ShoppingBag,
  Gift,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ExternalLink,
  ChevronRight,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

export default function CustomerPortalDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/portal/data");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load portal data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  const customer = data?.customer;
  const warranties = data?.warranties || [];
  const activeWarranties = warranties.filter((w: any) => w.status === "ACTIVE");
  const serviceTickets = data?.serviceTickets || [];
  const ongoingServices = serviceTickets.filter((t: any) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const sales = data?.sales || [];

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/10 text-white border-white/20 uppercase tracking-widest text-[10px] font-bold">
                {customer?.loyalty?.tier || "SILVER"} MEMBER
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">
              Welcome, {customer?.name || "Valued Customer"}
            </h1>
            <p className="text-sm text-indigo-200/80 mt-1 max-w-xl">
              Track your warranties, monitor repair center progress in real-time, and view receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Loyalty points card */}
            <div className="rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/15 min-w-[140px]">
              <div className="flex items-center gap-1.5 text-xs text-indigo-200">
                <Gift className="h-3.5 w-3.5 text-amber-400" />
                <span>Loyalty Points</span>
              </div>
              <p className="text-2xl font-black text-amber-300 mt-0.5">
                {customer?.loyalty?.points?.toLocaleString() || 0}
              </p>
            </div>

            {/* Store credit card */}
            {customer?.creditBalance > 0 && (
              <div className="rounded-xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/15 min-w-[140px]">
                <div className="flex items-center gap-1.5 text-xs text-indigo-200">
                  <span>Store Balance</span>
                </div>
                <p className="text-2xl font-black text-emerald-300 mt-0.5">
                  {formatCurrency(customer?.creditBalance)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link href="/portal/warranties">
          <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Warranties
                </p>
                <p className="text-2xl font-extrabold mt-1">{activeWarranties.length}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">Fully Covered</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/services">
          <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ongoing Repairs
                </p>
                <p className="text-2xl font-extrabold mt-1">{ongoingServices.length}</p>
                <p className="text-[11px] text-amber-600 font-medium mt-1">In Progress</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Wrench className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/orders">
          <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invoices & Orders
                </p>
                <p className="text-2xl font-extrabold mt-1">{sales.length}</p>
                <p className="text-[11px] text-blue-600 font-medium mt-1">Receipts Available</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Support Merchant
              </p>
              <p className="text-sm font-bold truncate max-w-[120px] mt-1">
                {customer?.merchant?.name || "Zentravo Merchant"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {customer?.merchant?.phone || "Support Available"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Warranties Spotlight */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Active Warranties</h2>
            <p className="text-xs text-muted-foreground">Digital warranty cards issued for your purchases</p>
          </div>
          <Link href="/portal/warranties" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
            View All Warranties
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {activeWarranties.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeWarranties.slice(0, 3).map((w: any) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(w.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <Card key={w.id} className="relative overflow-hidden border-indigo-500/20 bg-gradient-to-br from-card via-card to-indigo-500/5 shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                        ACTIVE
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono font-semibold">
                        {w.warrantyNumber}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold truncate mt-2">
                      {w.productName}
                    </CardTitle>
                    {w.serialNumber && (
                      <CardDescription className="text-xs font-mono">
                        S/N: {w.serialNumber}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs pt-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Valid until:</span>
                      <span className="font-semibold text-foreground">
                        {new Date(w.endDate).toLocaleDateString("en-LK", { dateStyle: "medium" })}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Remaining:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {daysLeft} days
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t">
                    <Link href={`/verify-warranty?num=${w.warrantyNumber}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <QrCode className="h-3.5 w-3.5 mr-1.5 text-primary" />
                        Verify Digital Card
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">No active warranties found on your account.</p>
          </Card>
        )}
      </div>

      {/* Ongoing Service Tickets Tracker */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Active Repair Tickets</h2>
            <p className="text-xs text-muted-foreground">Live status updates from the service center</p>
          </div>
          <Link href="/portal/services" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
            View All Repairs
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {ongoingServices.length > 0 ? (
          <div className="space-y-3">
            {ongoingServices.map((ticket: any) => (
              <Card key={ticket.id} className="p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {ticket.ticketNumber}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {ticket.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="font-bold text-base">
                      {ticket.brand} {ticket.model} — {ticket.itemType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Issue: {ticket.reportedIssue}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Service Center</p>
                      <p className="font-semibold text-foreground">{ticket.branchName}</p>
                    </div>
                    <Link href="/portal/services">
                      <Button size="sm" variant="outline" className="text-xs">
                        View Progress
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">No items currently in the repair center.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
