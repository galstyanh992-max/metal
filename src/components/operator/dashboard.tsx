"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, ShoppingCart, AlertTriangle, Plus, Phone, MessageCircle, Mail } from "lucide-react";

async function fetchData() {
  const [orders, clients] = await Promise.all([
    fetch("/api/orders").then((r) => r.json()),
    fetch("/api/clients").then((r) => r.json()),
  ]);
  return { orders: orders.orders ?? [], clients: clients.clients ?? [] };
}

export function OperatorDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["op-dashboard"], queryFn: fetchData });

  const orders = data?.orders ?? [];
  const clients = data?.clients ?? [];
  const draftOrders = orders.filter((o: any) => o.status === "DRAFT");
  const confirmedOrders = orders.filter((o: any) => o.status === "CONFIRMED");
  const clientsWithDebt = clients.filter((c: any) => c.currentDebt > 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Օպերատորի վահանակ"
        description={new Date().toLocaleDateString("hy-AM", { weekday: "long", day: "numeric", month: "long" })}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Սևագիր պատվերներ" value={String(draftOrders.length)} icon={ShoppingCart} />
        <KpiCard label="Հաստատված" value={String(confirmedOrders.length)} icon={AlertTriangle} />
        <KpiCard label="Հաճախորդներ" value={String(clients.length)} icon={Users} />
        <KpiCard label="Պարտքով հաճախորդներ" value={String(clientsWithDebt.length)} icon={AlertTriangle} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-hairline shadow-none">
          <CardContent className="p-0">
            <div className="p-4 border-b border-hairline flex items-center justify-between">
              <div className="text-sm font-semibold">Ակտիվ պատվերներ</div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                <Plus className="size-3" /> Նոր
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead className="text-xs uppercase">Համար</TableHead>
                  <TableHead className="text-xs uppercase">Հաճախորդ</TableHead>
                  <TableHead className="text-xs uppercase text-right">Գումար</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 6).map((o: any) => (
                  <TableRow key={o.id} className="border-hairline">
                    <TableCell className="text-xs font-mono">{o.number}</TableCell>
                    <TableCell className="text-sm">
                      {o.client?.type === "COMPANY" ? o.client?.companyName : `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{fmt(o.totalAmount)}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={3}><EmptyState title="Պատվերներ չկան" /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-none">
          <CardContent className="p-0">
            <div className="p-4 border-b border-hairline text-sm font-semibold">Պարտքով հաճախորդներ</div>
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead className="text-xs uppercase">Հաճախորդ</TableHead>
                  <TableHead className="text-xs uppercase text-right">Պարտք</TableHead>
                  <TableHead className="text-xs uppercase text-right">Կապ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsWithDebt.slice(0, 6).map((c: any) => (
                  <TableRow key={c.id} className="border-hairline">
                    <TableCell className="text-sm">
                      <div className="font-medium">{c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{c.phone}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-status-red font-medium">{fmt(c.currentDebt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-7"><Phone className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7"><MessageCircle className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7"><Mail className="size-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clientsWithDebt.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={3}><EmptyState title="Պարտքով հաճախորդներ չկան" /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function fmt(v: number): string {
  if (!v) return "—";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
