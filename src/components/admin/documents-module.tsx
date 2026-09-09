"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { FileText, FilePlus, FileCheck, Download, Eye, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/export/excel";

async function fetchTemplates() {
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER_ORDER: "Հաճախորդի պատվեր",
  WAREHOUSE_ORDER: "Պահեստի հանձնարարական",
  INVOICE: "Հաշիվ-ապրանքագիր",
  PAYMENT_RECEIPT: "Վճարման անդորրագիր",
  DEBT_STATEMENT: "Պարտքի տեղեկագիր",
  DELIVERY_NOTE: "Հանձնման ակտ",
  PROCUREMENT_DOCUMENT: "Գնման փաստաթուղթ",
};

export function DocumentsModule() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["documents"], queryFn: fetchTemplates });
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [editTemplate, setEditTemplate] = useState<any>(null);

  const templates = data?.templates ?? [];
  const generated = data?.generated ?? [];

  const toggleMutation = useMutation({
    mutationFn: async (t: any) => {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: t.id, active: !t.active }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Կարգավիճակը թարմացված է");
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Փաստաթղթեր" description="Շաբլոններ և գեներացված փաստաթղթեր" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Շաբլոններ" value={String(templates.length)} icon={FileText} />
        <KpiCard label="Գեներացված" value={String(generated.length)} icon={FileCheck} />
        <KpiCard label="Ակտիվ շաբլոններ" value={String(templates.filter((t: any) => t.active).length)} icon={FilePlus} />
        <KpiCard label="Ամսական" value={String(generated.filter((g: any) => new Date(g.generatedAt) > new Date(Date.now() - 30 * 86400000)).length)} icon={FileText} />
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="size-3.5" /> Շաբլոններ</TabsTrigger>
          <TabsTrigger value="generated" className="gap-1.5"><FileCheck className="size-3.5" /> Գեներացված</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card className="border-hairline shadow-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-hairline">
                      <TableHead className="text-xs uppercase">Տեսակ</TableHead>
                      <TableHead className="text-xs uppercase">Անվանում</TableHead>
                      <TableHead className="text-xs uppercase">Վերսիա</TableHead>
                      <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
                      <TableHead className="text-xs uppercase text-right">Գործողություն</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t: any) => (
                      <TableRow key={t.id} className="border-hairline">
                        <TableCell><Badge variant="outline" className="text-[10px]">{TYPE_LABELS[t.type] ?? t.type}</Badge></TableCell>
                        <TableCell className="text-sm font-medium">{t.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">v{t.version}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleMutation.mutate(t)}
                            disabled={toggleMutation.isPending}
                            className="inline-flex items-center gap-1.5"
                            title="Փոխել կարգավիճակը"
                          >
                            <Badge variant="outline" className={`text-[10px] uppercase ${t.active ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-muted text-muted-foreground"}`}>
                              {t.active ? "Ակտիվ" : "Պասիվ"}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => setPreviewTemplate(t)}
                            >
                              <Eye className="size-3.5" /> Նախադիտել
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => setEditTemplate(t)}
                            >
                              <Pencil className="size-3.5" /> Խմբագրել
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {templates.length === 0 && !isLoading && (
                      <TableRow><TableCell colSpan={5}><EmptyState title="Շաբլոններ չկան" /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generated" className="mt-4">
          <Card className="border-hairline shadow-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-hairline">
                      <TableHead className="text-xs uppercase">Տեսակ</TableHead>
                      <TableHead className="text-xs uppercase">Սուբյեկտ</TableHead>
                      <TableHead className="text-xs uppercase">Ստեղծող</TableHead>
                      <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                      <TableHead className="text-xs uppercase text-right">Գործողություն</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generated.map((g: any) => (
                      <TableRow key={g.id} className="border-hairline">
                        <TableCell><Badge variant="outline" className="text-[10px]">{TYPE_LABELS[g.type] ?? g.type}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{g.entityType} · {g.entityId.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{g.generatedBy?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(g.generatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" asChild>
                            <a href={g.url} target="_blank" rel="noopener">
                              <Download className="size-3.5" /> Բացել
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {generated.length === 0 && (
                      <TableRow><TableCell colSpan={5}><EmptyState title="Գեներացված փաստաթղթեր չկան" /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              {previewTemplate?.name ?? "Շաբլոն"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {previewTemplate ? (
                <>
                  {TYPE_LABELS[previewTemplate.type] ?? previewTemplate.type}
                  <span className="text-muted-foreground">· v{previewTemplate.version}</span>
                </>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-hairline bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono">
              {previewTemplate?.bodyTemplate ?? ""}
            </pre>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Փակել</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editTemplate && (
        <EditTemplateDialog template={editTemplate} onClose={() => setEditTemplate(null)} />
      )}
    </div>
  );
}

function EditTemplateDialog({ template, onClose }: { template: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(template.name);
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate ?? "");
  const [active, setActive] = useState(template.active);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Շաբլոնը թարմացված է");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!name.trim()) { toast.error("Մուտքագրեք անվանումը"); return; }
    mutation.mutate({ id: template.id, name, bodyTemplate, active });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" /> Խմբագրել շաբլոնը
          </DialogTitle>
          <DialogDescription>
            {TYPE_LABELS[template.type] ?? template.type} · v{template.version}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անվանում</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="focus-steel" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Բովանդակություն ({"{{placeholder}}"} փոփոխականներով)</Label>
            <Textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={14}
              className="focus-steel font-mono text-xs leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground">
              Հասանելի փոփոխականներ՝ {"{{clientName}}"}, {"{{orderNumber}}"}, {"{{date}}"}, {"{{items}}"}, {"{{total}}"}, {"{{tax}}"}, {"{{amount}}"}, {"{{method}}"}, {"{{address}}"}, {"{{phone}}"}, {"{{taxId}}"}, {"{{totalDebt}}"}, {"{{totalPaid}}"}, {"{{dueDate}}"}, {"{{supplierName}}"}, {"{{supplierTaxId}}"}
            </p>
          </div>
          <div className="flex items-center gap-2 p-2 border border-hairline rounded-md">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="text-xs cursor-pointer" onClick={() => setActive(!active)}>Ակտիվ շաբլոն</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Պահպանել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
