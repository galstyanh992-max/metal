"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FilePlus, FileCheck, Download } from "lucide-react";
import { db } from "@/lib/db";

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
  const { data, isLoading } = useQuery({ queryKey: ["documents"], queryFn: fetchTemplates });

  const templates = data?.templates ?? [];
  const generated = data?.generated ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader title="Փաստաթղթեր" description="Շաբլոններ և գեներացված փաստաթղթեր" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Շաբլոններ" value={String(templates.length)} icon={FileText} />
        <KpiCard label="Գեներացված" value={String(generated.length)} icon={FileCheck} />
        <KpiCard label="Ակտիվ շաբլոններ" value={String(templates.filter((t: any) => t.active).length)} icon={FilePlus} />
        <KpiCard label="Ամսական" value={String(generated.filter((g: any) => new Date(g.generatedAt) > new Date(Date.now() - 30 * 86400000)).length)} icon={FileText} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <div className="p-4 border-b border-hairline text-sm font-semibold flex items-center gap-2">
            <FileText className="size-4" /> Շաբլոններ
          </div>
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
                    <Badge variant="outline" className={`text-[10px] uppercase ${t.active ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-muted text-muted-foreground"}`}>
                      {t.active ? "Ակտիվ" : "Պասիվ"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5">
                      <Download className="size-3.5" /> Նախադիտել
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={5}><EmptyState title="Շաբլոններ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
