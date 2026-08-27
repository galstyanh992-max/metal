"use client";

import { useQuery } from "@tanstack/react-query";
import { SectionHeader, KpiCard, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, ShoppingBag, Wallet, Percent, BarChart3, Package } from "lucide-react";
import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";

async function fetchReport(period: string) {
  const res = await fetch(`/api/reports?period=${period}`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ReportsModule() {
  const [period, setPeriod] = useState("30");
  const { data, isLoading } = useQuery({ queryKey: ["reports", period], queryFn: () => fetchReport(period) });

  const s = data?.summary ?? {};
  const dailyData = data?.dailyData ?? [];
  const topProducts = data?.topProducts ?? [];
  const paymentByMethod = data?.paymentByMethod ?? {};

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Հաշվետվություններ"
        description="Վաճառքի, շահույթի և գումարման վերլուծություն"
        action={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 օր</SelectItem>
              <SelectItem value="30">30 օր</SelectItem>
              <SelectItem value="90">90 օր</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <KpiCard label="Ընդհանուր վաճառք" value={fmt(s.totalSales)} icon={TrendingUp} accent="green" sub={`${s.totalOrders ?? 0} պատվեր`} />
        <KpiCard label="Ընդհանուր գանձում" value={fmt(s.totalCollected)} icon={Wallet} sub="Վճարումներ" />
        <KpiCard label="Շահույթ" value={fmt(s.totalProfit)} icon={DollarSign} accent={s.totalProfit > 0 ? "green" : "red"} />
        <KpiCard label="Մարժա" value={`${s.marginPercent ?? 0}%`} icon={Percent} accent="copper" />
        <KpiCard label="Միջին պատվեր" value={fmt(s.avgOrderValue)} icon={ShoppingBag} />
        <KpiCard label="Ընդհանուր արժեք" value={fmt(s.totalCost)} icon={DollarSign} />
      </div>

      {/* Sales + Profit chart */}
      {dailyData.length > 0 && (
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-steel" />
              Վաճառք և Շահույթ ({period} օր)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesRptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.45 0.025 240)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.45 0.025 240)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitRptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.14 65)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.62 0.14 65)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.008 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: "4px", fontSize: "12px", color: "oklch(0.95 0.003 240)" }}
                  formatter={(v: any) => new Intl.NumberFormat("hy-AM").format(v) + " դր"}
                />
                <Area type="monotone" dataKey="sales" stroke="oklch(0.45 0.025 240)" strokeWidth={2} fill="url(#salesRptGrad)" name="Վաճառք" />
                <Area type="monotone" dataKey="profit" stroke="oklch(0.62 0.14 65)" strokeWidth={2} fill="url(#profitRptGrad)" name="Շահույթ" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top products */}
        {topProducts.length > 0 && (
          <Card className="border-hairline shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="size-4 text-copper" />
                Լավագույն ապրանքներ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-hairline">
                    <TableHead className="text-xs uppercase">Ապրանք</TableHead>
                    <TableHead className="text-xs uppercase text-right">Քանակ</TableHead>
                    <TableHead className="text-xs uppercase text-right">Եկամուտ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.slice(0, 8).map((p: any, idx: number) => (
                    <TableRow key={idx} className="border-hairline">
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground tabular-nums w-4">{idx + 1}.</span>
                          {p.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{p.qty}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Payment methods */}
        {Object.keys(paymentByMethod).length > 0 && (
          <Card className="border-hairline shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="size-4 text-steel" />
                Վճարման մեթոդներ
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(paymentByMethod).map(([method, amount]) => ({ method, amount }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                  <XAxis dataKey="method" tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.16 0.008 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: "4px", fontSize: "12px", color: "oklch(0.95 0.003 240)" }}
                    formatter={(v: any) => new Intl.NumberFormat("hy-AM").format(v) + " դր"}
                  />
                  <Bar dataKey="amount" fill="oklch(0.62 0.14 65)" radius={[2, 2, 0, 0]} name="Գումար" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {dailyData.length === 0 && topProducts.length === 0 && !isLoading && (
        <EmptyState title="Տվյալներ չկան" description={`${period} օրվա ընթացքում տվյալներ չկան`} />
      )}
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
