"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Percent } from "lucide-react";

async function fetchLoyalty() {
  const res = await fetch("/api/loyalty");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function LoyaltyModule() {
  const { data, isLoading } = useQuery({ queryKey: ["loyalty"], queryFn: fetchLoyalty });

  const tiers = data?.tiers ?? [];
  const overrides = data?.overrides ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader title="Հավատարմության ծրագիր" description="Մակարդակներ և զեղչեր" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Մակարդակներ" value={String(tiers.length)} icon={Crown} />
        <KpiCard label="Հաճախորդներ" value={String(tiers.reduce((s: number, t: any) => s + (t._count?.clients ?? 0), 0))} icon={Users} />
        <KpiCard label="Override-ներ" value={String(overrides.length)} icon={Percent} />
        <KpiCard label="Առավելագույն զեղչ" value={`${Math.max(0, ...tiers.map((t: any) => t.discountPercent))}%`} icon={Percent} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <div className="p-4 border-b border-hairline text-sm font-semibold flex items-center gap-2">
            <Crown className="size-4 text-copper" /> Մակարդակներ
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Մակարդակ</TableHead>
                <TableHead className="text-xs uppercase text-right">Շեմ (դր)</TableHead>
                <TableHead className="text-xs uppercase text-right">Զեղչ</TableHead>
                <TableHead className="text-xs uppercase text-right">Հաճախորդներ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((t: any) => (
                <TableRow key={t.id} className="border-hairline">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-6 bg-copper/10 border border-copper/30 flex items-center justify-center">
                        <Crown className="size-3 text-copper" />
                      </div>
                      <span className="text-sm font-medium">{t.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{new Intl.NumberFormat("hy-AM").format(t.thresholdTurnover)} դր</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-copper">{t.discountPercent}%</TableCell>
                  <TableCell className="text-right tabular-nums">{t._count?.clients ?? 0}</TableCell>
                </TableRow>
              ))}
              {tiers.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={4}><EmptyState title="Մակարդակներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {overrides.length > 0 && (
        <Card className="border-hairline shadow-none">
          <CardContent className="p-0">
            <div className="p-4 border-b border-hairline text-sm font-semibold flex items-center gap-2">
              <Percent className="size-4" /> Ձեռքով զեղչեր (override)
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead className="text-xs uppercase">Հաճախորդ</TableHead>
                  <TableHead className="text-xs uppercase text-right">Զեղչ</TableHead>
                  <TableHead className="text-xs uppercase">Պատճառ</TableHead>
                  <TableHead className="text-xs uppercase">Օգտատեր</TableHead>
                  <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((o: any) => (
                  <TableRow key={o.id} className="border-hairline">
                    <TableCell className="text-sm font-medium">
                      {o.client?.type === "COMPANY" ? o.client?.companyName : `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-copper">{o.discountPercent}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.reason}</TableCell>
                    <TableCell className="text-xs">{o.byUser?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("hy-AM")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
