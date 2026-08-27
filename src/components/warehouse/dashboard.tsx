"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { formatArmenianDateLong } from "@/lib/i18n/date";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, Boxes, Layers, Scan, CheckCircle2 } from "lucide-react";

async function fetchData() {
  const [inv, orders] = await Promise.all([
    fetch("/api/inventory").then((r) => r.json()),
    fetch("/api/orders").then((r) => r.json()),
  ]);
  return { inventory: inv.inventory ?? [], orders: (orders.orders ?? []).filter((o: any) => o.status === "CONFIRMED") };
}

export function WarehouseDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["wh-dashboard"], queryFn: fetchData });

  const items = data?.inventory ?? [];
  const picks = data?.orders ?? [];
  const totalOnHand = items.reduce((s: number, p: any) => s + p.state.onHand, 0);
  const totalReserved = items.reduce((s: number, p: any) => s + p.state.reserved, 0);
  const lowStockCount = items.filter((p: any) => p.state.available < p.minStock).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Պահեստի վահանակ"
        description={formatArmenianDateLong(new Date())}
        action={<Button size="sm" variant="outline" className="gap-2"><Scan className="size-4" /> Սկանավորել</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Սպասում են ընտրման" value={String(picks.length)} icon={Package} />
        <KpiCard label="Ընդհանուր մնացորդ" value={String(totalOnHand)} icon={Boxes} />
        <KpiCard label="Պահված" value={String(totalReserved)} icon={Layers} />
        <KpiCard label="Ցածր մնացորդ" value={String(lowStockCount)} icon={AlertTriangle} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <div className="p-4 border-b border-hairline text-sm font-semibold flex items-center gap-2">
            <Package className="size-4" />
            Սպասում են ընտրման
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Պատվեր</TableHead>
                <TableHead className="text-xs uppercase">Ապրանքներ</TableHead>
                <TableHead className="text-xs uppercase text-right">Քանակ</TableHead>
                <TableHead className="text-xs uppercase text-right">Գործողություն</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {picks.map((o: any) => (
                <TableRow key={o.id} className="border-hairline">
                  <TableCell className="text-xs font-mono">{o.number}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-0.5">
                      {o.items?.slice(0, 3).map((it: any) => (
                        <span key={it.id} className="text-xs">{it.productName} × {it.qty}</span>
                      ))}
                      {(o.items?.length ?? 0) > 3 && <span className="text-[10px] text-muted-foreground">+{o.items.length - 3} ավել</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.items?.length ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                      <CheckCircle2 className="size-3.5" /> Ընտրել
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {picks.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={4}><EmptyState title="Սպասող պատվերներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-hairline shadow-none bg-muted/20">
        <CardContent className="p-3 text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="size-3.5 text-copper" />
          Պահեստապետը չի տեսնում գներ, զեղչեր, շահույթ կամ հաճախորդի ֆինանսական տվյալները։
        </CardContent>
      </Card>
    </div>
  );
}
