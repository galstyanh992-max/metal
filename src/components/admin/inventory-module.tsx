"use client";

import { useQuery } from "@tanstack/react-query";
import { SectionHeader, EmptyState, KpiCard } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, Layers, Boxes } from "lucide-react";
import { useState } from "react";
import { InventoryHistoryDrawer } from "./inventory-history-drawer";

async function fetchInventory() {
  const res = await fetch("/api/inventory");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function InventoryModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = data?.inventory ?? [];
  const totalOnHand = items.reduce((s: number, p: any) => s + p.state.onHand, 0);
  const totalReserved = items.reduce((s: number, p: any) => s + p.state.reserved, 0);
  const totalAvailable = items.reduce((s: number, p: any) => s + p.state.available, 0);
  const lowStockCount = items.filter((p: any) => p.state.available < p.minStock).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Պահեստ" description="Գույքագրում և շարժումներ" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր մնացորդ" value={String(totalOnHand)} icon={Boxes} />
        <KpiCard label="Պահված" value={String(totalReserved)} icon={Layers} />
        <KpiCard label="Մատչելի" value={String(totalAvailable)} icon={Package} />
        <KpiCard label="Ցածր մնացորդ" value={String(lowStockCount)} icon={AlertTriangle} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase tracking-wider">Ապրանք</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">SKU</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Մնացորդ</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Պահված</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Մատչելի</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Նվազագույն</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Կարգավիճակ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p: any) => {
                const isLow = p.state.available < p.minStock;
                const isCritical = p.state.available === 0;
                return (
                  <TableRow key={p.id} className="border-hairline hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedId(p.id)}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.state.onHand}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.state.reserved}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${isCritical ? "text-status-red" : isLow ? "text-status-orange" : ""}`}>
                      {p.state.available}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.minStock}</TableCell>
                    <TableCell>
                      {isCritical ? <Badge variant="destructive" className="text-[10px] uppercase">Քննադատական</Badge>
                        : isLow ? <Badge className="text-[10px] uppercase bg-status-orange/15 text-status-orange border-status-orange/30">Ցածր</Badge>
                        : <Badge variant="outline" className="text-[10px] uppercase bg-status-green/10 text-status-green border-status-green/30">Նորմա</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={7}><EmptyState title="Պահեստի տվյալներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InventoryHistoryDrawer productId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
