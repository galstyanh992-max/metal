"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, Money } from "@/components/shared/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, AlertTriangle, Package, Users, ShoppingCart, Wallet, Activity } from "lucide-react";
import { DashboardCharts } from "@/components/charts/dashboard-charts";
import { formatArmenianDateShort } from "@/lib/i18n/date";
import { ModuleFooter, MODULE_FOOTERS } from "@/components/shared/module-footer";

async function fetchDashboard() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard", "admin"], queryFn: fetchDashboard });

  if (isLoading) {
    return <div className="space-y-4">
      <div className="h-8 w-48 bg-muted animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse" />)}
      </div>
    </div>;
  }

  const f = data?.finance ?? {};
  const c = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ադմինիստրատորի վահանակ"
        description={`Ամսաթիվ՝ ${formatArmenianDateShort(new Date())}`}
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <KpiCard label="Այսօրվա վաճառք" value={fmt(f.salesToday)} icon={TrendingUp} sub={`${c.ordersToday ?? 0} պատվեր`} />
        <KpiCard label="Շաբաթվա վաճառք" value={fmt(f.salesWeek)} icon={ShoppingCart} sub={`${c.ordersWeek ?? 0} պատվեր`} />
        <KpiCard label="Ամսական վաճառք" value={fmt(f.salesMonth)} icon={TrendingUp} sub={`${c.ordersMonth ?? 0} պատվեր`} />
        <KpiCard label="Ընդհանուր պատվերներ" value={String(c.totalOrders ?? 0)} icon={Activity} sub={`${c.totalClients ?? 0} հաճախորդ`} />
        <KpiCard label="Ստացված այսօր" value={fmt(f.collectedToday)} icon={Wallet} sub="Վճարումներ" />
        <KpiCard label="Ընդհանուր պարտք" value={fmt(f.outstandingDebt)} icon={AlertTriangle} sub="Չվճարված" accent={f.outstandingDebt > 0 ? "red" : undefined} />
        <KpiCard label="Ժամկետանց պարտք" value={fmt(f.overdueDebt)} icon={AlertTriangle} sub={`${c.overdueOrders ?? 0} պատվեր`} accent={f.overdueDebt > 0 ? "red" : undefined} />
        <KpiCard label="Ցածր մնացորդ" value={String(c.lowStockCount ?? 0)} icon={Package} sub="Ապրանքներ" accent={c.lowStockCount > 0 ? "yellow" : undefined} />
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* Low stock table */}
      {data?.lowStock?.length > 0 && (
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 text-status-orange" />
              Ցածր մնացորդի նախազգուշացումներ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead className="text-xs uppercase tracking-wider">Ապրանք</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">SKU</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Մատչելի</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Նվազագույն</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Գործողություն</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowStock.slice(0, 8).map((p: any) => (
                  <TableRow key={p.id} className="border-hairline">
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{p.sku}</TableCell>
                    <TableCell className="text-right tabular-nums text-status-red font-medium">{p.available}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.minStock}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs">Մատակարարել</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ModuleFooter {...MODULE_FOOTERS.dashboard} />
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (v === undefined || v === null) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
