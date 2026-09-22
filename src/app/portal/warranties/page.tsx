"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  QrCode,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function CustomerWarrantiesPage() {
  const [warranties, setWarranties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/portal/data");
        if (res.ok) {
          const json = await res.json();
          setWarranties(json.warranties || []);
        }
      } catch (err) {
        console.error("Failed to fetch warranties:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = warranties.filter((w) =>
    w.productName.toLowerCase().includes(search.toLowerCase()) ||
    w.warrantyNumber.toLowerCase().includes(search.toLowerCase()) ||
    (w.serialNumber && w.serialNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-600" />
            My Digital Warranties
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View coverage status, validity periods, and digital proof of warranty for your products
          </p>
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading warranty records...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-base font-semibold">No warranties found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Warranties will appear here automatically when you make eligible purchases.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => {
            const isActive = w.status === "ACTIVE";
            const daysLeft = Math.max(0, Math.ceil((new Date(w.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

            return (
              <Card
                key={w.id}
                className={cn(
                  "overflow-hidden transition-all hover:shadow-md",
                  isActive ? "border-indigo-500/30" : "border-border/60 opacity-80"
                )}
              >
                <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600" />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {w.status}
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {w.warrantyNumber}
                    </span>
                  </div>

                  <CardTitle className="text-lg font-bold mt-2 truncate">
                    {w.productName}
                  </CardTitle>
                  {w.serialNumber && (
                    <CardDescription className="font-mono text-xs">
                      S/N: {w.serialNumber}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Coverage Type:</span>
                    <span className="font-medium text-foreground">{w.type || "Comprehensive"}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Valid From:</span>
                    <span className="font-medium text-foreground">
                      {new Date(w.startDate).toLocaleDateString("en-LK", { dateStyle: "medium" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Expires On:</span>
                    <span className="font-semibold text-foreground">
                      {new Date(w.endDate).toLocaleDateString("en-LK", { dateStyle: "medium" })}
                    </span>
                  </div>

                  {isActive && (
                    <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2.5 text-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {daysLeft} days of warranty remaining
                    </div>
                  )}

                  {/* Claims record */}
                  {w.claims && w.claims.length > 0 && (
                    <div className="pt-2 border-t space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">Recent Claims:</span>
                      {w.claims.map((claim: any) => (
                        <div key={claim.id} className="flex justify-between text-[11px] bg-muted/40 p-1.5 rounded">
                          <span className="truncate max-w-[160px]">{claim.issueDescription}</span>
                          <Badge variant="secondary" className="text-[9px]">{claim.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 border-t">
                  <Link href={`/verify-warranty?num=${w.warrantyNumber}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <QrCode className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      Verify QR & Digital Card
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
