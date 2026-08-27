"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, StatusPill, Money } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, ShoppingCart, AlertTriangle, Plus, Search } from "lucide-react";

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ClientsModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Հաճախորդներ"
        description="Ֆիզիկական և իրավաբանական անձինք"
        action={
          <Button size="sm" className="gap-2 bg-primary">
            <Plus className="size-4" /> Նոր հաճախորդ
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր հաճախորդներ" value={String(data?.clients?.length ?? 0)} icon={Users} />
        <KpiCard label="Պարտքով հաճախորդներ" value={String(data?.clients?.filter((c: any) => c.currentDebt > 0).length ?? 0)} icon={AlertTriangle} />
        <KpiCard label="Ընդհանուր պարտք" value={fmt(sum(data?.clients, "currentDebt"))} icon={AlertTriangle} />
        <KpiCard label="Ընդհանուր շրջանառություն" value={fmt(sum(data?.clients, "lifetimeTurnover"))} icon={ShoppingCart} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase tracking-wider">Անուն / Ընկերություն</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Հեռախոս</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Կարգավիճակ</TableHead>
                {role !== "WAREHOUSE" && <TableHead className="text-xs uppercase tracking-wider text-right">Պարտք</TableHead>}
                {role === "ADMIN" && <TableHead className="text-xs uppercase tracking-wider text-right">Շրջանառություն</TableHead>}
                <TableHead className="text-xs uppercase tracking-wider text-right">Պատվերներ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.clients?.map((c: any) => (
                <TableRow key={c.id} className="border-hairline hover:bg-muted/40 cursor-pointer">
                  <TableCell className="text-sm font-medium">
                    {c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">{c.phone}</TableCell>
                  <TableCell><StatusPill status={c.status} /></TableCell>
                  {role !== "WAREHOUSE" && (
                    <TableCell className="text-right tabular-nums">
                      {c.currentDebt > 0 ? <span className="text-status-red font-medium">{fmt(c.currentDebt)}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {role === "ADMIN" && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(c.lifetimeTurnover)}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{c.totalOrders}</TableCell>
                </TableRow>
              ))}
              {(!data?.clients || data.clients.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={role === "ADMIN" ? 6 : 5} className="text-center text-sm text-muted-foreground py-12">
                    Հաճախորդներ չկան
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function sum(clients: any[] | undefined, field: string): number {
  if (!clients) return 0;
  return clients.reduce((s, c) => s + (c[field] ?? 0), 0);
}

function fmt(v: number): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
