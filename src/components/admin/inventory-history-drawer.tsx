"use client";

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/primitives";
import { TrendingUp, TrendingDown, Lock, Undo2, AlertTriangle, Scale, Package } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  RECEIVE: "Ստացում",
  RESERVE: "Պահում",
  RELEASE_RESERVATION: "Պահումի վերացում",
  ISSUE: "Թողարկում",
  RETURN: "Վերադարձ",
  WRITE_OFF: "Գրանցում",
  ADJUSTMENT: "Ճշգրտում",
};

const TYPE_COLORS: Record<string, string> = {
  RECEIVE: "bg-status-green/15 text-status-green border-status-green/30",
  RESERVE: "bg-status-yellow/15 text-status-yellow border-status-yellow/30",
  RELEASE_RESERVATION: "bg-muted text-muted-foreground",
  ISSUE: "bg-status-orange/15 text-status-orange border-status-orange/30",
  RETURN: "bg-status-green/15 text-status-green border-status-green/30",
  WRITE_OFF: "bg-status-red/15 text-status-red border-status-red/30",
  ADJUSTMENT: "bg-copper/15 text-copper border-copper/30",
};

const TYPE_ICONS: Record<string, any> = {
  RECEIVE: TrendingUp,
  RESERVE: Lock,
  RELEASE_RESERVATION: Undo2,
  ISSUE: TrendingDown,
  RETURN: Undo2,
  WRITE_OFF: AlertTriangle,
  ADJUSTMENT: Scale,
};

async function fetchMovements(productId: string) {
  const res = await fetch(`/api/inventory/${productId}`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function InventoryHistoryDrawer({ productId, open, onClose }: { productId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory", productId],
    queryFn: () => fetchMovements(productId!),
    enabled: !!productId && open,
  });

  const product = data?.product;
  const movements = data?.movements ?? [];
  const state = data?.state;

  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-hairline space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-base">{product.name}</SheetTitle>
              <div className="text-xs text-muted-foreground font-mono">{product.sku} · {product.unit?.symbol}</div>
            </div>
            {product.category && <Badge variant="outline" className="text-[10px]">{product.category.name}</Badge>}
          </div>
          {state && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="bg-muted/30 border border-hairline p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Մնացորդ</div>
                <div className="text-lg font-semibold tabular-nums">{state.onHand}</div>
              </div>
              <div className="bg-muted/30 border border-hairline p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Պահված</div>
                <div className="text-lg font-semibold tabular-nums text-status-yellow">{state.reserved}</div>
              </div>
              <div className="bg-muted/30 border border-hairline p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Մատչելի</div>
                <div className="text-lg font-semibold tabular-nums text-status-green">{state.available}</div>
              </div>
            </div>
          )}
        </SheetHeader>

        <div className="p-4 space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
            <Package className="size-3.5" /> Շարժումների պատմություն ({movements.length})
          </h4>
          {movements.length > 0 ? (
            <div className="border border-hairline max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-hairline">
                    <TableHead className="text-xs uppercase">Տեսակ</TableHead>
                    <TableHead className="text-xs uppercase text-right">Քանակ</TableHead>
                    <TableHead className="text-xs uppercase">Աղբյուր</TableHead>
                    <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m: any) => {
                    const Icon = TYPE_ICONS[m.type] ?? Package;
                    const isPositive = ["RECEIVE", "RETURN", "RESERVE", "RELEASE_RESERVATION"].includes(m.type) ? (m.type === "RESERVE" ? false : true) : false;
                    return (
                      <TableRow key={m.id} className="border-hairline">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`size-6 flex items-center justify-center border ${TYPE_COLORS[m.type] ?? "bg-muted"}`}>
                              <Icon className="size-3" />
                            </div>
                            <span className="text-xs">{TYPE_LABELS[m.type] ?? m.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${isPositive ? "text-status-green" : "text-status-orange"}`}>
                          {isPositive ? "+" : "−"}{m.qty}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.refType === "ORDER" ? `Պատվեր` : m.refType === "PURCHASE_ORDER" ? `PO` : m.refType === "SEED" ? "Սկզբնական" : m.refType ?? "—"}
                          {m.note && <div className="text-[10px]">{m.note}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString("hy-AM")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="Շարժումներ չկան" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
