"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KpiCard, SectionHeader } from "@/components/shared/primitives";
import {
  Plus, Search, Users, ShoppingCart, FileSpreadsheet, Loader2,
  TrendingDown, TrendingUp, ChevronRight, ClipboardList,
} from "lucide-react";
import { useState, useMemo } from "react";
import { ClientCreateDialog } from "./client-create-dialog";
import { ClientDetailDrawer } from "./client-detail-drawer";
import { OrderDetailDrawer } from "./order-detail-drawer";
import { exportToExcel, fmtDate } from "@/lib/export/excel";
import { ModuleFooter, MODULE_FOOTERS } from "@/components/shared/module-footer";
import { AcceptOrderModule } from "./accept-order-module";

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchOrders() {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const STATUS_STYLES: Record<string, string> = {
  GREEN: "bg-status-green/10 text-status-green border-status-green/20",
  YELLOW: "bg-status-yellow/10 text-status-yellow border-status-yellow/20",
  ORANGE: "bg-status-orange/10 text-status-orange border-status-orange/20",
  RED: "bg-status-red/10 text-status-red border-status-red/20",
  CRITICAL: "bg-status-red/10 text-status-red border-status-red/20",
};
const STATUS_LABELS: Record<string, string> = {
  GREEN: "Առողջ", YELLOW: "Պարտք", ORANGE: "Մոտ ժամկետ", RED: "Ժամկետանց", CRITICAL: "Սպառված",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-status-yellow/15 text-status-yellow border-status-yellow/30",
  PICKING: "bg-status-orange/15 text-status-orange border-status-orange/30",
  READY: "bg-status-green/15 text-status-green border-status-green/30",
  DELIVERED: "bg-status-green/15 text-status-green border-status-green/30",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};
const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Սևագիր", CONFIRMED: "Հաստատված", PICKING: "Ընտրման մեջ", READY: "Պատրաստ", DELIVERED: "Հանձնված", CANCELLED: "Չեղարկված",
};

