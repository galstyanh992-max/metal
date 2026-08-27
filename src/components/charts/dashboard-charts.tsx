"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, PieChart, Crown } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
} from "recharts";

async function fetchChartData() {
  const res = await fetch("/api/dashboard/chart");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const STATUS_COLORS_MAP: Record<string, string> = {
  DRAFT: "oklch(0.7 0.01 240)",
  CONFIRMED: "oklch(0.78 0.15 90)",
  PICKING: "oklch(0.68 0.17 55)",
  READY: "oklch(0.55 0.14 150)",
  DELIVERED: "oklch(0.45 0.025 240)",
  CANCELLED: "oklch(0.5 0.02 240)",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Սևագիր",
  CONFIRMED: "Հաստատված",
  PICKING: "Ընտրման մեջ",
  READY: "Պատրաստ",
  DELIVERED: "Հանձնված",
  CANCELLED: "Չեղարկված",
};

const METHOD_COLORS: Record<string, string> = {
  bank: "oklch(0.45 0.025 240)",
  card: "oklch(0.62 0.14 65)",
  contract: "oklch(0.55 0.14 150)",
};

const METHOD_LABELS: Record<string, string> = {
  bank: "Բանկային",
  card: "Քարտ",
  contract: "Պայմանագրային",
};

export function DashboardCharts() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard", "chart"], queryFn: fetchChartData });

  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-64 bg-muted/30 animate-pulse border border-hairline" />
        <div className="h-64 bg-muted/30 animate-pulse border border-hairline" />
      </div>
    );
  }

  const dailySales = data?.dailySales ?? [];
  const topClients = data?.topClients ?? [];
  const statusDistribution = data?.statusDistribution ?? [];
  const paymentMethods = data?.paymentMethods ?? [];

  const hasData = dailySales.some((d: any) => d.sales > 0) || topClients.length > 0 || statusDistribution.length > 0;

  if (!hasData) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Daily sales area chart */}
      {dailySales.some((d: any) => d.sales > 0) && (
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-steel" />
              Վաճառքի դինամիկա (14 օր)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.45 0.025 240)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.45 0.025 240)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.14 65)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.62 0.14 65)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.16 0.008 240)",
                    border: "1px solid oklch(0.28 0.008 240)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "oklch(0.95 0.003 240)",
                  }}
                  formatter={(v: any) => new Intl.NumberFormat("hy-AM").format(v) + " դր"}
                />
                <Area type="monotone" dataKey="sales" stroke="oklch(0.45 0.025 240)" strokeWidth={2} fill="url(#salesGradient)" name="Վաճառք" />
                <Area type="monotone" dataKey="profit" stroke="oklch(0.62 0.14 65)" strokeWidth={2} fill="url(#profitGradient)" name="Շահույթ" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Order status pie */}
      {statusDistribution.length > 0 && (
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="size-4 text-copper" />
              Պատվերների բաշխում
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPie>
                <Pie
                  data={statusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {statusDistribution.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={STATUS_COLORS_MAP[entry.status] ?? "oklch(0.7 0.01 240)"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.16 0.008 240)",
                    border: "1px solid oklch(0.28 0.008 240)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "oklch(0.95 0.003 240)",
                  }}
                  formatter={(v: any, _name: any, props: any) => [`${v} պատվեր`, STATUS_LABELS[props.payload.status] ?? props.payload.status]}
                />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {statusDistribution.map((s: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                  <div className="size-2" style={{ background: STATUS_COLORS_MAP[s.status] ?? "oklch(0.7 0.01 240)" }} />
                  <span className="text-muted-foreground">{STATUS_LABELS[s.status] ?? s.status}</span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top clients bar */}
      {topClients.length > 0 && (
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="size-4 text-copper" />
              Լավագույն հաճախորդներ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.48 0.012 240)" }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.16 0.008 240)",
                    border: "1px solid oklch(0.28 0.008 240)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "oklch(0.95 0.003 240)",
                  }}
                  formatter={(v: any) => new Intl.NumberFormat("hy-AM").format(v) + " դր"}
                />
                <Bar dataKey="turnover" fill="oklch(0.62 0.14 65)" radius={[0, 2, 2, 0]} name="Շրջանառություն" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Payment methods pie */}
      {paymentMethods.length > 0 && (
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4 text-steel" />
              Վճարման մեթոդներ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPie>
                <Pie
                  data={paymentMethods}
                  dataKey="amount"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  paddingAngle={2}
                  label={({ percent }: any) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}
                  labelLine={false}
                >
                  {paymentMethods.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={METHOD_COLORS[entry.method] ?? "oklch(0.7 0.01 240)"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.16 0.008 240)",
                    border: "1px solid oklch(0.28 0.008 240)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "oklch(0.95 0.003 240)",
                  }}
                  formatter={(v: any, _name: any, props: any) => [new Intl.NumberFormat("hy-AM").format(v) + " դր", METHOD_LABELS[props.payload.method] ?? props.payload.method]}
                />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {paymentMethods.map((m: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                  <div className="size-2" style={{ background: METHOD_COLORS[m.method] ?? "oklch(0.7 0.01 240)" }} />
                  <span className="text-muted-foreground">{METHOD_LABELS[m.method] ?? m.method}</span>
                  <span className="font-medium tabular-nums">{m.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
