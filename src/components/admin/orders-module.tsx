"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart, Loader2, Search, Trash2, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { OrderDetailDrawer } from "./order-detail-drawer";
import { DynamicFormRenderer } from "@/components/forms/dynamic-form-renderer";
import { BomPreview } from "@/components/forms/bom-preview";
import { QuickFillPanel, quickFillRowsToOrderItems, type QuickFillRow, type QuickFillTotals } from "./quick-fill-panel";

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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-status-yellow/15 text-status-yellow border-status-yellow/30",
  PICKING: "bg-status-orange/15 text-status-orange border-status-orange/30",
  READY: "bg-status-green/15 text-status-green border-status-green/30",
  DELIVERED: "bg-status-green/15 text-status-green border-status-green/30",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

export function OrdersModule({ role }: { role: string }) {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const [createOpen, setCreateOpen] = useState(false);
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const orders = (data?.orders ?? []).filter((o: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.number?.toLowerCase().includes(q) ||
      o.client?.companyName?.toLowerCase().includes(q) ||
      o.client?.firstName?.toLowerCase().includes(q) ||
      o.client?.lastName?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Պատվերներ</h2>
          <span className="text-sm text-muted-foreground tabular-nums">{orders.length}</span>
        </div>
        {role !== "WAREHOUSE" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setQuickFillOpen(true)}>
              <Zap className="size-4 text-primary" /> Արագ լցոնում
            </Button>
            <Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Նոր
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Որոնում՝ համար, հաճախորդ…"
            className="pl-9 focus-steel"
          />
        </div>
      </div>

      {/* Excel-like table */}
      <div className="border border-hairline overflow-x-auto bg-card">
        {/* Headers */}
        <div className="grid grid-cols-[120px_minmax(180px,1fr)_110px_70px_120px_120px_100px] gap-0 border-b border-hairline bg-muted/30">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Համար</div>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հաճախորդ</div>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Կարգավիճակ</div>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Քանակ</div>
          {role !== "WAREHOUSE" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Գումար</div>}
          {role === "ADMIN" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Շահույթ</div>}
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ամսաթիվ</div>
        </div>

        {/* Rows */}
        {orders.map((o: any, idx: number) => (
          <div
            key={o.id}
            className={`grid grid-cols-[120px_minmax(180px,1fr)_110px_70px_120px_120px_100px] gap-0 border-b border-hairline hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
            onClick={() => setSelectedId(o.id)}
          >
            <div className="px-3 py-2.5 border-r border-hairline text-xs font-mono flex items-center">{o.number}</div>
            <div className="px-3 py-2.5 border-r border-hairline text-sm font-medium flex items-center min-w-0">
              <span className="truncate">{o.client?.type === "COMPANY" ? o.client?.companyName : `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}`}</span>
            </div>
            <div className="px-3 py-2.5 border-r border-hairline flex items-center">
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}>
                {STATUS_LABELS[o.status] ?? o.status}
              </span>
            </div>
            <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm flex items-center justify-end">{o.items?.length ?? 0}</div>
            {role !== "WAREHOUSE" && (
              <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm font-medium flex items-center justify-end">{fmt(o.totalAmount)}</div>
            )}
            {role === "ADMIN" && (
              <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm text-status-green flex items-center justify-end">{fmt(o.grossProfit)}</div>
            )}
            <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-center">{new Date(o.createdAt).toLocaleDateString("hy-AM")}</div>
          </div>
        ))}

        {/* Empty */}
        {orders.length === 0 && !isLoading && (
          <div className="px-3 py-12 text-center text-sm text-muted-foreground">
            {search ? "Որոնման արդյունքներ չկան" : "Պատվերներ չկան"}
          </div>
        )}
      </div>

      {createOpen && <CreateOrderDialog onClose={() => setCreateOpen(false)} onCreated={() => { refetch(); setCreateOpen(false); }} />}
      {quickFillOpen && <QuickFillOrderDialog onClose={() => setQuickFillOpen(false)} onCreated={() => { refetch(); setQuickFillOpen(false); }} />}
      <OrderDetailDrawer orderId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} role={role} />
    </div>
  );
}

export function CreateOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: templateData } = useQuery({
    queryKey: ["form-template", "ORDER_ITEM"],
    queryFn: async () => {
      const res = await fetch("/api/forms/entity/ORDER_ITEM");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<Array<{ productId: string; parameters: Record<string, any> }>>([
    { productId: "", parameters: { quantity: 1, width: 1000, height: 1500, color: "սպիտակ" } },
  ]);

  const template = templateData?.template;

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
        qty: Number(i.parameters.quantity) || 1,
        parameters: Object.fromEntries(
          Object.entries(i.parameters).map(([k, v]) => [k, String(v)])
        ),
      })),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <div key={idx} className="p-3 border border-hairline space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={it.productId} onValueChange={(v) => updateItem(idx, "productId", v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Ապրանք" /></SelectTrigger>
                      <SelectContent>
                        {productsData?.products?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-destructive h-9">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <DynamicFormRenderer
                  template={template}
                  values={it.parameters}
                  onChange={(key, value) => updateParam(idx, key, value)}
                />
                {it.productId && it.parameters.width && it.parameters.height && (
                  <BomPreview productId={it.productId} parameters={it.parameters} />
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { productId: "", parameters: { quantity: 1, width: 1000, height: 1500, color: "սպիտակ" } }])} className="gap-2">
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
  function updateParam(idx: number, key: string, value: any) {
    setItems(items.map((it, i) => (i === idx ? { ...it, parameters: { ...it.parameters, [key]: value } } : it)));
  }
}

function fmt(v: number | undefined): string {
  if (!v) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}

/**
 * QuickFillOrderDialog — Excel-like order entry.
 * Shows all products in a grid; user fills qty/meterage/price inline;
 * real-time total; prices can be saved back to catalog on submit.
 */
export function QuickFillOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const [clientId, setClientId] = useState("");
  const [savePrices, setSavePrices] = useState(true);
  const [rows, setRows] = useState<QuickFillRow[]>([]);
  const [totals, setTotals] = useState<QuickFillTotals>({
    totalQty: 0, totalMeterage: 0, totalAmount: 0, selectedCount: 0, priceChanges: 0,
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const msg = data?.priceUpdates > 0
        ? `Պատվերը ստեղծված է · ${data.priceUpdates} գին պահպանված է`
        : "Պատվերը ստեղծված է";
      toast.success(msg);
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!clientId) { toast.error("Ընտրեք հաճախորդ"); return; }
    const orderItems = quickFillRowsToOrderItems(rows);
    if (orderItems.length === 0) {
      toast.error("Լցրեք քանակ կամ մետրաժ առնվազն մեկ ապրանքի համար");
      return;
    }
    mutation.mutate({ clientId, items: orderItems, savePrices });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-hairline bg-card shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" />
            Արագ պատվեր — լցոնում
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Նշեք ապրանքները, լցրեք քանակը / մետրաժը / գինը։ Գները կպահպանվեն կատալոգում պատվերը հաստատելիս։
          </p>
        </DialogHeader>

        {/* Client selector */}
        <div className="px-5 py-2.5 border-b border-hairline bg-muted/20 flex items-center gap-3 flex-wrap shrink-0">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">Հաճախորդ</Label>
          <div className="flex-1 min-w-[260px]">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Ընտրեք հաճախորդ" /></SelectTrigger>
              <SelectContent>
                {clientsData?.clients?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={savePrices}
              onChange={(e) => setSavePrices(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            <span>Պահպանել գները կատալոգում</span>
          </label>
        </div>

        {/* Quick Fill grid — scrolls inside, footer sticks to bottom */}
        <div className="flex-1 overflow-hidden min-h-0">
          <QuickFillPanel
            embedded
            onChange={(r, t) => { setRows(r); setTotals(t); }}
          />
        </div>

        {/* Footer (always visible) */}
        <DialogFooter className="px-5 py-2.5 border-t-2 border-primary/30 bg-primary/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Ընտրված՝</span>
              <span className="font-semibold tabular-nums">{totals.selectedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Քանակ՝</span>
              <span className="font-semibold tabular-nums">
                {new Intl.NumberFormat("hy-AM").format(totals.totalQty)} հատ
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Մետրաժ՝</span>
              <span className="font-semibold tabular-nums">
                {new Intl.NumberFormat("hy-AM").format(totals.totalMeterage)} մ
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Ընդհանուր՝</span>
              <span className="font-bold tabular-nums text-primary text-sm">
                {new Intl.NumberFormat("hy-AM").format(totals.totalAmount)} դր
              </span>
            </div>
            {totals.priceChanges > 0 && (
              <div className="text-status-yellow font-medium">
                Գնի փոփոխություն՝ {totals.priceChanges}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
            <Button onClick={submit} disabled={mutation.isPending || totals.selectedCount === 0} className="bg-primary gap-2">
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              <Zap className="size-4" />
              Ստեղծել պատվեր ({totals.selectedCount})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
