"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronDown, ChevronRight, AlertTriangle, Wallet, TrendingDown, TrendingUp, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportToExcel, fmtAMD, fmtDate } from "@/lib/export/excel";

async function fetchDebtors() {
  const res = await fetch("/api/debts");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function DebtsModule() {
  const { data, isLoading } = useQuery({ queryKey: ["debts"], queryFn: fetchDebtors });
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const debtors = data?.debtors ?? [];
  const summary = data?.summary ?? { debtorCount: 0, totalDebt: 0, totalPaid: 0, totalOrdered: 0 };

  const filtered = useMemo(() => {
    if (!search) return debtors;
    const q = search.toLowerCase();
    return debtors.filter((d: any) =>
      d.name?.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.taxId?.includes(q)
    );
  }, [debtors, search]);

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const exportExcel = () => {
    setExporting(true);
    try {
      // Flatten to per-order rows for better Excel usability
      const rows: any[] = [];
      filtered.forEach((d: any) => {
        if (d.orders.length === 0) {
          rows.push({
            client: d.name,
            phone: d.phone,
            type: d.type === "COMPANY" ? "Ընկերություն" : "Անհատ",
            address: d.address,
            orderNumber: "—",
            orderDate: "—",
            orderTotal: 0,
            paid: d.totalPaid,
            outstanding: d.totalDebt,
            status: "—",
          });
        } else {
          d.orders.forEach((o: any) => {
            rows.push({
              client: d.name,
              phone: d.phone,
              type: d.type === "COMPANY" ? "Ընկերություն" : "Անհատ",
              address: d.address,
              orderNumber: o.number,
              orderDate: fmtDate(o.createdAt),
              orderTotal: o.totalAmount,
              paid: o.paidAmount,
              outstanding: o.outstandingAmount,
              status: o.status,
            });
          });
        }
      });
      exportToExcel(
        `պարտատերեր-${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Պարտատերեր",
        rows,
        [
          { header: "Հաճախորդ", width: 30, get: (r) => r.client },
          { header: "Հեռախոս", width: 16, get: (r) => r.phone },
          { header: "Տիպ", width: 12, get: (r) => r.type },
          { header: "Հասցե", width: 30, get: (r) => r.address },
          { header: "Պատվերի համար", width: 16, get: (r) => r.orderNumber },
          { header: "Ամսաթիվ", width: 12, get: (r) => r.orderDate },
          { header: "Պատվերի գումար (դր)", width: 16, get: (r) => r.orderTotal },
          { header: "Փակված (դր)", width: 14, get: (r) => r.paid },
          { header: "Մնացորդ պարտք (դր)", width: 18, get: (r) => r.outstanding },
          { header: "Կարգավիճակ", width: 14, get: (r) => r.status },
        ],
      );
    } finally {
      setExporting(false);
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Պարտատերեր</h2>
          <span className="text-sm text-muted-foreground tabular-nums">{filtered.length}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={exportExcel}
          disabled={exporting || filtered.length === 0}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4 text-status-green" />}
          Excel
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-hairline shadow-none">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="size-4 text-status-red" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Պարտատերեր</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{summary.debtorCount}</div>
          </CardContent>
        </Card>
        <Card className="border-hairline shadow-none">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="size-4 text-status-red" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Ընդհանուր պարտք</span>
            </div>
            <div className="text-xl font-bold tabular-nums text-status-red">{fmtAMD(summary.totalDebt)}</div>
          </CardContent>
        </Card>
        <Card className="border-hairline shadow-none">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="size-4 text-status-green" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Վճարված</span>
            </div>
            <div className="text-xl font-bold tabular-nums text-status-green">{fmtAMD(summary.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card className="border-hairline shadow-none">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="size-4 text-primary" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Ընդհանուր պատվերներ</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{fmtAMD(summary.totalOrdered)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Որոնում՝ անուն, հեռախոս, էլ․ հասցե, ՀՎՀՀ…"
          className="pl-9 focus-steel"
        />
      </div>

      {/* Debtors table — expandable per client */}
      <div className="border border-hairline bg-card overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[40px_minmax(180px,1.4fr)_130px_minmax(160px,1fr)_90px_110px_110px_40px] gap-0 border-b border-hairline bg-muted/30 min-w-[820px]">
          <div className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-center"></div>
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հաճախորդ</div>
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հեռախոս</div>
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Հասցե</div>
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Պատվերներ</div>
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Փակված</div>
          <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Մնացորդ պարտք</div>
          <div className="px-2 py-2.5"></div>
        </div>

        {/* Rows */}
        {isLoading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Բեռնվում է…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? "Որոնման արդյունքներ չկան" : "Պարտատերեր չկան 🎉"}
          </div>
        )}
        {filtered.map((d: any, idx: number) => {
          const isOpen = expanded[d.id];
          return (
            <div key={d.id} className={idx % 2 === 1 ? "bg-muted/5" : ""}>
              {/* Client row */}
              <div
                className={`grid grid-cols-[40px_minmax(180px,1.4fr)_130px_minmax(160px,1fr)_90px_110px_110px_40px] gap-0 border-b border-hairline hover:bg-muted/30 cursor-pointer transition-colors min-w-[820px] ${isOpen ? "bg-primary/5" : ""}`}
                onClick={() => toggle(d.id)}
              >
                <div className="px-2 py-3 border-r border-hairline flex items-center justify-center text-muted-foreground">
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </div>
                <div className="px-3 py-2.5 border-r border-hairline min-w-0">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {d.type === "COMPANY" ? "Ընկերություն" : "Անհատ"}
                    {d.taxId && ` · ՀՎՀՀ ${d.taxId}`}
                  </div>
                </div>
                <div className="px-3 py-2.5 border-r border-hairline text-sm text-muted-foreground tabular-nums flex items-center">
                  {d.phone}
                </div>
                <div className="px-3 py-2.5 border-r border-hairline text-xs text-muted-foreground flex items-center min-w-0">
                  <span className="truncate" title={d.address}>{d.address || "—"}</span>
                </div>
                <div className="px-3 py-2.5 border-r border-hairline text-right text-sm tabular-nums flex items-center justify-end">
                  {d.orderCount}
                </div>
                <div className="px-3 py-2.5 border-r border-hairline text-right text-sm tabular-nums text-status-green flex items-center justify-end">
                  {fmtAMD(d.totalPaid)}
                </div>
                <div className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-status-red flex items-center justify-end">
                  {fmtAMD(d.totalDebt)}
                </div>
                <div className="px-2 py-2.5 flex items-center justify-center">
                  {d.orders.length > 0 && (
                    <Badge variant="outline" className="text-[9px] border-hairline">
                      {d.orders.length}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Expanded orders */}
              {isOpen && d.orders.length > 0 && (
                <div className="bg-muted/10 border-b border-hairline">
                  <div className="px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Պատվերների մանրամասներ</div>
                    <div className="border border-hairline rounded overflow-x-auto">
                      <div className="grid grid-cols-[140px_1fr_110px_110px_110px_110px_100px] gap-0 border-b border-hairline bg-muted/30 min-w-[780px]">
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Պատվեր N</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Ամսաթիվ</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Պատվերի գումար</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Փակված</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Մնացորդ</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Ժամկետ</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Կարգ.</div>
                      </div>
                      {d.orders.map((o: any) => (
                        <div key={o.id} className="grid grid-cols-[140px_1fr_110px_110px_110px_110px_100px] gap-0 border-b border-hairline last:border-b-0 hover:bg-muted/20 min-w-[780px]">
                          <div className="px-3 py-2 text-xs font-mono border-r border-hairline">{o.number}</div>
                          <div className="px-3 py-2 text-xs text-muted-foreground border-r border-hairline">
                            {fmtDate(o.createdAt)}
                          </div>
                          <div className="px-3 py-2 text-right text-xs tabular-nums border-r border-hairline">
                            {fmtAMD(o.totalAmount)}
                          </div>
                          <div className="px-3 py-2 text-right text-xs tabular-nums text-status-green border-r border-hairline">
                            {fmtAMD(o.paidAmount)}
                          </div>
                          <div className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-status-red border-r border-hairline">
                            {fmtAMD(o.outstandingAmount)}
                          </div>
                          <div className="px-3 py-2 text-right text-xs text-muted-foreground border-r border-hairline">
                            {o.dueDate ? fmtDate(o.dueDate) : "—"}
                          </div>
                          <div className="px-3 py-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}>
                              {STATUS_LABELS[o.status] ?? o.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {d.orders[0]?.note && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        Նշում՝ {d.orders[0].note}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
