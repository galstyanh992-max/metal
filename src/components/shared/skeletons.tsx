"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton loader — animated placeholder for loading states.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-muted/50 rounded-sm", className)} />
  );
}

/**
 * KPI skeleton — mimics the KpiCard shape.
 */
export function KpiSkeleton() {
  return (
    <div className="bg-card border border-hairline p-3 lg:p-5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/**
 * Table skeleton — mimics a table row layout.
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      <div className="flex gap-2 p-3 border-b border-hairline">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2 p-3 border-b border-hairline">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Chart skeleton — mimics a chart area.
 */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}
