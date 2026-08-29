"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, ShoppingCart, AlertTriangle, Plus, Search } from "lucide-react";
import { useState } from "react";
import { ClientCreateDialog } from "./client-create-dialog";
import { ClientDetailDrawer } from "./client-detail-drawer";

async function fetchClients() {
  const res = await fetch("/api/clients");
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
  GREEN: "Առողջ",
  YELLOW: "Պարտք",
  ORANGE: "Մոտ ժամկետ",
  RED: "Ժամկետանց",
  CRITICAL: "Սպառված",
};

export function ClientsModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clients = (data?.clients ?? []).filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`;
    return name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Հաճախորդներ</h2>
          <span className="text-sm text-muted-foreground tabular-nums">{clients.length}</span>
        </div>
        <Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Նոր
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Որոնում՝ անուն, հեռախոս, էլ․ հասցե…"
            className="pl-9 focus-steel"
          />
        </div>
      </div>

      {/* Excel-like table */}
      <div className="border border-hairline overflow-x-auto bg-card">
        {/* Column headers */}
        <div className="grid grid-cols-[minmax(200px,1fr)_140px_100px_120px_120px_80px] gap-0 border-b border-hairline bg-muted/30">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Անուն / Ընկերություն</div>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հեռախոս</div>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Կարգավիճակ</div>
          {role !== "WAREHOUSE" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Պարտք</div>}
          {role === "ADMIN" && <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Շրջանառություն</div>}
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Պատվերներ</div>
        </div>

        {/* Rows */}
        {clients.map((c: any, idx: number) => (
          <div
            key={c.id}
            className={`grid grid-cols-[minmax(200px,1fr)_140px_100px_120px_120px_80px] gap-0 border-b border-hairline hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
            onClick={() => setSelectedId(c.id)}
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
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}>
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

        {/* Empty state */}
        {clients.length === 0 && !isLoading && (
          <div className="px-3 py-12 text-center text-sm text-muted-foreground">
            {search ? "Որոնման արդյունքներ չկան" : "Հաճախորդներ չկան"}
          </div>
        )}
      </div>

      <ClientCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ClientDetailDrawer clientId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} role={role} />
    </div>
  );
}

function fmt(v: number): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
