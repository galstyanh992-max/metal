"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

async function fetchUnits() {
  const res = await fetch("/api/units");
  if (!res.ok) return { units: [] };
  return res.json();
}

async function fetchCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) return { categories: [] };
  return res.json();
}

async function fetchProduct(id: string) {
  const res = await fetch(`/api/products/${id}/price-history`);
  if (!res.ok) return null;
  return res.json();
}

export function ProductEditDialog({
  mode,
  productId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  productId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: unitsData } = useQuery({ queryKey: ["units"], queryFn: fetchUnits });
  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [salePrice, setSalePrice] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [minStock, setMinStock] = useState("0");

  // Load existing product if edit mode
  useEffect(() => {
    if (mode !== "edit" || !productId) return;
    // We don't have a GET /api/products/[id] for the full product; fetch via price-history
    // which includes the product info
    fetch(`/api/products/${productId}/price-history`)
      .then(r => r.json())
      .then(d => {
        const p = d.history?.[0]?.product;
        if (p) {
          // Need full product — fetch via list
        }
      })
      .catch(() => {});
    // Better: fetch via products list and find
    fetch("/api/products")
      .then(r => r.json())
      .then(d => {
        const p = d.products?.find((x: any) => x.id === productId);
        if (p) {
          setSku(p.sku);
          setName(p.name);
          setUnitId(p.unitId ?? p.unit?.id ?? "");
          setCategoryId(p.categoryId ?? p.category?.id ?? "");
          setColor(p.color ?? "");
          setDescription(p.description ?? "");
          setBarcode(p.barcode ?? "");
          setSalePrice(String(p.salePrice ?? 0));
          setPurchasePrice(String(p.purchasePrice ?? 0));
          setMinStock(String(p.minStock ?? 0));
        }
      })
      .catch(() => {});
  }, [mode, productId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sku, name, unitId,
        categoryId: categoryId || null,
        color: color || null,
        description: description || null,
        barcode: barcode || null,
        salePrice: Number(salePrice) || 0,
        purchasePrice: Number(purchasePrice) || 0,
        minStock: Number(minStock) || 0,
      };
      if (mode === "create") {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
        return res.json();
      } else {
        const res = await fetch(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
        return res.json();
      }
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "Ապրանքը ստեղծված է" : "Ապրանքը թարմացված է");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!sku.trim()) { toast.error("SKU-ն պարտադիր է"); return; }
    if (!name.trim()) { toast.error("Անունը պարտադիր է"); return; }
    if (!unitId) { toast.error("Միավորը պարտադիր է"); return; }
    mutation.mutate();
  };

  const units = unitsData?.units ?? [];
  const categories = categoriesData?.categories ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4 text-primary" />
            {mode === "create" ? "Նոր ապրանք" : "Խմբագրել ապրանքը"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">SKU *</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="QF-EXAMPLE" className="focus-steel font-mono" disabled={mode === "edit"} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անուն *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Օրինակ՝ Կոռոբ 25" className="focus-steel" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Միավոր *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue placeholder="Ընտրեք միավոր" /></SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.symbol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Կատեգորիա</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վաճառքի գին (դր)</Label>
              <Input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="focus-steel tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Գնման գին (դր)</Label>
              <Input type="number" min={0} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="focus-steel tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նվազագույն պաշար</Label>
              <Input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} className="focus-steel tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Գույն</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="սպիտակ / սև / —" className="focus-steel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Բարկոդ</Label>
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="focus-steel font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նկարագրություն</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="focus-steel resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Ստեղծել" : "Պահպանել"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
