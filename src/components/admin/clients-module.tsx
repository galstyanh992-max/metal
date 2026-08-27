"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, StatusPill, Money } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, ShoppingCart, AlertTriangle, Plus, Search } from "lucide-react";
import { useState } from "react";
import { ClientCreateDialog } from "./client-create-dialog";

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ClientsModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const clients = (data?.clients ?? []).filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`;
    return name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Հաճախորդներ"
        description="Ֆիզիկական և իրավաբանական անձինք"
        action={
          <Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}>
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

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Որոնում՝ անուն, հեռախոս, էլ․ հասցե…"
            className="pl-9 focus-steel"
          />
        </div>
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
              {clients.map((c: any) => (
                <TableRow key={c.id} className="border-hairline hover:bg-muted/40 cursor-pointer">
                  <TableCell className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div className="size-7 bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                        {c.type === "COMPANY" ? "Ը" : (c.firstName?.[0] ?? "?")}
                      </div>
                      <div>
                        <div>{c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`}</div>
                        {c.type === "COMPANY" && c.taxId && <div className="text-[10px] text-muted-foreground font-mono">ՀՎՀՀ {c.taxId}</div>}
                      </div>
                    </div>
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
              {clients.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={role === "ADMIN" ? 6 : 5} className="text-center text-sm text-muted-foreground py-12">
                    {search ? "Որոնման արդյունքներ չկան" : "Հաճախորդներ չկան"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClientCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
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
