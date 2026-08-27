"use client";

import { cn } from "@/lib/utils";

/**
 * Responsive table wrapper — horizontal scroll on mobile, normal on desktop.
 * Adds a subtle scroll indicator on mobile.
 */
export function ResponsiveTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0", className)}>
      <div className="min-w-[600px]">
        {children}
      </div>
    </div>
  );
}

/**
 * Mobile stat grid — 2 columns on mobile, 4 on desktop.
 */
export function MobileStatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
      {children}
    </div>
  );
}

/**
 * Mobile-friendly KPI card — smaller on mobile.
 */
export function MobileKpi({ label, value, sub, icon: Icon, accent }: {
  label: string;
  value: string;
  sub?: string;
  icon?: any;
  accent?: "green" | "red" | "yellow" | "copper";
}) {
  const colorClass = accent === "green" ? "text-status-green"
    : accent === "red" ? "text-status-red"
    : accent === "yellow" ? "text-status-yellow"
    : accent === "copper" ? "text-copper"
    : "";
  return (
    <div className="bg-card border border-hairline p-3 lg:p-4 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</div>
        {Icon && <Icon className="size-3.5 lg:size-4 text-muted-foreground/60 shrink-0" />}
      </div>
      <div className={`text-base lg:text-2xl font-semibold tracking-tight tabular-nums ${colorClass}`}>{value}</div>
      {sub && <div className="text-[10px] lg:text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}
