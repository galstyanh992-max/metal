"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Loader2, Package, Calculator, Star, FolderTree, FileSpreadsheet } from "lucide-react";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductDetailDrawer } from "./product-detail-drawer";
import { ProductEditDialog } from "./product-edit-dialog";
import { ProductCostCalculator } from "./product-cost-calculator";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ModuleFooter, MODULE_FOOTERS } from "@/components/shared/module-footer";
import { exportToExcel } from "@/lib/export/excel";
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
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const setDeleteId = (_id: null) => setDeleteIds([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  const products = data?.products ?? [];
  const categories = useMemo(
    () => Array.from(new Map(products.filter((p: any) => p.category?.id).map((p: any) => [p.category.id, p.category])).values()) as any[],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product: any) => {
      if (categoryId !== "all" && product.categoryId !== categoryId) return false;
      if (!query) return true;
      return [product.name, product.sku, product.barcode, product.color]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query));
    });
  }, [products, categoryId, search]);

  const exportExcel = () => {
    setExporting(true);
    try {
      exportToExcel(
        `ապրանքներ-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Ապրանքներ",
        filteredProducts,
        [
          { header: "Անուն", width: 32, get: (p: any) => p.name },
          { header: "SKU", width: 16, get: (p: any) => p.sku },
          { header: "Կատեգորիա", width: 20, get: (p: any) => p.category?.name ?? "" },
          { header: "Միավոր", width: 10, get: (p: any) => p.unit?.symbol ?? "" },
          { header: "Գույն", width: 16, get: (p: any) => p.color ?? "" },
          { header: "Վաճառքի գին (դր)", width: 16, get: (p: any) => p.salePrice ?? 0 },
          { header: "Գնման գին (դր)", width: 16, get: (p: any) => p.purchasePrice ?? 0 },
          { header: "Մնացորդ", width: 12, get: (p: any) => p.stock?.available ?? 0 },
          { header: "Նվազագույն", width: 12, get: (p: any) => p.minStock ?? 0 },
        ],
      );
    } finally {
      setExporting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return Promise.all(ids.map(async (id) => {
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error ?? "failed");
        }
        return res.json();
      }));
    },
    onSuccess: (result) => {
      const data = result[0];
      toast.success(data.hard ? "Ապրանքը ջնջված է" : "Ապրանքը արխիվացված է");
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleteIds([]);
      setSelectedIds([]);
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

  const selectedProductIds = new Set(selectedIds);
  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p: any) => selectedProductIds.has(p.id));
  const productsToDelete = products.filter((p: any) => deleteIds.includes(p.id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredProducts.map((p: any) => p.id) : []);
  const toggleProduct = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ապրանքներ"
        description="Ապրանքների կատալոգ, գներ և կարգավորումներ"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Որոնել անունով կամ SKU-ով…"
                className="h-8 w-52 pl-8 text-xs"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Կատեգորիա" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Բոլոր կատեգորիաները</SelectItem>
                {categories.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(search || categoryId !== "all") && (
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setSearch(""); setCategoryId("all"); }} title="Մաքրել ֆիլտրերը">
                <X className="size-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={exportExcel}
              disabled={exporting || products.length === 0}
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4 text-status-green" />}
              Excel
            </Button>
            {role === "ADMIN" && (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setDeleteIds(selectedIds)}
                  disabled={selectedIds.length === 0}
                >
                  <Trash2 className="size-4" /> Ջնջել ընտրվածը ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setCategoryManagerOpen(true)}
                >
                  <FolderTree className="size-4" />
                  Կատեգորիաներ
                </Button>
                <Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> Ապրանք
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                {role === "ADMIN" && (
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      aria-label="Ընտրել բոլոր ապրանքները"
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                    />
                  </TableHead>
                )}
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
              {filteredProducts.map((p: any) => (
                <TableRow key={p.id} className="border-hairline hover:bg-muted/40 cursor-pointer" onClick={() => setDetailId(p.id)}>
                  {role === "ADMIN" && (
                    <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Ընտրել ${p.name}`}
                        checked={selectedProductIds.has(p.id)}
                        onCheckedChange={(checked) => toggleProduct(p.id, checked === true)}
                      />
                    </TableCell>
                  )}
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
                          onClick={() => setDeleteIds([p.id])}
                          title="Ջնջել"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredProducts.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={role === "ADMIN" ? 9 : 6}><EmptyState title="Ապրանքներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product detail drawer */}
      <ProductDetailDrawer productId={detailId} open={!!detailId} onClose={() => setDetailId(null)} role={role} />

      {/* Category manager (ADMIN only) */}
      {role === "ADMIN" && categoryManagerOpen && (
        <CategoryManagerDialog onClose={() => setCategoryManagerOpen(false)} />
      )}

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
      <Dialog open={deleteIds.length > 0} onOpenChange={(o) => !o && setDeleteIds([])}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-red">
              <Trash2 className="size-4" /> Ջնջել ապրանքը
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm space-y-2">
            <p>Դուք պատրաստվում եք ջնջել՝</p>
            <div className="p-3 border border-hairline bg-muted/30">
              <div className="font-medium">
                {productsToDelete.length === 1
                  ? productsToDelete[0]?.name
                  : `Ընտրված ապրանքներ՝ ${productsToDelete.length}`}
              </div>
              {productsToDelete.length === 1 && (
                <div className="text-xs text-muted-foreground font-mono">{productsToDelete[0]?.sku}</div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Եթե ապրանքը երբևէ օգտագործվել է պատվերներում կամ պահեստում, այն կարխիվացվի (կդառնա պասիվ)։ Հակառակ դեպքում այն կջնջվի վերջնականապես։
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Չեղարկել</Button>
            <Button
              variant="destructive"
              onClick={() => deleteIds.length > 0 && deleteMutation.mutate(deleteIds)}
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
