"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, ShoppingCart, Zap, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { ClientCreateDialog } from "./client-create-dialog";
import { ClientDetailDrawer } from "./client-detail-drawer";
import { OrderDetailDrawer } from "./order-detail-drawer";
import { CreateOrderDialog, QuickFillOrderDialog } from "./orders-module";
import { exportToExcel, fmtAMD, fmtDate } from "@/lib/export/excel";
import { ModuleFooter, MODULE_FOOTERS } from "@/components/shared/module-footer";

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

export function ClientsOrdersModule({ role }: { role: string }) {
  const { data: clientsData, isLoading: clientsLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const [tab, setTab] = useState<"clients" | "orders">("clients");
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [quickFillOpen, setQuickFillOpen] = useState(false);

  const clients = (clientsData?.clients ?? []).filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`;
    return name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
  });

  const orders = (ordersData?.orders ?? []).filter((o: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.number?.toLowerCase().includes(q) ||
      o.client?.companyName?.toLowerCase().includes(q) ||
      o.client?.firstName?.toLowerCase().includes(q) ||
      o.client?.lastName?.toLowerCase().includes(q);
  });

  const [exporting, setExporting] = useState<"clients" | "orders" | null>(null);

  const exportClients = () => {
    setExporting("clients");
    try {
      exportToExcel(
        `հաճախորդներ-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Հաճախորդներ",
        clients,
        [
          { header: "Տիպ", width: 12, get: c => c.type === "COMPANY" ? "Ընկերություն" : "Անհատ" },
          {
            header: "Անուն / Ընկերություն",
            width: 32,
            get: c => c.type === "COMPANY" ? c.companyName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
          },
          { header: "Հեռախոս", width: 16, get: c => c.phone ?? "" },
          { header: "Էլ. հասցե", width: 24, get: c => c.email ?? "" },
          { header: "ՀՎՀՀ", width: 14, get: c => c.taxId ?? "" },
          { header: "Հասցե", width: 30, get: c => c.primaryAddress ?? c.actualAddress ?? c.legalAddress ?? "" },
          {
            header: "Կարգավիճակ",
            width: 14,
            get: c => ({ GREEN: "Առողջ", YELLOW: "Պարտք", ORANGE: "Մոտ ժամկետ", RED: "Ժամկետանց", CRITICAL: "Սպառված" }[c.status as string] ?? c.status),
          },
          { header: "Պարտք (դր)", width: 14, get: c => c.currentDebt ?? 0 },
          { header: "Շրջանառություն (դր)", width: 16, get: c => c.lifetimeTurnover ?? 0 },
          { header: "Պատվերներ", width: 10, get: c => c.totalOrders ?? 0 },
          { header: "Ստեղծված", width: 12, get: c => fmtDate(c.createdAt) },
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
        orders,
        [
          { header: "Համար", width: 16, get: o => o.number ?? "" },
          {
            header: "Հաճախորդ",
            width: 30,
            get: o => o.client?.type === "COMPANY"
              ? o.client?.companyName ?? ""
              : `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}`.trim(),
          },
          { header: "Հեռախոս", width: 16, get: o => o.client?.phone ?? "" },
          {
            header: "Կարգավիճակ",
            width: 14,
            get: o => ({ DRAFT: "Սևագիր", CONFIRMED: "Հաստատված", PICKING: "Ընտրման մեջ", READY: "Պատրաստ", DELIVERED: "Հանձնված", CANCELLED: "Չեղարկված" }[o.status as string] ?? o.status),
          },
          { header: "Պարտադիր քանակ", width: 10, get: o => o.items?.length ?? 0 },
          { header: "Գումար (դր)", width: 14, get: o => o.totalAmount ?? 0 },
          { header: "Վճարված (դր)", width: 14, get: o => o.paidAmount ?? 0 },
          { header: "Մնացորդ (դր)", width: 14, get: o => o.outstandingAmount ?? 0 },
          { header: "Շահույթ (դր)", width: 14, get: o => o.grossProfit ?? 0 },
          { header: "Մարժա (%)", width: 10, get: o => o.marginPercent ? (o.marginPercent / 100).toFixed(2) : "0" },
          { header: "Ստեղծված", width: 12, get: o => fmtDate(o.createdAt) },
          { header: "Ժամկետ", width: 12, get: o => fmtDate(o.dueDate) },
        ],
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 border border-hairline">
          <button
            onClick={() => setTab("clients")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === "clients" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
          >
            <Users className="size-4" />
            Հաճախորդներ
            <span className="text-xs tabular-nums opacity-70">{clients.length}</span>
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === "orders" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
          >
            <ShoppingCart className="size-4" />
            Պատվերներ
            <span className="text-xs tabular-nums opacity-70">{orders.length}</span>
          </button>
        </div>
        {role !== "WAREHOUSE" && (
          <div className="flex items-center gap-2">
            {tab === "clients" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={exportClients}
                disabled={exporting === "clients" || clients.length === 0}
                title="Արտահանել Excel ֆորմատով"
              >
                {exporting === "clients" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4 text-status-green" />}
                Excel
              </Button>
            )}
            {tab === "orders" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={exportOrders}
                disabled={exporting === "orders" || orders.length === 0}
                title="Արտահանել Excel ֆորմատով"
              >
                {exporting === "orders" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4 text-status-green" />}
                Excel
              </Button>
            )}
            <Button size="sm" className="gap-2 bg-primary" onClick={() => tab === "clients" ? setCreateClientOpen(true) : setQuickFillOpen(true)}>
              <Plus className="size-4" /> {tab === "clients" ? "Նոր հաճախորդ" : "Գրանցել Պատվեր"}
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
            placeholder={tab === "clients" ? "Որոնում՝ անուն, հեռախոս, էլ․ հասցե…" : "Որոնում՝ համար, հաճախորդ…"}
            className="pl-9 focus-steel"
          />
        </div>
      </div>

      {/* Excel-like table */}
      <div className="border border-hairline overflow-x-auto bg-card">
        {tab === "clients" ? (
          <>
            {/* Client headers */}
            <div className="grid grid-cols-[minmax(200px,1fr)_140px_100px_120px_120px_80px] gap-0 border-b border-hairline bg-muted/30">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Անուն / Ընկերություն</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հեռախոս</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Կարգավիճակ</div>
              {role !== "WAREHOUSE" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Պարտք</div>}
              {role === "ADMIN" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Շրջանառություն</div>}
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Պատվերներ</div>
            </div>
            {/* Client rows */}
            {clients.map((c: any, idx: number) => (
              <div
                key={c.id}
                className={`grid grid-cols-[minmax(200px,1fr)_140px_100px_120px_120px_80px] gap-0 border-b border-hairline hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
                onClick={() => setSelectedClientId(c.id)}
              >
                <div className="px-3 py-2.5 border-r border-hairline flex items-center gap-2 min-w-0">
                  <div className="size-6 bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 rounded-sm">
                    {c.type === "COMPANY" ? "Ը" : (c.firstName?.[0] ?? "?")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`}</div>
                    {c.type === "COMPANY" && c.taxId && <div className="text-[10px] text-muted-foreground font-mono">ՀՎՀՀ {c.taxId}</div>}
                  </div>
                </div>
                <div className="px-3 py-2.5 border-r border-hairline text-sm text-muted-foreground tabular-nums flex items-center">{c.phone}</div>
                <div className="px-3 py-2.5 border-r border-hairline flex items-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                {role !== "WAREHOUSE" && (
                  <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm flex items-center justify-end">
                    {c.currentDebt > 0 ? <span className="text-status-red font-medium">{fmt(c.currentDebt)}</span> : <span className="text-muted-foreground">—</span>}
                  </div>
                )}
                {role === "ADMIN" && (
                  <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm text-muted-foreground flex items-center justify-end">{fmt(c.lifetimeTurnover)}</div>
                )}
                <div className="px-3 py-2.5 text-right tabular-nums text-sm flex items-center justify-end">{c.totalOrders}</div>
              </div>
            ))}
            {clients.length === 0 && !clientsLoading && (
              <div className="px-3 py-12 text-center text-sm text-muted-foreground">{search ? "Որոնման արդյունքներ չկան" : "Հաճախորդներ չկան"}</div>
            )}
          </>
        ) : (
          <>
            {/* Order headers */}
            <div className="grid grid-cols-[120px_minmax(180px,1fr)_110px_70px_120px_120px_100px] gap-0 border-b border-hairline bg-muted/30">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Համար</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հաճախորդ</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Կարգավիճակ</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Քանակ</div>
              {role !== "WAREHOUSE" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Գումար</div>}
              {role === "ADMIN" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Շահույթ</div>}
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ամսաթիվ</div>
            </div>
            {/* Order rows */}
            {orders.map((o: any, idx: number) => (
              <div
                key={o.id}
                className={`grid grid-cols-[120px_minmax(180px,1fr)_110px_70px_120px_120px_100px] gap-0 border-b border-hairline hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
                onClick={() => setSelectedOrderId(o.id)}
              >
                <div className="px-3 py-2.5 border-r border-hairline text-xs font-mono flex items-center">{o.number}</div>
                <div className="px-3 py-2.5 border-r border-hairline text-sm font-medium flex items-center min-w-0">
                  <span className="truncate">{o.client?.type === "COMPANY" ? o.client?.companyName : `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}`}</span>
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
                {role === "ADMIN" && (
                  <div className="px-3 py-2.5 border-r border-hairline text-right tabular-nums text-sm text-status-green flex items-center justify-end">{fmt(o.grossProfit)}</div>
                )}
                <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-center">{new Date(o.createdAt).toLocaleDateString("hy-AM")}</div>
              </div>
            ))}
            {orders.length === 0 && !ordersLoading && (
              <div className="px-3 py-12 text-center text-sm text-muted-foreground">{search ? "Որոնման արդյունքներ չկան" : "Պատվերներ չկան"}</div>
            )}
          </>
        )}
      </div>

      {/* Drawers */}
      <ClientCreateDialog open={createClientOpen} onClose={() => setCreateClientOpen(false)} />
      <ClientDetailDrawer clientId={selectedClientId} open={!!selectedClientId} onClose={() => setSelectedClientId(null)} role={role} />
      {createOrderOpen && <CreateOrderDialog onClose={() => setCreateOrderOpen(false)} onCreated={() => setCreateOrderOpen(false)} />}
      {quickFillOpen && <QuickFillOrderDialog onClose={() => setQuickFillOpen(false)} onCreated={() => { setQuickFillOpen(false); refetchOrders(); }} />}
      <OrderDetailDrawer orderId={selectedOrderId} open={!!selectedOrderId} onClose={() => setSelectedOrderId(null)} role={role} />

      <ModuleFooter {...MODULE_FOOTERS.clientsOrders} />
    </div>
  );
}

function fmt(v: number): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
