"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, Package, Calculator, Star } from "lucide-react";
import { useState } from "react";
import { ProductDetailDrawer } from "./product-detail-drawer";
import { ProductEditDialog } from "./product-edit-dialog";
import { ProductCostCalculator } from "./product-cost-calculator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ModuleFooter, MODULE_FOOTERS } from "@/components/shared/module-footer";
import { toast } from "sonner";

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchUnits() {
  const res = await fetch("/api/forms/entity/PRODUCT");
  if (!res.ok) return null;
  return res.json();
}

export function ProductsModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [calcId, setCalcId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const products = data?.products ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.hard ? "Ապրանքը ջնջված է" : "Ապրանքը արխիվացված է");
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const favMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/products/${id}/favorite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.isFavorite ? "⭐ Նշված է որպես հիմնական" : "Հանված է հիմնականներից");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const productToDelete = products.find((p: any) => p.id === deleteId);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ապրանքներ"
        description="Կատալոգ և պաշարներ"
        action={role === "ADMIN" && (
          <Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Ապրանք
          </Button>
        )}
      />

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase tracking-wider w-8">★</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Ապրանք</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">SKU</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Կատեգորիա</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Միավոր</TableHead>
                {role !== "WAREHOUSE" && <TableHead className="text-xs uppercase tracking-wider text-right">Վաճառքի գին</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Գնման գին</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Նվազագույն</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Գործողություն</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => (
                <TableRow key={p.id} className="border-hairline hover:bg-muted/40 cursor-pointer" onClick={() => setDetailId(p.id)}>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {role === "ADMIN" ? (
                      <button
                        onClick={() => favMutation.mutate({ id: p.id, isFavorite: !p.isFavorite })}
                        className="text-base leading-none hover:scale-125 transition-transform"
                        title={p.isFavorite ? "Հանել հիմնականներից" : "Նշել որպես հիմնական"}
                      >
                        {p.isFavorite ? "⭐" : "☆"}
                      </button>
                    ) : (
                      p.isFavorite ? "⭐" : ""
                    )}
                  </TableCell>
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
                  {role === "ADMIN" && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setCalcId(p.id)}
                          title="Կազմել գին (BOM հաշվարկ)"
                        >
                          <Calculator className="size-3.5 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditId(p.id)}
                          title="Խմբագրել"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(p.id)}
                          title="Ջնջել"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(!data?.products || data.products.length === 0) && !isLoading && (
                <TableRow><TableCell colSpan={role === "ADMIN" ? 9 : 6}><EmptyState title="Ապրանքներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product detail drawer */}
      <ProductDetailDrawer productId={detailId} open={!!detailId} onClose={() => setDetailId(null)} role={role} />

      {/* Create / Edit dialog */}
      {role === "ADMIN" && createOpen && (
        <ProductEditDialog
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); setCreateOpen(false); }}
        />
      )}
      {role === "ADMIN" && editId && (
        <ProductEditDialog
          mode="edit"
          productId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); setEditId(null); }}
        />
      )}
      {role === "ADMIN" && calcId && (
        <ProductCostCalculator
          productId={calcId}
          onClose={() => setCalcId(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-red">
              <Trash2 className="size-4" /> Ջնջել ապրանքը
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm space-y-2">
            <p>Դուք պատրաստվում եք ջնջել՝</p>
            <div className="p-3 border border-hairline bg-muted/30">
              <div className="font-medium">{productToDelete?.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{productToDelete?.sku}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Եթե ապրանքը երբևէ օգտագործվել է պատվերներում կամ պահեստում, այն կարխիվացվի (կդառնա պասիվ)։ Հակառակ դեպքում այն կջնջվի վերջնականապես։
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Չեղարկել</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Ջնջել
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModuleFooter {...MODULE_FOOTERS.products} />
    </div>
  );
}

function fmt(v: number): string {
  if (!v) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
