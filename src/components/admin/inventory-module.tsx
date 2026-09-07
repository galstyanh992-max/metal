"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState, KpiCard } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package, AlertTriangle, Layers, Boxes, Plus, Minus, Sliders, Loader2,
  ArrowRightLeft, Building2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { InventoryHistoryDrawer } from "./inventory-history-drawer";
import { TransferDialog } from "./transfer-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

async function fetchInventory() {
  const res = await fetch("/api/inventory");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchBranches() {
  const res = await fetch("/api/branches");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function InventoryModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const { data: branchesData } = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const qc = useQueryClient();

  const items = data?.inventory ?? [];
  const branches = branchesData?.branches ?? [];
  const isAdmin = role === "ADMIN";

  // Apply branch filter
  const filteredItems = useMemo(() => {
    if (!filterBranchId || filterBranchId === "all") return items;
    // Show items that have stock in this branch
    return items.map((p: any) => {
      const branchState = p.byBranch?.find((b: any) => b.branchId === filterBranchId);
      if (!branchState) return null;
      return {
        ...p,
        state: {
          onHand: branchState.onHand,
          reserved: branchState.reserved,
          available: branchState.available,
        },
      };
    }).filter(Boolean);
  }, [items, filterBranchId]);

  const totalOnHand = filteredItems.reduce((s: number, p: any) => s + p.state.onHand, 0);
  const totalReserved = filteredItems.reduce((s: number, p: any) => s + p.state.reserved, 0);
  const totalAvailable = filteredItems.reduce((s: number, p: any) => s + p.state.available, 0);
  const lowStockCount = filteredItems.filter((p: any) => p.state.available < p.minStock).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Պահեստ"
        description={isAdmin ? "Գույքագրում և շարժումներ · 4 ֆիլիալներով" : "Գույքագրում (միայն դիտում)"}
        action={
          <div className="flex items-center gap-2">
            <Select value={filterBranchId} onValueChange={setFilterBranchId}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder="Բոլոր ֆիլիալները" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Բոլոր ֆիլիալները</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setTransferOpen(true)}
              >
                <ArrowRightLeft className="size-4 text-primary" />
                Տեղափոխել
              </Button>
            )}
          </div>
        }
      />

      {/* Branches overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {branches.map((b: any) => {
          let branchOnHand = 0;
          let branchAvailable = 0;
          items.forEach((p: any) => {
            const bs = p.byBranch?.find((x: any) => x.branchId === b.id);
            if (bs) {
              branchOnHand += bs.onHand;
              branchAvailable += bs.available;
            }
          });
          return (
            <Card key={b.id} className="border-hairline shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="size-4 text-primary" />
                  <div className="text-sm font-semibold truncate">{b.name}</div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Մնացորդ՝ <strong className="text-foreground tabular-nums">{branchOnHand}</strong> հատ</div>
                  <div>Մատչելի՝ <strong className="text-foreground tabular-nums">{branchAvailable}</strong> հատ</div>
                </div>
                {b.phone && <div className="text-[10px] text-muted-foreground mt-1">{b.phone}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* KPIs */}
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
                {branches.map((b: any) => (
                  <TableHead key={b.id} className="text-xs uppercase tracking-wider text-right" title={b.name}>
                    {b.code === "main" ? "Գլխ." : `Ֆ${b.sortOrder + 1}`}
                  </TableHead>
                ))}
                <TableHead className="text-xs uppercase tracking-wider text-right">Մնացորդ</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Մատչելի</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Նվազագ.</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Կարգ.</TableHead>
                {isAdmin && <TableHead className="text-xs uppercase tracking-wider text-right">Գործ.</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((p: any) => {
                const isLow = p.state.available < p.minStock;
                const isCritical = p.state.available === 0;
                return (
                  <TableRow key={p.id} className="border-hairline hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedId(p.id)}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.sku}</TableCell>
                    {branches.map((b: any) => {
                      const bs = p.byBranch?.find((x: any) => x.branchId === b.id);
                      const onHand = bs?.onHand ?? 0;
                      return (
                        <TableCell key={b.id} className="text-right tabular-nums text-xs">
                          {onHand > 0 ? (
                            <span className={onHand < (p.minStock / branches.length) ? "text-status-orange" : ""}>{onHand}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right tabular-nums">{p.state.onHand}</TableCell>
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
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-status-green"
                            onClick={() => setAdjustProduct({ product: p, mode: "RECEIVE" })}>
                            <Plus className="size-3.5" /> Ընդունել
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-status-red"
                            onClick={() => setAdjustProduct({ product: p, mode: "WRITE_OFF" })}>
                            <Minus className="size-3.5" /> Գրել
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={isAdmin ? 7 + branches.length : 6 + branches.length}><EmptyState title="Պահեստի տվյալներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isAdmin && (
        <div className="p-3 border border-hairline bg-muted/20 text-xs text-muted-foreground">
          ℹ️ Միայն Ադմինիստրատորը կարող է ընդունել, գրել ավելորդ կամ տեղափոխել պահեստի մնացորդները։
        </div>
      )}

      <InventoryHistoryDrawer productId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />

      {adjustProduct && (
        <InventoryAdjustDialog
          product={adjustProduct.product}
          mode={adjustProduct.mode}
          branches={branches}
          onClose={() => setAdjustProduct(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["inventory"] });
            setAdjustProduct(null);
          }}
        />
      )}

      {transferOpen && (
        <TransferDialog
          branches={branches}
          inventory={items}
          onClose={() => setTransferOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["inventory"] });
            setTransferOpen(false);
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
  product, mode, branches, onClose, onSaved,
}: {
  product: any;
  mode: "RECEIVE" | "WRITE_OFF" | "ADJUSTMENT";
  branches: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [note, setNote] = useState("");
  const meta = MODE_LABELS[mode];
  const Icon = meta.icon;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/${product.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: mode, qty: Number(qty), branchId, note }),
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
    if (!branchId) {
      toast.error("Ընտրեք ֆիլիալը");
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ֆիլիալ *</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Ընտրեք ֆիլիալը" /></SelectTrigger>
              <SelectContent>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">{meta.description}</p>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Քանակ {mode === "ADJUSTMENT" && "(+ կամ −)"}
            </Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0"
              className="focus-steel tabular-nums text-lg" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նշում (ոչ պարտադիր)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Պատճառը..." className="focus-steel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending}
            className={`gap-2 ${mode === "WRITE_OFF" ? "bg-status-red hover:bg-status-red/90" : "bg-primary"}`}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Հաստատել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
