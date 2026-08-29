"use client";

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, TrendingUp, Users, Settings2, History, DollarSign, TrendingDown } from "lucide-react";
import { EmptyState } from "@/components/shared/primitives";

async function fetchProductDetail(id: string) {
  const res = await fetch(`/api/inventory/${id}`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchPriceHistory(id: string) {
  const res = await fetch(`/api/products/${id}/price-history`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ProductDetailDrawer({ productId, open, onClose, role }: { productId: string | null; open: boolean; onClose: () => void; role: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: () => fetchProductDetail(productId!),
    enabled: !!productId && open,
  });

  const { data: priceHistoryData } = useQuery({
    queryKey: ["price-history", productId],
    queryFn: () => fetchPriceHistory(productId!),
    enabled: !!productId && open && role !== "WAREHOUSE",
  });

  const product = data?.product;
  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-hairline space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-muted flex items-center justify-center">
                <Package className="size-5 text-muted-foreground" />
              </div>
              <div>
                <SheetTitle className="text-base">{product.name}</SheetTitle>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  {product.sku} · {product.unit?.symbol} · {product.category?.name}
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {role !== "WAREHOUSE" && (
              <>
                <StatCard label="Վաճառքի գին" value={fmt(product.salePrice)} icon={DollarSign} accent="green" />
                <StatCard label="Գնման գին" value={fmt(product.purchasePrice)} icon={DollarSign} />
                <StatCard label="Մարժա" value={`${product.salePrice > 0 ? Math.round(((product.salePrice - product.purchasePrice) / product.salePrice) * 100) : 0}%`} icon={TrendingUp} accent="copper" />
              </>
            )}
            <StatCard label="Նվազագույն պաշար" value={String(product.minStock)} icon={Package} />
            <StatCard label="Մնացորդ" value={String(data?.state?.onHand ?? 0)} icon={Package} />
            <StatCard label="Պահված" value={String(data?.state?.reserved ?? 0)} icon={Package} accent="yellow" />
            <StatCard label="Մատչելի" value={String(data?.state?.available ?? 0)} icon={Package} accent="green" />
          </div>

          {/* Product info */}
          {product.description && (
            <div className="space-y-1">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Նկարագրություն</h4>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          )}

          {product.color && (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Գույն:</span>
              <Badge variant="outline" className="text-[10px]">{product.color}</Badge>
            </div>
          )}

          {/* Inventory state */}
          {data?.state && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                <Package className="size-3.5" /> Գույքագրման վիճակ
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/30 border border-hairline p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Մնացորդ</div>
                  <div className="text-xl font-semibold tabular-nums">{data.state.onHand}</div>
                </div>
                <div className="bg-muted/30 border border-hairline p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Պահված</div>
                  <div className="text-xl font-semibold tabular-nums text-status-yellow">{data.state.reserved}</div>
                </div>
                <div className="bg-muted/30 border border-hairline p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Մատչելի</div>
                  <div className="text-xl font-semibold tabular-nums text-status-green">{data.state.available}</div>
                </div>
              </div>
            </div>
          )}

          {/* Price history */}
          {role !== "WAREHOUSE" && priceHistoryData?.history?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                <TrendingUp className="size-3.5" /> Գների պատմություն ({priceHistoryData.history.length})
              </h4>
              <div className="border border-hairline">
                <Table>
                  <TableHeader>
                    <TableRow className="border-hairline">
                      <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                      <TableHead className="text-xs uppercase text-right">Վաճառք</TableHead>
                      <TableHead className="text-xs uppercase text-right">Գնում</TableHead>
                      <TableHead className="text-xs uppercase text-right">Մարժա</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistoryData.history.slice(0, 5).map((h: any) => {
                      const margin = h.salePrice > 0 ? Math.round(((h.salePrice - h.purchasePrice) / h.salePrice) * 100) : 0;
                      return (
                        <TableRow key={h.id} className="border-hairline">
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(h.effectiveFrom).toLocaleDateString("hy-AM")}
                            {h.effectiveTo && <span className="text-[9px]"> → {new Date(h.effectiveTo).toLocaleDateString("hy-AM")}</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-medium">{fmt(h.salePrice)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{fmt(h.purchasePrice)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            <span className={margin > 30 ? "text-status-green" : margin > 15 ? "text-steel" : "text-status-orange"}>
                              {margin}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Movement history */}
          {data?.movements && data.movements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                <History className="size-3.5" /> Շարժումների պատմություն ({data.movements.length})
              </h4>
              <div className="border border-hairline max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow className="border-hairline">
                      <TableHead className="text-xs uppercase">Տեսակ</TableHead>
                      <TableHead className="text-xs uppercase text-right">Քանակ</TableHead>
                      <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.movements.slice(0, 10).map((m: any) => (
                      <TableRow key={m.id} className="border-hairline">
                        <TableCell className="text-xs">{m.type}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-medium">{m.qty}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString("hy-AM")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: "green" | "yellow" | "copper" }) {
  const color = accent === "green" ? "text-status-green" : accent === "yellow" ? "text-status-yellow" : accent === "copper" ? "text-copper" : "";
  return (
    <div className="bg-muted/30 border border-hairline p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className={`text-sm tabular-nums font-medium mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (!v) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
