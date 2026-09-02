"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, Save, Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) return { categories: [] };
  return res.json();
}

type ComponentRow = {
  id: string;
  productId: string;
  name: string;
  qty: number;        // Քանակ
  unitPrice: number;  // Գումար (per unit)
  // calculated: lineTotal = qty * unitPrice (Տոկոս)
};

/**
 * ProductCostCalculator — table for restocking / BOM price calculation.
 *
 * Layout matches user's reference screenshot:
 * - Top parameters: Գործարան (factory), Լայնություն (W), Երկարություն (H), Տեսակ (type)
 * - Table columns: Շտեմարան | Քանակ | Գումար | Տոկոս (line total) | Որոշում (running total)
 * - Footer: Շարժականության ընդհանուր (grand total)
 * - Buttons: Ավելացնել (add row) | Պահպանել շարժականը (save price to product)
 */
export function ProductCostCalculator({
  productId,
  onClose,
  onSaved,
}: {
  productId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  // Form state
  const [factory, setFactory] = useState("ArmRoll — +374 55 25 55 99");
  const [width, setWidth] = useState("3,18");
  const [height, setHeight] = useState("2,50");
  const [productType, setProductType] = useState("Մանրաթել 7016");
  const [components, setComponents] = useState<ComponentRow[]>([]);

  // Load existing product info
  const currentProduct = productsData?.products?.find((p: any) => p.id === productId);

  useEffect(() => {
    if (currentProduct) {
      setProductType(currentProduct.category?.name ?? currentProduct.name ?? "");
    }
  }, [currentProduct]);

  // Compute totals
  const totals = useMemo(() => {
    let grandTotal = 0;
    const rows = components.map((c) => {
      const lineTotal = c.qty * c.unitPrice; // Տոկոս = քանակ × գումար
      grandTotal += lineTotal;
      return { ...c, lineTotal, runningTotal: grandTotal };
    });
    return { rows, grandTotal };
  }, [components]);

  const addRow = () => {
    setComponents([
      ...components,
      {
        id: `row-${Date.now()}`,
        productId: "",
        name: "",
        qty: 1,
        unitPrice: 0,
      },
    ]);
  };

  const updateRow = (id: string, patch: Partial<ComponentRow>) => {
    setComponents(components.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeRow = (id: string) => {
    setComponents(components.filter((c) => c.id !== id));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save the calculated price to the product
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          salePrice: Math.round(totals.grandTotal),
          reason: `BOM հաշվարկ (${width}×${height}, ${productType})`,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Գինը պահպանված է՝ ${Math.round(totals.grandTotal).toLocaleString("hy-AM")} դր`);
      qc.invalidateQueries({ queryKey: ["products"] });
      onSaved?.();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const fmt = (n: number) => new Intl.NumberFormat("hy-AM").format(Math.round(n || 0));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-hairline bg-card shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4 text-primary" />
            Գնի հաշվարկ — {currentProduct?.name ?? ""}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Կազմեք ապրանքի ինքնարժեքը բաղադրիչների հիման վրա։ Արդյունքը կպահպանվի որպես վաճառքի գին։
          </p>
        </DialogHeader>

        {/* Parameters section */}
        <div className="px-5 py-3 border-b border-hairline bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Գործարանը</Label>
            <Input value={factory} onChange={(e) => setFactory(e.target.value)} className="h-8 text-xs focus-steel" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Լայնությունը (W)</Label>
            <Input value={width} onChange={(e) => setWidth(e.target.value)} className="h-8 text-xs tabular-nums focus-steel" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Երկարությունը (H)</Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} className="h-8 text-xs tabular-nums focus-steel" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Տեսակ</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categoriesData?.categories ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
                <SelectItem value="Մանրաթել 7016">Մանրաթել 7016</SelectItem>
                <SelectItem value="Մանրաթել 5050">Մանրաթել 5050</SelectItem>
                <SelectItem value="Ալյումինե 50">Ալյումինե 50</SelectItem>
                <SelectItem value="Ալյումինե 80">Ալյումինե 80</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <div className="min-w-[760px]">
            {/* Header */}
            <div className="grid grid-cols-[40px_minmax(220px,1fr)_90px_110px_120px_120px_40px] gap-0 border-b border-hairline bg-muted/30 sticky top-0 z-10">
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-center">#</div>
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Շտեմարան</div>
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Քանակ</div>
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Գումար (դր)</div>
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Տոկոս (դր)</div>
              <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Որոշում (դր)</div>
              <div className="px-2 py-2"></div>
            </div>

            {/* Rows */}
            {components.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                Ավելացրեք բաղադրիչներ՝ «+ Ավելացնել» կոճակով
              </div>
            )}
            {totals.rows.map((row, idx) => (
              <div
                key={row.id}
                className="grid grid-cols-[40px_minmax(220px,1fr)_90px_110px_120px_120px_40px] gap-0 border-b border-hairline hover:bg-muted/20 transition-colors"
              >
                <div className="px-2 py-2 border-r border-hairline flex items-center justify-center text-xs text-muted-foreground tabular-nums">
                  {idx + 1}
                </div>
                {/* Շտեմարան — product select */}
                <div className="px-2 py-1.5 border-r border-hairline">
                  <Select
                    value={row.productId}
                    onValueChange={(v) => {
                      const p = productsData?.products?.find((x: any) => x.id === v);
                      updateRow(row.id, { productId: v, name: p?.name ?? "", unitPrice: p?.salePrice ?? 0 });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Ընտրեք ապրանք" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-auto">
                      {(productsData?.products ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} <span className="text-muted-foreground">({p.sku})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Քանակ */}
                <div className="px-1.5 py-1.5 border-r border-hairline">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.qty || ""}
                    onChange={(e) => updateRow(row.id, { qty: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-7 text-xs text-right tabular-nums px-1.5 focus-steel"
                  />
                </div>
                {/* Գումար (unit price) */}
                <div className="px-1.5 py-1.5 border-r border-hairline">
                  <Input
                    type="number"
                    min={0}
                    value={row.unitPrice || ""}
                    onChange={(e) => updateRow(row.id, { unitPrice: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-7 text-xs text-right tabular-nums px-1.5 focus-steel"
                  />
                </div>
                {/* Տոկոս (line total = qty * unit price) */}
                <div className="px-2 py-2 border-r border-hairline text-right text-xs tabular-nums font-medium">
                  {fmt(row.lineTotal)}
                </div>
                {/* Որոշում (running total) */}
                <div className="px-2 py-2 border-r border-hairline text-right text-xs tabular-nums text-primary font-medium">
                  {fmt(row.runningTotal)}
                </div>
                {/* Delete */}
                <div className="px-1 py-1.5 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add row button */}
        <div className="px-5 py-2 border-t border-hairline bg-muted/20 shrink-0">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-2 text-xs">
            <Plus className="size-3.5" /> Ավելացնել բաղադրիչ
          </Button>
        </div>

        {/* Footer with totals */}
        <DialogFooter className="px-5 py-3 border-t-2 border-primary/30 bg-primary/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Շարժականության ընդհանուր՝</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {fmt(totals.grandTotal)} դր
              </span>
            </div>
            {components.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-hairline">
                {components.length} բաղադրիչ
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || components.length === 0 || totals.grandTotal === 0}
              className="bg-primary gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Պահպանել շարժականը
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
