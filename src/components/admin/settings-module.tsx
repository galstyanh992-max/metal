"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KpiCard, SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Shield, Activity, ScrollText, Key, Mail, Pencil, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

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
  const [editUser, setEditUser] = useState<any | null>(null);

  const users = usersData?.users ?? [];
  const logs = auditData?.logs ?? [];
  const adminCount = users.filter((u: any) => u.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Կարգավորումներ" description="Օգտատերեր, աուդիտի մատյան և անվտանգություն" />

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
                    <TableHead className="text-xs uppercase">Էլ․ հասցե (Login)</TableHead>
                    <TableHead className="text-xs uppercase">Դեր</TableHead>
                    <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
                    <TableHead className="text-xs uppercase">Վերջին մուտք</TableHead>
                    <TableHead className="text-xs uppercase text-right">Գործողություն</TableHead>
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
                      <TableCell className="text-xs text-muted-foreground font-mono">{u.email}</TableCell>
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
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => setEditUser(u)}
                        >
                          <Key className="size-3.5" /> Փոխել
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && !usersLoading && (
                    <TableRow><TableCell colSpan={6}><EmptyState title="Օգտատերեր չկան" /></TableCell></TableRow>
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
                      <TableHead className="text-xs uppercase">Ամսաթիգ</TableHead>
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

      {/* User edit dialog */}
      {editUser && <UserEditDialog user={editUser} onClose={() => setEditUser(null)} />}
    </div>
  );
}

function UserEditDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [active, setActive] = useState(user.active);
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Օգտատիրոջ տվյալները թարմացված են");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (password && password !== passwordConfirm) {
      toast.error("Գաղտնաբառերը չեն համընկնում");
      return;
    }
    if (password && password.length < 4) {
      toast.error("Գաղտնաբառը պետք է ունենա առնվազն 4 նիշ");
      return;
    }
    mutation.mutate({
      userId: user.id,
      email,
      name,
      password: password || undefined,
      active,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            Խմբագրել օգտատիրոջը
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-2 bg-muted/30 border border-hairline text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Դեր՝</span>
              <Badge variant="outline" className={`text-[10px] uppercase ${ROLE_COLORS[user.role] ?? ""}`}>
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անուն</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="focus-steel" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Mail className="size-3" /> Էլ․ հասցե (Login)
            </Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="focus-steel font-mono" />
          </div>

          <div className="pt-2 border-t border-hairline">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Key className="size-3" /> Նոր գաղտնաբառ
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
              Թողեք դատարկ՝ գաղտնաբառը չփոխելու համար
            </p>
            <div className="space-y-2">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Նոր գաղտնաբառ"
                className="focus-steel"
              />
              <Input
                type={showPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Կրկնել գաղտնաբառը"
                className="focus-steel"
              />
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                <span>Ցույց տալ գաղտնաբառը</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none pt-2 border-t border-hairline">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            <span>Օգտատերը ակտիվ է</span>
          </label>
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
