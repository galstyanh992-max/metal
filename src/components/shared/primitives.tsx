"use client";

import { cn } from "@/lib/utils";
import { formatAMD } from "@/lib/finance/money";

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    GREEN: "status-green",
    YELLOW: "status-yellow",
    ORANGE: "status-orange",
    RED: "status-red",
    CRITICAL: "status-critical",
  };
  const labels: Record<string, string> = {
    GREEN: "Առողջ",
    YELLOW: "Պարտք",
    ORANGE: "Մոտ ժամկետին",
    RED: "Ժամկետանց",
    CRITICAL: "Սպառված",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", map[status] ?? "bg-muted text-muted-foreground")}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {labels[status] ?? status}
    </span>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn("num tabular-nums", className)}>{formatAMD(value)}</span>;
}

export function KpiCard({ label, value, sub, trend, icon: Icon, accent }: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  icon?: any;
  accent?: "green" | "red" | "yellow" | "copper";
}) {
  const colorClass = accent === "green" ? "text-status-green"
    : accent === "red" ? "text-status-red"
    : accent === "yellow" ? "text-status-yellow"
    : accent === "copper" ? "text-copper"
    : "";
  return (
    <div className="bg-card border border-hairline p-3 lg:p-5 space-y-1.5 lg:space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        {Icon && <Icon className="size-3.5 lg:size-4 text-muted-foreground/60 shrink-0" />}
      </div>
      <div className={`text-lg lg:text-2xl font-semibold tracking-tight tabular-nums ${colorClass}`}>{value}</div>
      {sub && <div className="text-[10px] lg:text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-hairline p-8 lg:p-12 text-center space-y-3">
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="text-xs text-muted-foreground max-w-sm mx-auto">{description}</div>}
      {action}
    </div>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