function clientDisplayName(c: any): string {
  return c.type === "COMPANY" ? (c.companyName ?? "") : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

/**
 * ClientsOrdersModule — unified workspace for clients + orders.
 *
 * Single screen:
 *  - KPI row (clients, orders, total debt, turnover)
 *  - Master-detail: clients list (left) → orders of selected client (right)
 *  - Debtors filter, search, Excel export
 *  - Quick actions: new client, quick-fill order, door calculator
 */
export function ClientsOrdersModule({ role, onOrderCreated }: { role: string; onOrderCreated?: (order: { id: string }) => void }) {
  const qc = useQueryClient();
  const { data: clientsData, isLoading: clientsLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });

  const [tab, setTab] = useState<"clients" | "accept-order">("clients");
  const [search, setSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [debtorsOnly, setDebtorsOnly] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [exporting, setExporting] = useState<"clients" | "orders" | null>(null);

  const clients = (clientsData?.clients ?? []) as any[];
  const orders = (ordersData?.orders ?? []) as any[];

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (debtorsOnly && !(c.currentDebt > 0)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const name = clientDisplayName(c).toLowerCase();
      return name.includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
    });
  }, [clients, search, debtorsOnly]);

  // Orders for selected client (or all)
  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (selectedClientId && order.client?.id !== selectedClientId) return false;
      return orderStatus === "all" || order.status === orderStatus;
    });
  }, [orders, selectedClientId, orderStatus]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  // KPIs
  const totalDebt = clients.reduce((s: number, c: any) => s + (c.currentDebt ?? 0), 0);
  const totalTurnover = clients.reduce((s: number, c: any) => s + (c.lifetimeTurnover ?? 0), 0);

  const exportClients = () => {
    setExporting("clients");
    try {
      exportToExcel(
        `հաճախորդներ-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Հաճախորդներ",
        filteredClients,
        [
          { header: "Տիպ", width: 12, get: (c: any) => c.type === "COMPANY" ? "Ընկերություն" : "Անհատ" },
          { header: "Անուն / Ընկերություն", width: 32, get: (c: any) => clientDisplayName(c) },
          { header: "Հեռախոս", width: 16, get: (c: any) => c.phone ?? "" },
          { header: "Էլ. հասցե", width: 24, get: (c: any) => c.email ?? "" },
          { header: "ՀՎՀՀ", width: 14, get: (c: any) => c.taxId ?? "" },
          { header: "Կարգավիճակ", width: 14, get: (c: any) => STATUS_LABELS[c.status] ?? c.status },
          { header: "Պարտք (դր)", width: 14, get: (c: any) => c.currentDebt ?? 0 },
          { header: "Շրջանառություն (դր)", width: 16, get: (c: any) => c.lifetimeTurnover ?? 0 },
          { header: "Պատվերներ", width: 10, get: (c: any) => c.totalOrders ?? 0 },
          { header: "Ստեղծված", width: 12, get: (c: any) => fmtDate(c.createdAt) },
        ],
      );
    } finally {
      setExporting(null);
    }
  };

  const exportOrders = () => {
    setExporting("orders");
    try {
      exportToExcel(
        `պատվերներ-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Պատվերներ",
        visibleOrders,
        [
          { header: "Համար", width: 16, get: (o: any) => o.number ?? "" },
          { header: "Հաճախորդ", width: 30, get: (o: any) => clientDisplayName(o.client ?? {}) },
          { header: "Հեռախոս", width: 16, get: (o: any) => o.client?.phone ?? "" },
          { header: "Կարգավիճակ", width: 14, get: (o: any) => ORDER_STATUS_LABELS[o.status] ?? o.status },
          { header: "Քանակ", width: 10, get: (o: any) => o.items?.length ?? 0 },
          { header: "Գումար (դր)", width: 14, get: (o: any) => o.totalAmount ?? 0 },
          { header: "Վճարված (դր)", width: 14, get: (o: any) => o.paidAmount ?? 0 },
          { header: "Մնացորդ (դր)", width: 14, get: (o: any) => o.outstandingAmount ?? 0 },
          { header: "Ստեղծված", width: 12, get: (o: any) => fmtDate(o.createdAt) },
        ],
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <SectionHeader
        title="Հաճախորդներ և Պատվերներ"
        description="Միասնական աշխատանքային տարածք՝ հաճախորդների, պատվերների կառավարման և պատվերի ընդունման համար"
        action={
          <div className="flex items-center gap-1 border border-hairline rounded-lg p-1 bg-card">
            <button
              onClick={() => setTab("clients")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md ${
                tab === "clients" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"
              }`}
            >
              <Users className="size-4" />
              Հաճախորդներ
              <span className="text-xs tabular-nums opacity-70">{clients.length}</span>
            </button>
            {role !== "WAREHOUSE" && (
              <button
                onClick={() => setTab("accept-order")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md ${
                  tab === "accept-order" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"
                }`}
              >
                <ClipboardList className="size-4" />
                Ընդունել պատվեր
              </button>
            )}
          </div>
        }
      />

      {/* Accept order tab */}
      {tab === "accept-order" && role !== "WAREHOUSE" && <AcceptOrderModule role={role} onOrderCreated={onOrderCreated} />}

      {/* Clients tab */}
      {tab === "clients" && (
        <>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Հաճախորդներ" value={String(clients.length)} icon={Users} />
        <KpiCard label="Պատվերներ" value={String(orders.length)} icon={ShoppingCart} />
        <KpiCard label="Ընդհանուր պարտք" value={fmt(totalDebt)} icon={TrendingDown} accent="red" />
        <KpiCard label="Շրջանառություն" value={fmt(totalTurnover)} icon={TrendingUp} accent="green" />
      </div>

      {/* Master-detail layout */}
      <div className="grid lg:grid-cols-[minmax(300px,2fr)_3fr] gap-4 items-start">
        {/* Clients panel */}
        <div className="border border-hairline bg-card rounded-lg overflow-hidden">
          <div className="p-3 border-b border-hairline space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" />
                Հաճախորդներ
                <Badge variant="outline" className="text-[10px] border-hairline px-1.5 py-0.5">{filteredClients.length}</Badge>
              </div>
              <button
                onClick={() => setDebtorsOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${
                  debtorsOnly ? "bg-status-red/10 text-status-red border-status-red/30" : "border-hairline text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <TrendingDown className="size-3.5" />
                Պարտատերեր
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Որոնում՝ անուն, հեռախոս…"
                className="h-8 pl-8 text-xs focus-steel"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {clientsLoading && <div className="p-6 text-center text-xs text-muted-foreground">Բեռնվում է…</div>}
            {!clientsLoading && filteredClients.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {search || debtorsOnly ? "Որոնման արդյունքներ չկան" : "Հաճախորդներ չկան"}
              </div>
            )}
            {filteredClients.map((c: any) => {
              const isSelected = c.id === selectedClientId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClientId(isSelected ? null : c.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-hairline cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="size-7 bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 rounded-sm">
                    {c.type === "COMPANY" ? "Ը" : (c.firstName?.[0] ?? "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{clientDisplayName(c)}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums truncate">{c.phone}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium border ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    {c.currentDebt > 0 && (
                      <span className="text-[10px] text-status-red font-medium tabular-nums">{fmt(c.currentDebt)}</span>
                    )}
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders panel */}
        <div className="border border-hairline bg-card rounded-lg overflow-hidden">
          <div className="p-3 border-b border-hairline flex items-center justify-between gap-2 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
              <ShoppingCart className="size-4 text-primary shrink-0" />
              {selectedClient ? (
                <span className="truncate">
                  {clientDisplayName(selectedClient)}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">· {selectedClient.phone}</span>
                </span>
              ) : (
                "Բոլոր պատվերները"
              )}
              <Badge variant="outline" className="text-[10px] border-hairline px-1.5 py-0.5">{visibleOrders.length}</Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Կարգավիճակ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Բոլոր կարգավիճակները</SelectItem>
                  {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={exportOrders} disabled={exporting === "orders" || visibleOrders.length === 0}>
                {exporting === "orders" ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5 text-status-green" />}
                Excel
              </Button>
              {role !== "WAREHOUSE" && (
                <Button size="sm" className="h-7 gap-1.5 text-xs bg-primary" onClick={() => setCreateClientOpen(true)}>
                  <Plus className="size-3.5" />
                  Նոր հաճախորդ
                </Button>
              )}
            </div>
          </div>

          {/* Orders table */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[110px_minmax(160px,1fr)_100px_60px_110px_90px] gap-0 border-b border-hairline bg-muted/30 min-w-[560px]">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Համար</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հաճախորդ</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Կարգավիճակ</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Քանակ</div>
              {role !== "WAREHOUSE" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Գումար</div>}
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ամսաթիվ</div>
            </div>

            {ordersLoading && <div className="p-6 text-center text-xs text-muted-foreground">Բեռնվում է…</div>}
            {!ordersLoading && visibleOrders.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {selectedClient ? "Այս հաճախորդի պատվերներ չկան" : "Պատվերներ չկան"}
              </div>
            )}
            {visibleOrders.map((o: any, idx: number) => (
              <div
                key={o.id}
                className={`grid grid-cols-[110px_minmax(160px,1fr)_100px_60px_110px_90px] gap-0 border-b border-hairline hover:bg-muted/30 cursor-pointer transition-colors min-w-[560px] ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
                onClick={() => setSelectedOrderId(o.id)}
              >
                <div className="px-3 py-2.5 border-r border-hairline text-xs font-mono flex items-center">{o.number}</div>
                <div className="px-3 py-2.5 border-r border-hairline text-sm font-medium flex items-center min-w-0">
                  <span className="truncate">{clientDisplayName(o.client ?? {})}</span>
                </div>
                <div className="px-3 py-2.5 border-r border-hairline flex items-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border ${ORDER_STATUS_STYLES[o.status] ?? "bg-muted text-muted-foreground"}`}>
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm flex items-center justify-end">{o.items?.length ?? 0}</div>
                {role !== "WAREHOUSE" && (
                  <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm font-medium flex items-center justify-end">{fmt(o.totalAmount)}</div>
                )}
                <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-center">{new Date(o.createdAt).toLocaleDateString("hy-AM")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawers + dialogs */}
      <ClientCreateDialog
        onOrderCreated={onOrderCreated}
        open={createClientOpen}
        onClose={() => setCreateClientOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["clients"] });
          refetchOrders();
        }}
      />
      <ClientDetailDrawer clientId={selectedClientId} open={!!selectedClientId} onClose={() => setSelectedClientId(null)} role={role} />
      <OrderDetailDrawer orderId={selectedOrderId} open={!!selectedOrderId} onClose={() => setSelectedOrderId(null)} role={role} />

      <ModuleFooter {...MODULE_FOOTERS.clientsOrders} />
        </>
      )}
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
