"use client";

import { useQuery } from "@tanstack/react-query";
import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ProductDetailDrawer } from "./product-detail-drawer";

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ProductsModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ապրանքներ"
        description="Կատալոգ և պաշարներ"
        action={role === "ADMIN" && <Button size="sm" className="gap-2 bg-primary"><Plus className="size-4" /> Ապրանք</Button>}
      />

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase tracking-wider">Ապրանք</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">SKU</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Կատեգորիա</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Միավոր</TableHead>
                {role !== "WAREHOUSE" && <TableHead className="text-xs uppercase tracking-wider text-right">Վաճառքի գին</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Գնման գին</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Նվազագույն</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.products?.map((p: any) => (
                <TableRow key={p.id} className="border-hairline hover:bg-muted/40 cursor-pointer" onClick={() => setDetailId(p.id)}>
                  <TableCell className="text-sm font-medium">
                    <div className="flex flex-col">
                      <span>{p.name}</span>
                      {p.color && <span className="text-xs text-muted-foreground">{p.color}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{p.sku}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{p.category?.name ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.unit?.symbol ?? "—"}</TableCell>
                  {role !== "WAREHOUSE" && <TableCell className="text-right tabular-nums font-medium">{fmt(p.salePrice)}</TableCell>}
                  {role === "ADMIN" && <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(p.purchasePrice)}</TableCell>}
                  {role === "ADMIN" && <TableCell className="text-right tabular-nums text-muted-foreground">{p.minStock}</TableCell>}
                </TableRow>
              ))}
              {(!data?.products || data.products.length === 0) && !isLoading && (
                <TableRow><TableCell colSpan={role === "ADMIN" ? 7 : 5}><EmptyState title="Ապրանքներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product detail drawer */}
      <ProductDetailDrawer productId={detailId} open={!!detailId} onClose={() => setDetailId(null)} role={role} />
    </div>
  );
}

function fmt(v: number): string {
  if (!v) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
