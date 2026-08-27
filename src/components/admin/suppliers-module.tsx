"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState, KpiCard } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Truck, Phone, Mail, Building2, Loader2, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function SuppliersModule() {
  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const [createOpen, setCreateOpen] = useState(false);

  const suppliers = data?.suppliers ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Մատակարարներ"
        description="Մատակարարների կառավարում"
        action={<Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Նոր մատակարար</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <KpiCard label="Ընդհանուր" value={String(suppliers.length)} icon={Truck} />
        <KpiCard label="Ակտիվ" value={String(suppliers.filter((s: any) => s.active).length)} icon={Building2} />
        <KpiCard label="Ապրանքներ" value={String(suppliers.reduce((s: number, sup: any) => s + (sup._count?.products ?? 0), 0))} icon={Plus} />
        <KpiCard label="Պատվերներ" value={String(suppliers.reduce((s: number, sup: any) => s + (sup._count?.purchaseOrders ?? 0), 0))} icon={FileText} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Անվանում</TableHead>
                <TableHead className="text-xs uppercase">Հեռախոս</TableHead>
                <TableHead className="text-xs uppercase">Էլ․ հասցե</TableHead>
                <TableHead className="text-xs uppercase">ՀՎՀՀ</TableHead>
                <TableHead className="text-xs uppercase text-right">Ապրանքներ</TableHead>
                <TableHead className="text-xs uppercase text-right">PO</TableHead>
                <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s: any) => (
                <TableRow key={s.id} className="border-hairline hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-7 bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                        <Building2 className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{s.name}</div>
                        {s.paymentTerms && <div className="text-[10px] text-muted-foreground">{s.paymentTerms}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {s.phone && <div className="flex items-center gap-1"><Phone className="size-3 text-muted-foreground" /> {s.phone}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.email && <div className="flex items-center gap-1"><Mail className="size-3 text-muted-foreground" /> {s.email}</div>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{s.taxId ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s._count?.products ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s._count?.purchaseOrders ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${s.active ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-muted text-muted-foreground"}`}>
                      {s.active ? "Ակտիվ" : "Պասիվ"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={7}><EmptyState title="Մատակարարներ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && <CreateSupplierDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateSupplierDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Մատակարարը ստեղծված է");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!name) { toast.error("Մուտքագրեք անվանումը"); return; }
    mutation.mutate({ name, taxId, phone, email, legalAddress, paymentTerms });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Նոր մատակարար</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անվանում *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ArmProfile LLC" className="focus-steel" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հեռախոս</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+374 10 555 555" className="focus-steel tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Էլ․ հասցե</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="focus-steel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">ՀՎՀՀ</Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="focus-steel font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վճարման պայմաններ</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="30 օր" className="focus-steel" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Իրավական հասցե</Label>
            <Input value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} className="focus-steel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Ստեղծել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
