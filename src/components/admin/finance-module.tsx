"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, TrendingUp, AlertTriangle, Plus, Loader2, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchPayments() {
  const res = await fetch("/api/payments");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchOrders() {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const METHOD_LABELS: Record<string, string> = {
  bank: "Բանկային փոխանցում",
  card: "Քարտ",
  contract: "Պայմանագրային",
};

export function FinanceModule({ role }: { role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["payments"], queryFn: fetchPayments });
  const { data: ordersData } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const [payForOrder, setPayForOrder] = useState<string | null>(null);

  const payments = data?.payments ?? [];
  const totalCollected = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const unpaidOrders = (ordersData?.orders ?? []).filter((o: any) => o.outstandingAmount > 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Ֆինանսներ" description="Վճարումներ և պարտքեր" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր վճարումներ" value={String(payments.length)} icon={Receipt} />
        <KpiCard label="Ընդհանուր գանձում" value={fmt(totalCollected)} icon={Wallet} />
        <KpiCard label="Չվճարված պատվերներ" value={String(unpaidOrders.length)} icon={AlertTriangle} />
        <KpiCard label="Չվճարված գումար" value={fmt(unpaidOrders.reduce((s: number, o: any) => s + o.outstandingAmount, 0))} icon={AlertTriangle} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-hairline shadow-none">
          <CardContent className="p-0">
            <div className="p-4 border-b border-hairline text-sm font-semibold flex items-center justify-between">
              <span>Չվճարված պատվերներ</span>
              <Badge variant="outline" className="text-[10px]">{unpaidOrders.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead className="text-xs uppercase">Պատվեր</TableHead>
                  <TableHead className="text-xs uppercase text-right">Մնացորդ</TableHead>
                  <TableHead className="text-xs uppercase text-right">Գործողություն</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidOrders.slice(0, 8).map((o: any) => (
                  <TableRow key={o.id} className="border-hairline">
                    <TableCell className="text-xs font-mono">{o.number}</TableCell>
                    <TableCell className="text-right tabular-nums text-status-red font-medium">{fmt(o.outstandingAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setPayForOrder(o.id)}>
                        <Plus className="size-3" /> Վճարել
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {unpaidOrders.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={3}><EmptyState title="Չվճարված պատվերներ չկան" /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-none">
          <CardContent className="p-0">
            <div className="p-4 border-b border-hairline text-sm font-semibold">Վերջին վճարումներ</div>
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead className="text-xs uppercase">Պատվեր</TableHead>
                  <TableHead className="text-xs uppercase">Մեթոդ</TableHead>
                  <TableHead className="text-xs uppercase text-right">Գումար</TableHead>
                  <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 8).map((p: any) => (
                  <TableRow key={p.id} className="border-hairline">
                    <TableCell className="text-xs font-mono">{p.order?.number ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{METHOD_LABELS[p.method] ?? p.method}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(p.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("hy-AM")}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={4}><EmptyState title="Վճարումներ չկան" /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {payForOrder && (
        <PaymentDialog orderId={payForOrder} onClose={() => setPayForOrder(null)} />
      )}
    </div>
  );
}

function PaymentDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Վճարումը գրանցված է");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "admin"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!amount || Number(amount) <= 0) { toast.error("Մուտքագրեք գումարը"); return; }
    mutation.mutate({ orderId, amount: Number(amount), method, note });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Վճարում գրանցել</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Գումար (դր) *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="focus-steel tabular-nums text-lg" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Մեթոդ</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Բանկային փոխանցում</SelectItem>
                <SelectItem value="card">Քարտ</SelectItem>
                <SelectItem value="contract">Պայմանագրային</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նշում</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="focus-steel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Գրանցել վճարում
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmt(v: number): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
