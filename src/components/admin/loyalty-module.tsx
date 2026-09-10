"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Percent, Pencil, Save, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchLoyalty() {
  const res = await fetch("/api/loyalty");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function LoyaltyModule() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["loyalty"], queryFn: fetchLoyalty });
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState("");
  const thresholdMutation = useMutation({
    mutationFn: async ({ tierId, thresholdTurnover }: { tierId: string; thresholdTurnover: number }) => {
      const response = await fetch("/api/loyalty", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId, thresholdTurnover }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Չհաջողվեց պահպանել շեմը։");
      return data.tier;
    },
    onSuccess: (tier) => {
      queryClient.setQueryData(["loyalty"], (previous: any) => previous ? {
        ...previous, tiers: previous.tiers.map((item: any) => item.id === tier.id ? { ...item, ...tier } : item),
      } : previous);
      void queryClient.invalidateQueries({ queryKey: ["loyalty"] });
      setEditingTierId(null);
      setThreshold("");
    },
  });

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
                <TableHead className="w-12"><span className="sr-only">Խմբագրել</span></TableHead>
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
                  <TableCell className="text-right tabular-nums">
                    {editingTierId === t.id ? (
                      <Input
                        aria-label={`${t.name}՝ շեմ`}
                        type="number"
                        min="0"
                        max="2000000000"
                        step="1"
                        value={threshold}
                        disabled={thresholdMutation.isPending}
                        onChange={(event) => setThreshold(event.target.value)}
                        className="ml-auto h-8 w-40 text-right tabular-nums"
                      />
                    ) : `${new Intl.NumberFormat("hy-AM").format(t.thresholdTurnover)} դր`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-copper">{t.discountPercent}%</TableCell>
                  <TableCell className="text-right tabular-nums">{t._count?.clients ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {editingTierId === t.id ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          title="Պահպանել շեմը"
                          aria-label="Պահպանել շեմը"
                          disabled={thresholdMutation.isPending || !/^\d+$/.test(threshold)}
                          onClick={() => thresholdMutation.mutate({ tierId: t.id, thresholdTurnover: Number(threshold) })}
                        >
                          {thresholdMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                        </Button>
                        <Button size="icon" variant="ghost" title="Չեղարկել" aria-label="Չեղարկել" disabled={thresholdMutation.isPending}
                          onClick={() => { setEditingTierId(null); setThreshold(""); thresholdMutation.reset(); }}>
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" title="Փոխել շեմը" aria-label={`${t.name}՝ փոխել շեմը`}
                        onClick={() => { setEditingTierId(t.id); setThreshold(String(t.thresholdTurnover)); thresholdMutation.reset(); }}>
                        <Pencil />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tiers.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={5}><EmptyState title="Մակարդակներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {thresholdMutation.isError && (
        <p role="alert" className="text-sm text-destructive">{thresholdMutation.error.message}</p>
      )}

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
