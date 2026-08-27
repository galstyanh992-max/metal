"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Activity, ScrollText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

async function fetchUsers() {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchAudit() {
  const res = await fetch("/api/audit");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Ադմինիստրատոր",
  OPERATOR: "Օպերատոր",
  WAREHOUSE: "Պահեստապետ",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-copper/15 text-copper border-copper/30",
  OPERATOR: "bg-status-green/15 text-status-green border-status-green/30",
  WAREHOUSE: "bg-steel/15 text-steel border-steel/30",
};

export function SettingsModule() {
  const { data: usersData, isLoading: usersLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const { data: auditData, isLoading: auditLoading } = useQuery({ queryKey: ["audit"], queryFn: fetchAudit });

  const users = usersData?.users ?? [];
  const logs = auditData?.logs ?? [];
  const adminCount = users.filter((u: any) => u.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Կարգավորումներ" description="Օգտատերեր և աուդիտի մատյան" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր օգտատերեր" value={String(users.length)} icon={Users} />
        <KpiCard label="Ադմիններ" value={String(adminCount)} icon={Shield} sub={adminCount >= 2 ? "Մինիմում 2 բավարարված է" : "Պահանջվում է մինիմում 2"} />
        <KpiCard label="Աուդիտի գրառումներ" value={String(logs.length)} icon={ScrollText} />
        <KpiCard label="Ակտիվություն" value={String(logs.filter((l: any) => new Date(l.at) > new Date(Date.now() - 24 * 3600 * 1000)).length)} icon={Activity} sub="Վերջին 24 ժամ" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="users" className="text-xs">Օգտատերեր</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs">Աուդիտի մատյան</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="border-hairline shadow-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-hairline">
                    <TableHead className="text-xs uppercase">Անուն</TableHead>
                    <TableHead className="text-xs uppercase">Էլ․ հասցե</TableHead>
                    <TableHead className="text-xs uppercase">Դեր</TableHead>
                    <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
                    <TableHead className="text-xs uppercase">Վերջին մուտք</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id} className="border-hairline">
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <div className="size-7 bg-muted flex items-center justify-center text-xs">{u.name.charAt(0)}</div>
                          {u.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase ${ROLE_COLORS[u.role] ?? ""}`}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase ${u.active ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-muted text-muted-foreground"}`}>
                          {u.active ? "Ակտիվ" : "Պասիվ"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("hy-AM") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && !usersLoading && (
                    <TableRow><TableCell colSpan={5}><EmptyState title="Օգտատերեր չկան" /></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="border-hairline shadow-none">
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow className="border-hairline">
                      <TableHead className="text-xs uppercase">Գործողություն</TableHead>
                      <TableHead className="text-xs uppercase">Օգտատեր</TableHead>
                      <TableHead className="text-xs uppercase">Տիպ</TableHead>
                      <TableHead className="text-xs uppercase">ID</TableHead>
                      <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l: any) => (
                      <TableRow key={l.id} className="border-hairline">
                        <TableCell className="text-xs font-mono">{l.action}</TableCell>
                        <TableCell className="text-sm">{l.actor?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.entityType}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{l.entityId?.slice(-8) ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.at).toLocaleString("hy-AM")}</TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && !auditLoading && (
                      <TableRow><TableCell colSpan={5}><EmptyState title="Աուդիտի գրառումներ չկան" /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
