"use client";

import { useEffect, useState } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Phone,
  Calendar,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

const STAGES = [
  { key: "RECEIVED", label: "Received" },
  { key: "UNDER_INSPECTION", label: "Inspecting" },
  { key: "REPAIRING", label: "Repairing" },
  { key: "READY", label: "Ready" },
  { key: "COMPLETED", label: "Delivered" },
];

function getStageIndex(status: string) {
  if (status === "RECEIVED") return 0;
  if (status === "UNDER_INSPECTION") return 1;
  if (status === "WAITING_FOR_PARTS" || status === "REPAIRING" || status === "QUALITY_CHECK") return 2;
  if (status === "READY") return 3;
  if (status === "DELIVERED" || status === "COMPLETED") return 4;
  return 0;
}

export default function CustomerServicesPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/portal/data");
        if (res.ok) {
          const json = await res.json();
          setTickets(json.serviceTickets || []);
        }
      } catch (err) {
        console.error("Failed to load service tickets:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wrench className="h-6 w-6 text-amber-600" />
          Repair & Service Center
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track the live diagnostic and repair status of your equipment in our service workshops
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading service tickets...
        </div>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-base font-semibold">No repair tickets on record</p>
          <p className="text-xs text-muted-foreground mt-1">
            When you bring an item in for repair or inspection, you can track its progress here.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {tickets.map((ticket) => {
            const currentStageIdx = getStageIndex(ticket.status);
            const isFinished = ticket.status === "COMPLETED" || ticket.status === "DELIVERED";

            return (
              <Card key={ticket.id} className="shadow-xs overflow-hidden">
                {/* Progress Bar Header */}
                <div className="bg-muted/40 p-4 sm:p-6 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        {ticket.ticketNumber}
                      </span>
                      <Badge variant="outline" className="text-xs uppercase font-bold">
                        {ticket.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Lodged: {new Date(ticket.createdAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}
                    </span>
                  </div>

                  {/* Multi-step timeline */}
                  <div className="relative flex justify-between items-center">
                    {/* Background line */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-border -z-0" />
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-amber-500 transition-all duration-500 -z-0"
                      style={{
                        width: `${(currentStageIdx / (STAGES.length - 1)) * 100}%`,
                      }}
                    />

                    {STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStageIdx;
                      const isCurrent = idx === currentStageIdx;

                      return (
                        <div key={stage.key} className="flex flex-col items-center z-10">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-sm",
                              isCompleted
                                ? "bg-amber-500 text-white"
                                : isCurrent
                                ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                                : "bg-card border-2 border-border text-muted-foreground"
                            )}
                          >
                            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-semibold mt-1.5 hidden sm:block",
                              isCurrent ? "text-amber-600 font-bold" : "text-muted-foreground"
                            )}
                          >
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ticket Details */}
                <CardContent className="p-5 sm:p-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-muted-foreground font-medium">Device & Model:</span>
                      <p className="text-base font-bold text-foreground">
                        {ticket.brand} {ticket.model} ({ticket.itemType})
                      </p>
                      {ticket.serialNumber && (
                        <p className="font-mono text-muted-foreground text-[11px]">
                          Serial Number: {ticket.serialNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="text-muted-foreground font-medium">Reported Problem:</span>
                      <p className="text-foreground bg-muted/40 p-2.5 rounded-lg mt-1">
                        {ticket.reportedIssue}
                      </p>
                    </div>

                    {ticket.diagnosis && (
                      <div>
                        <span className="text-muted-foreground font-medium">Technician Diagnosis:</span>
                        <p className="text-foreground bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg mt-1">
                          {ticket.diagnosis}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Service center & costs */}
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Building2 className="h-4 w-4 text-primary" />
                        Service Workshop Location
                      </div>
                      <p className="text-muted-foreground pl-6">
                        {ticket.branchName || "Main Service Center"}
                      </p>
                      {ticket.branchPhone && (
                        <p className="text-muted-foreground pl-6 flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          {ticket.branchPhone}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border bg-card p-4 flex justify-between items-center">
                      <div>
                        <p className="text-muted-foreground">Estimated Repair Cost</p>
                        <p className="text-lg font-extrabold text-foreground mt-0.5">
                          {ticket.finalCost > 0
                            ? formatCurrency(ticket.finalCost)
                            : ticket.estimatedCost > 0
                            ? formatCurrency(ticket.estimatedCost)
                            : "Under Assessment"}
                        </p>
                      </div>
                      {ticket.estimatedCompletion && (
                        <div className="text-right">
                          <p className="text-muted-foreground">Est. Ready Date</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {new Date(ticket.estimatedCompletion).toLocaleDateString("en-LK", { dateStyle: "medium" })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
