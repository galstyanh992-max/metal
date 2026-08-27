"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus, Loader2, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchPOs() {
  const res = await fetch("/api/procurement");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchSuppliers() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Սևագիր",
  REQUESTED: "Հարցում",
  ORDERED: "Պատվիրված",
  IN_TRANSIT: "Տարանցման մեջ",
  PARTIALLY_RECEIVED: "Մասամբ ստացված",
  RECEIVED: "Ստացված",
  CLOSED: "Փակված",
  CANCELLED: "Չեղարկված",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ORDERED: "bg-status-yellow/15 text-status-yellow border-status-yellow/30",
  IN_TRANSIT: "bg-status-orange/15 text-status-orange border-status-orange/30",
  RECEIVED: "bg-status-green/15 text-status-green border-status-green/30",
  CLOSED: "bg-muted text-muted-foreground",
};

export function ProcurementModule() {
  const { data, isLoading } = useQuery({ queryKey: ["procurement"], queryFn: fetchPOs });
  const [createOpen, setCreateOpen] = useState(false);

  const pos = data?.purchaseOrders ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Մատակարարում"
        description="Գնման պատվերներ և մատակարարներ"
        action={<Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Նոր PO</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր PO" value={String(pos.length)} icon={Truck} />
        <KpiCard label="Պատվիրված" value={String(pos.filter((p: any) => p.status === "ORDERED").length)} icon={Package} />
        <KpiCard label="Տարանցման մեջ" value={String(pos.filter((p: any) => p.status === "IN_TRANSIT").length)} icon={Truck} />
        <KpiCard label="Ստացված" value={String(pos.filter((p: any) => p.status === "RECEIVED").length)} icon={Package} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Համար</TableHead>
                <TableHead className="text-xs uppercase">Մատակարար</TableHead>
                <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
                <TableHead className="text-xs uppercase text-right">Գումար</TableHead>
                <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.map((p: any) => (
                <TableRow key={p.id} className="border-hairline hover:bg-muted/40">
                  <TableCell className="text-xs font-mono">{p.number}</TableCell>
                  <TableCell className="text-sm font-medium">{p.supplier?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_COLORS[p.status] ?? ""}`}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.totalAmount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("hy-AM")}</TableCell>
                </TableRow>
              ))}
              {pos.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={5}><EmptyState title="Գնման պատվերներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && <CreatePODialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreatePODialog({ onClose }: { onClose: () => void }) {
  const { data: prodData } = useQuery({ queryKey: ["products"], queryFn: fetchSuppliers });
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<Array<{ productId: string; qty: number; unitPrice: number }>>([{ productId: "", qty: 1, unitPrice: 0 }]);

  // Get unique suppliers from products' suppliers — simplified
  const products = prodData?.products ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/procurement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => { toast.success("Գնման պատվերը ստեղծված է"); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!supplierId) { toast.error("Ընտրեք մատակարար"); return; }
    if (items.some((i) => !i.productId || i.qty <= 0)) { toast.error("Ստուգեք ապրանքները"); return; }
    mutation.mutate({ supplierId, items });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Նոր գնման պատվեր</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Մատակարար ID</Label>
            <Input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="sup-1" className="focus-steel font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ապրանքներ</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-3 border border-hairline">
                <div className="col-span-12 md:col-span-6">
                  <Select value={it.productId} onValueChange={(v) => updateItem(idx, "productId", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Ապրանք" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input type="number" placeholder="Քանակ" value={it.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} className="h-9 tabular-nums" />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <Input type="number" placeholder="Միավոր գին" value={it.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} className="h-9 tabular-nums" />
                </div>
                <div className="col-span-2 md:col-span-1 flex items-center justify-end">
                  <Button variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-destructive">×</Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { productId: "", qty: 1, unitPrice: 0 }])} className="gap-2">
              <Plus className="size-3.5" /> Ավելացնել
            </Button>
          </div>
          <div className="text-sm font-medium p-3 bg-muted/30 border border-hairline">
            Ընդհանուր՝ {fmt(items.reduce((s, i) => s + i.qty * i.unitPrice, 0))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Ստեղծել PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function updateItem(idx: number, field: string, value: any) {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
}

function fmt(v: number): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
