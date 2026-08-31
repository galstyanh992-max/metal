"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState, KpiCard } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, AlertTriangle, Layers, Boxes, Plus, Minus, Sliders, Loader2 } from "lucide-react";
import { useState } from "react";
import { InventoryHistoryDrawer } from "./inventory-history-drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

async function fetchInventory() {
  const res = await fetch("/api/inventory");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function InventoryModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const qc = useQueryClient();

  const items = data?.inventory ?? [];
  const totalOnHand = items.reduce((s: number, p: any) => s + p.state.onHand, 0);
  const totalReserved = items.reduce((s: number, p: any) => s + p.state.reserved, 0);
  const totalAvailable = items.reduce((s: number, p: any) => s + p.state.available, 0);
  const lowStockCount = items.filter((p: any) => p.state.available < p.minStock).length;

  const isAdmin = role === "ADMIN";

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Պահեստ"
        description={isAdmin ? "Գույքագրում և շարժումներ (Ադմինիստրատոր)" : "Գույքագրում (միայն դիտում)"}
        action={isAdmin ? (
          <div className="text-xs text-muted-foreground">
            Խմբագրման իրավունք՝ <Badge variant="outline" className="text-[10px] ml-1 bg-copper/15 text-copper border-copper/30">ԱԴՄԻՆ</Badge>
          </div>
        ) : null}
      />

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
                {isAdmin && <TableHead className="text-xs uppercase tracking-wider text-right">Գործողություն</TableHead>}
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
                      {isCritical ? <Badge variant="destructive" className="text-[10px] uppercase">Սպառված</Badge>
                        : isLow ? <Badge className="text-[10px] uppercase bg-status-orange/15 text-status-orange border-status-orange/30">Ցածր</Badge>
                        : <Badge variant="outline" className="text-[10px] uppercase bg-status-green/10 text-status-green border-status-green/30">Նորմա</Badge>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-status-green"
                            onClick={() => setAdjustProduct({ product: p, mode: "RECEIVE" })}
                            title="Ընդունել պահեստ"
                          >
                            <Plus className="size-3.5" /> Ընդունել
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-status-red"
                            onClick={() => setAdjustProduct({ product: p, mode: "WRITE_OFF" })}
                            title="Գրել ավելորդ"
                          >
                            <Minus className="size-3.5" /> Գրել
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setAdjustProduct({ product: p, mode: "ADJUSTMENT" })}
                            title="Կարգավորել"
                          >
                            <Sliders className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {items.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={isAdmin ? 8 : 7}><EmptyState title="Պահեստի տվյալներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isAdmin && (
        <div className="p-3 border border-hairline bg-muted/20 text-xs text-muted-foreground">
          ℹ️ Միայն Ադմինիստրատորը կարող է ընդունել, գրել ավելորդ կամ կարգավորել պահեստի մնացորդները։
        </div>
      )}

      <InventoryHistoryDrawer productId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />

      {adjustProduct && (
        <InventoryAdjustDialog
          product={adjustProduct.product}
          mode={adjustProduct.mode}
          onClose={() => setAdjustProduct(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["inventory"] });
            setAdjustProduct(null);
          }}
        />
      )}
    </div>
  );
}

const MODE_LABELS: Record<string, { title: string; description: string; icon: any; color: string }> = {
  RECEIVE: {
    title: "Ընդունել պահեստ",
    description: "Ավելացնել նոր քանակ պահեստում (գնում, վերադարձ)",
    icon: Plus,
    color: "text-status-green",
  },
  WRITE_OFF: {
    title: "Գրել ավելորդ",
    description: "Հանել քանակ պահեստից (վնաս, կորուստ, սպառում)",
    icon: Minus,
    color: "text-status-red",
  },
  ADJUSTMENT: {
    title: "Կարգավորել մնացորդ",
    description: "Ուղղել մնացորդը (դրական կամ բացասական ճշգրտում)",
    icon: Sliders,
    color: "text-primary",
  },
};

function InventoryAdjustDialog({
  product,
  mode,
  onClose,
  onSaved,
}: {
  product: any;
  mode: "RECEIVE" | "WRITE_OFF" | "ADJUSTMENT";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const meta = MODE_LABELS[mode];
  const Icon = meta.icon;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/${product.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: mode, qty: Number(qty), note }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`${meta.title} — կատարված է`);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    const n = Number(qty);
    if (!n || (mode !== "ADJUSTMENT" && n <= 0)) {
      toast.error("Քանակը պետք է լինի դրական թիվ");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${meta.color}`}>
            <Icon className="size-4" />
            {meta.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-3 border border-hairline bg-muted/30">
            <div className="text-sm font-medium">{product.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{product.sku}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Ընթացիկ մնացորդ՝ <span className="font-medium text-foreground">{product.state?.onHand ?? 0}</span> հատ
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{meta.description}</p>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Քանակ {mode === "ADJUSTMENT" && "(+ կամ −)"}
            </Label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="focus-steel tabular-nums text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նշում (ոչ պարտադիր)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Պատճառը..." className="focus-steel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending}
            className={`gap-2 ${mode === "WRITE_OFF" ? "bg-status-red hover:bg-status-red/90" : "bg-primary"}`}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Հաստատել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
