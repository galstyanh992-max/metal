"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, Plus, Loader2, Calculator, FileWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchTax() {
  const res = await fetch("/api/tax");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const TYPE_LABELS: Record<string, string> = {
  VAT: "ԱԱՀ",
  TURNOVER: "Շրջանառության հարկ",
  PROFIT: "Շահութահարկ",
  PAYROLL: "Աշխատավարձային",
  IMPORT: "Ներմուծման",
  FISCAL_DOCUMENT: "Ֆիսկալ փաստաթուղթ",
  OTHER: "Այլ",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-status-green/15 text-status-green border-status-green/30",
  SUPERSEDED: "bg-status-orange/15 text-status-orange border-status-orange/30",
  RETIRED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Սևագիր",
  ACTIVE: "Ակտիվ",
  SUPERSEDED: "Փոխարինված",
  RETIRED: "Հանված",
};

export function TaxModule() {
  const { data, isLoading } = useQuery({ queryKey: ["tax"], queryFn: fetchTax });
  const [createOpen, setCreateOpen] = useState(false);

  const rules = data?.rules ?? [];
  const profile = data?.profile;
  const activeCount = rules.filter((r: any) => r.status === "ACTIVE").length;
  const draftCount = rules.filter((r: any) => r.status === "DRAFT").length;
  const isProfileUnknown = !profile?.verifiedAt;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Հարկային շարժիչ"
        description="Վերսիոնվող հարկային կանոններ — Հայաստան"
        action={<Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Կանոն</Button>}
      />

      {/* Profile warning */}
      {isProfileUnknown && (
        <Card className="border-status-orange/30 bg-status-orange/5 shadow-none">
          <CardContent className="p-4 flex items-start gap-3">
            <FileWarning className="size-5 text-status-orange shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-status-orange">Հարկային պրոֆիլը հաստատված չէ</div>
              <div className="text-xs text-muted-foreground">
                Ընկերության իրավական ձևը, ԱԱՀ կարգավիճակը, շրջանառությունը և հարկային ռեժիմը հայտնի չեն։
                Հարկային շարժիչը չի կարող համարվել production-ready մինչև պրոֆիլի հաստատումը։
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր կանոններ" value={String(rules.length)} icon={Calculator} />
        <KpiCard label="Ակտիվ" value={String(activeCount)} icon={Calculator} />
        <KpiCard label="Սևագիր" value={String(draftCount)} icon={AlertTriangle} />
        <KpiCard label="Պրոֆիլ" value={isProfileUnknown ? "ԱՆՀԱՅՏ" : "ՀԱՍՏԱՏՎԱԾ"} icon={ShieldAlert} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Անվանում</TableHead>
                <TableHead className="text-xs uppercase">Տեսակ</TableHead>
                <TableHead className="text-xs uppercase">Ռեժիմ</TableHead>
                <TableHead className="text-xs uppercase text-right">Տոկոս</TableHead>
                <TableHead className="text-xs uppercase">Վերսիա</TableHead>
                <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r: any) => (
                <TableRow key={r.id} className="border-hairline">
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{TYPE_LABELS[r.type] ?? r.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.regime}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.rate}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">v{r.version}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_COLORS[r.status] ?? ""}`}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={6}><EmptyState title="Հարկային կանոններ չկան" description="Ստեղծեք նոր կանոն՝ սկսելու համար" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && <CreateRuleDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateRuleDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("VAT");
  const [rate, setRate] = useState("0");

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/tax", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => { toast.success("Հարկային կանոնը ստեղծված է (Սևագիր կարգավիճակում)"); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!name) { toast.error("Մուտքագրեք անվանումը"); return; }
    mutation.mutate({ name, type, rate: Number(rate) || 0 });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Նոր հարկային կանոն</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անվանում *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="focus-steel" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Տեսակ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Տոկոս (%)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="focus-steel tabular-nums" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Ստեղծել (սևագիր)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
