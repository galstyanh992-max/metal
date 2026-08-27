"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Package, Clock, Receipt, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/shared/primitives";

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

const METHOD_LABELS: Record<string, string> = {
  bank: "Բանկային",
  card: "Քարտ",
  contract: "Պայմանագրային",
};

async function fetchOrder(id: string) {
  const res = await fetch(`/api/orders/${id}`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function OrderDetailDrawer({ orderId, open, onClose, role }: { orderId: string | null; open: boolean; onClose: () => void; role: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: !!orderId && open,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/orders/${orderId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: (_, action) => {
      toast.success(`Պատվերը ${action === "confirm" ? "հաստատված է" : action === "cancel" ? "չեղարկված է" : "պատրաստ է"}`);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "admin"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const order = data?.order;
  if (!order) return null;

  const canConfirm = order.status === "DRAFT";
  const canCancel = order.status === "DRAFT" || order.status === "CONFIRMED";
  const canMarkReady = order.status === "CONFIRMED";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-hairline space-y-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-mono">{order.number}</SheetTitle>
            <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_COLORS[order.status] ?? ""}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="size-3" />
            <span>{order.client?.type === "COMPANY" ? order.client?.companyName : `${order.client?.firstName ?? ""} ${order.client?.lastName ?? ""}`}</span>
            <span>·</span>
            <Clock className="size-3" />
            <span>{new Date(order.createdAt).toLocaleString("hy-AM")}</span>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-5">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <Button size="sm" className="gap-2 bg-primary" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate("confirm")}>
                {actionMutation.isPending && actionMutation.variables === "confirm" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Հաստատել և պահել պաշարը
              </Button>
            )}
            {canMarkReady && (
              <Button size="sm" variant="outline" className="gap-2" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate("mark_ready")}>
                <Package className="size-3.5" /> Պատրաստ է
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" className="gap-2 text-destructive" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate("cancel")}>
                <XCircle className="size-3.5" /> Չեղարկել
              </Button>
            )}
          </div>

          {/* Financial summary */}
          {role !== "WAREHOUSE" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Հիմնական" value={fmt(order.baseAmount)} />
              {order.discountAmount > 0 && <Stat label="Զեղչ" value={`-${fmt(order.discountAmount)}`} accent="copper" />}
              <Stat label="Ընդհանուր" value={fmt(order.totalAmount)} bold />
              <Stat label="Վճարված" value={fmt(order.paidAmount)} accent="green" />
              <Stat label="Մնացորդ" value={fmt(order.outstandingAmount)} accent={order.outstandingAmount > 0 ? "red" : "green"} />
              {role === "ADMIN" && <Stat label="Արժեք" value={fmt(order.costAmount)} />}
              {role === "ADMIN" && <Stat label="Շահույթ" value={fmt(order.grossProfit)} accent="green" />}
              {role === "ADMIN" && <Stat label="Մարժա" value={`${(order.marginPercent / 100).toFixed(1)}%`} />}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Ապրանքներ ({order.items?.length ?? 0})</h4>
            <div className="border border-hairline divide-y divide-hairline">
              {order.items?.map((item: any) => (
                <div key={item.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{item.product?.sku} · {item.product?.unit?.symbol}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">× {item.qty}</div>
                      {role !== "WAREHOUSE" && <div className="text-sm font-medium tabular-nums">{fmt(item.lineTotal)}</div>}
                    </div>
                  </div>
                  {item.parameters?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.parameters.map((p: any) => (
                        <span key={p.fieldKey} className="text-[10px] bg-muted px-1.5 py-0.5 border border-hairline">
                          {p.label}: <span className="font-medium">{p.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payments */}
          {role !== "WAREHOUSE" && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                <Receipt className="size-3.5" /> Վճարումներ ({order.payments?.length ?? 0})
              </h4>
              {order.payments?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-hairline">
                      <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                      <TableHead className="text-xs uppercase">Մեթոդ</TableHead>
                      <TableHead className="text-xs uppercase text-right">Գումար</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.payments.map((p: any) => (
                      <TableRow key={p.id} className="border-hairline">
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("hy-AM")}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{METHOD_LABELS[p.method] ?? p.method}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-status-green">{fmt(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-xs text-muted-foreground py-3 border border-dashed border-hairline text-center">Վճարումներ չկան</div>
              )}
            </div>
          )}

          {/* Status timeline */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
              <Clock className="size-3.5" /> Կարգավիճակի պատմություն
            </h4>
            <div className="space-y-2 border-l-2 border-hairline ml-2 pl-4">
              {order.statusHistory?.map((h: any, idx: number) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-[1.32rem] top-1 size-2.5 rounded-full bg-copper border-2 border-background" />
                  <div className="text-xs">
                    <span className="font-medium">{STATUS_LABELS[h.status] ?? h.status}</span>
                    <span className="text-muted-foreground ml-2">{new Date(h.at).toLocaleString("hy-AM")}</span>
                  </div>
                  {h.note && <div className="text-[10px] text-muted-foreground mt-0.5">{h.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, accent, bold }: { label: string; value: string; accent?: "green" | "red" | "copper"; bold?: boolean }) {
  const color = accent === "green" ? "text-status-green" : accent === "red" ? "text-status-red" : accent === "copper" ? "text-copper" : "";
  return (
    <div className="bg-muted/30 border border-hairline p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm tabular-nums ${color} ${bold ? "font-semibold" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
