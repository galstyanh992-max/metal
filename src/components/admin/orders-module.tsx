"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart, Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

async function fetchOrders() {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Սևագիր",
  CONFIRMED: "Հաստատված",
  PICKING: "Ընտրման մեջ",
  READY: "Պատրաստ",
  DELIVERED: "Հանձնված",
  CANCELLED: "Չեղարկված",
};

export function OrdersModule({ role }: { role: string }) {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Պատվերներ"
        description="Բոլոր պատվերների ցանկ"
        action={
          role !== "WAREHOUSE" && (
            <Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Նոր պատվեր
            </Button>
          )
        }
      />

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase tracking-wider">Համար</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Հաճախորդ</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Կարգավիճակ</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-right">Քանակ</TableHead>
                {role !== "WAREHOUSE" && <TableHead className="text-xs uppercase tracking-wider text-right">Գումար</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Շահույթ</TableHead>}
                <TableHead className="text-xs uppercase tracking-wider">Ամսաթիվ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.orders?.map((o: any) => (
                <TableRow key={o.id} className="border-hairline hover:bg-muted/40 cursor-pointer">
                  <TableCell className="text-xs font-mono">{o.number}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {o.client?.type === "COMPANY" ? o.client?.companyName : `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{STATUS_LABELS[o.status] ?? o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.items?.length ?? 0}</TableCell>
                  {role !== "WAREHOUSE" && (
                    <TableCell className="text-right tabular-nums font-medium">
                      {role === "OPERATOR" ? fmt(o.totalAmount) : fmt(o.totalAmount)}
                    </TableCell>
                  )}
                  {role === "ADMIN" && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(o.grossProfit)}</TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("hy-AM")}
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.orders || data.orders.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={role === "ADMIN" ? 7 : 6} className="text-center py-12">
                    <EmptyState title="Պատվերներ չկան" description="Ստեղծեք նոր պատվեր՝ սկսելու համար" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && <CreateOrderDialog onClose={() => setCreateOpen(false)} onCreated={() => { refetch(); setCreateOpen(false); }} />}
    </div>
  );
}

function CreateOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<Array<{ productId: string; qty: number; width?: number; height?: number; color?: string }>>([
    { productId: "", qty: 1, width: 1000, height: 1500, color: "սպիտակ" },
  ]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "failed");
      }
      return res.json();
    },
    onSuccess: () => { toast.success("Պատվերը ստեղծված է"); onCreated(); },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!clientId) { toast.error("Ընտրեք հաճախորդ"); return; }
    if (items.some((i) => !i.productId)) { toast.error("Ընտրեք բոլոր ապրանքները"); return; }
    mutation.mutate({
      clientId,
      items: items.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        parameters: { width: String(i.width), height: String(i.height), color: i.color ?? "" },
      })),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Նոր պատվեր</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հաճախորդ</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Ընտրեք հաճախորդ" /></SelectTrigger>
              <SelectContent>
                {clientsData?.clients?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ապրանքներ</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-3 border border-hairline">
                <div className="col-span-12 md:col-span-4">
                  <Select value={it.productId} onValueChange={(v) => updateItem(idx, "productId", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Ապրանք" /></SelectTrigger>
                    <SelectContent>
                      {productsData?.products?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input type="number" placeholder="Լայնություն" value={it.width} onChange={(e) => updateItem(idx, "width", Number(e.target.value))} className="h-9" />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input type="number" placeholder="Բարձրություն" value={it.height} onChange={(e) => updateItem(idx, "height", Number(e.target.value))} className="h-9" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <Input type="number" placeholder="Քանակ" value={it.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} className="h-9" />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <Input placeholder="Գույն" value={it.color} onChange={(e) => updateItem(idx, "color", e.target.value)} className="h-9" />
                </div>
                <div className="col-span-12 md:col-span-1 flex items-center justify-end">
                  <Button variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-destructive">×</Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { productId: "", qty: 1, width: 1000, height: 1500, color: "սպիտակ" }])} className="gap-2">
              <Plus className="size-3.5" /> Ավելացնել ապրանք
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Ստեղծել պատվեր
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function updateItem(idx: number, field: string, value: any) {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
}

function fmt(v: number | undefined): string {
  if (!v) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
