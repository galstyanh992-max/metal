"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

async function calculateBom(productId: string, parameters: Record<string, any>) {
  const res = await fetch("/api/bom", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, parameters }),
  });
  if (!res.ok) throw new Error("BOM calculation failed");
  return res.json();
}

export function BomPreview({ productId, parameters }: { productId: string; parameters: Record<string, any> }) {
  // Only calculate if we have meaningful parameters
  const hasWidthHeight = !!(parameters.width && parameters.height);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bom", productId, parameters],
    queryFn: () => calculateBom(productId, parameters),
    enabled: !!productId && hasWidthHeight,
    staleTime: 5000,
  });

  if (!productId || !hasWidthHeight) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 border border-hairline text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Հաշվարկվում է BOM…
      </div>
    );
  }
  if (error || !data?.components?.length) return null;

  const components = data.components;
  const allSufficient = data.allSufficient;

  return (
    <div className="border border-hairline">
      <div className="flex items-center justify-between p-2.5 bg-muted/30 border-b border-hairline">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
          <Package className="size-3.5 text-steel" />
          BOM — Կոմպոնենտների հաշվարկ
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] uppercase ${allSufficient ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-status-orange/15 text-status-orange border-status-orange/30"}`}
        >
          {allSufficient ? (
            <><CheckCircle2 className="size-3 mr-1" /> Բավարար</>
          ) : (
            <><AlertTriangle className="size-3 mr-1" /> Անբավարար</>
          )}
        </Badge>
      </div>
      <div className="divide-y divide-hairline">
        {components.map((c: any) => (
          <div key={c.componentProductId} className="flex items-center justify-between gap-2 p-2 text-xs">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{c.componentProductName}</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {c.componentProductSku} · {c.formula}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className={`tabular-nums font-medium ${c.sufficient ? "" : "text-status-orange"}`}>
                  {c.finalQty}
                </span>
                <span className="text-[10px] text-muted-foreground">{c.componentUnitSymbol}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Մնացորդ՝ {c.available}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
