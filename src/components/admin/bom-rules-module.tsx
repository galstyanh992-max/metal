"use client";

import { useQuery } from "@tanstack/react-query";
import { SectionHeader, EmptyState, KpiCard } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings2, Package, Layers, Calculator } from "lucide-react";

async function fetchBomRules() {
  const res = await fetch("/api/bom/rules");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function BomRulesModule() {
  const { data, isLoading } = useQuery({ queryKey: ["bom-rules"], queryFn: fetchBomRules });

  const rules = data?.rules ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader title="BOM Կանոններ" description="Բաղադրիչների հաշվարկման կանոններ" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր կանոններ" value={String(rules.length)} icon={Settings2} />
        <KpiCard label="Ակտիվ" value={String(rules.filter((r: any) => r.active).length)} icon={Layers} />
        <KpiCard label="Կատեգորիաներ" value={String(new Set(rules.map((r: any) => r.productTypeId)).size)} icon={Package} />
        <KpiCard label="Բաղադրիչներ" value={String(new Set(rules.map((r: any) => r.componentProductId)).size)} icon={Calculator} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Կատեգորիա</TableHead>
                <TableHead className="text-xs uppercase">Բաղադրիչ</TableHead>
                <TableHead className="text-xs uppercase">Ֆորմուլա</TableHead>
                <TableHead className="text-xs uppercase text-right">Գործակից</TableHead>
                <TableHead className="text-xs uppercase text-right">Թափոն</TableHead>
                <TableHead className="text-xs uppercase text-right">Նվազագույն</TableHead>
                <TableHead className="text-xs uppercase">Վերսիա</TableHead>
                <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r: any) => (
                <TableRow key={r.id} className="border-hairline">
                  <TableCell className="text-xs">{r.productTypeId}</TableCell>
                  <TableCell className="text-sm font-medium">{r.componentProduct?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{r.formulaExpr}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.coefficient}</TableCell>
                  <TableCell className="text-right tabular-nums">{(r.waste * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{r.minimum}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">v{r.version}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${r.active ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-muted text-muted-foreground"}`}>
                      {r.active ? "Ակտիվ" : "Պասիվ"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={8}><EmptyState title="BOM կանոններ չկան" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
