"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageCircle, Send, Inbox, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchLogs() {
  const res = await fetch("/api/comms/send");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const STATUS_ICONS: Record<string, any> = {
  SENT: CheckCircle2,
  DELIVERED: CheckCircle2,
  READ: CheckCircle2,
  FAILED: XCircle,
  PENDING: Clock,
};

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-status-green/15 text-status-green border-status-green/30",
  DELIVERED: "bg-status-green/15 text-status-green border-status-green/30",
  READ: "bg-status-green/15 text-status-green border-status-green/30",
  FAILED: "bg-status-red/15 text-status-red border-status-red/30",
  PENDING: "bg-status-yellow/15 text-status-yellow border-status-yellow/30",
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Էլ․ փոստ",
  WHATSAPP: "WhatsApp",
};

export function CommsModule() {
  const { data, isLoading } = useQuery({ queryKey: ["comms"], queryFn: fetchLogs });
  const [sendOpen, setSendOpen] = useState(false);

  const logs = data?.logs ?? [];
  const emailCount = logs.filter((l: any) => l.channel === "EMAIL").length;
  const whatsappCount = logs.filter((l: any) => l.channel === "WHATSAPP").length;
  const failedCount = logs.filter((l: any) => l.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Հաղորդակցություն"
        description="Էլ․ փոստ և WhatsApp"
        action={<Button size="sm" className="gap-2 bg-primary" onClick={() => setSendOpen(true)}><Send className="size-4" /> Նոր հաղորդագրություն</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-hairline p-4 space-y-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Mail className="size-3" /> Էլ․ փոստ
          </div>
          <div className="text-2xl font-semibold tabular-nums">{emailCount}</div>
        </div>
        <div className="bg-card border border-hairline p-4 space-y-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <MessageCircle className="size-3" /> WhatsApp
          </div>
          <div className="text-2xl font-semibold tabular-nums">{whatsappCount}</div>
        </div>
        <div className="bg-card border border-hairline p-4 space-y-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="size-3" /> Ուղարկված
          </div>
          <div className="text-2xl font-semibold tabular-nums">{logs.filter((l: any) => l.status !== "FAILED").length}</div>
        </div>
        <div className="bg-card border border-hairline p-4 space-y-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <XCircle className="size-3" /> Ձախողված
          </div>
          <div className="text-2xl font-semibold tabular-nums text-status-red">{failedCount}</div>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="all" className="text-xs gap-1.5"><Inbox className="size-3.5" /> Բոլորը ({logs.length})</TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1.5"><Mail className="size-3.5" /> Էլ․ փոստ</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs gap-1.5"><MessageCircle className="size-3.5" /> WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <CommsLogTable logs={logs} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <CommsLogTable logs={logs.filter((l: any) => l.channel === "EMAIL")} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <CommsLogTable logs={logs.filter((l: any) => l.channel === "WHATSAPP")} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {sendOpen && <SendDialog onClose={() => setSendOpen(false)} />}
    </div>
  );
}

function CommsLogTable({ logs, isLoading }: { logs: any[]; isLoading: boolean }) {
  if (logs.length === 0 && !isLoading) {
    return <EmptyState title="Հաղորդագրություններ չկան" description="Ուղարկեք նոր հաղորդագրություն՝ սկսելու համար" />;
  }
  return (
    <Card className="border-hairline shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-hairline">
              <TableHead className="text-xs uppercase">Ալիք</TableHead>
              <TableHead className="text-xs uppercase">Հասցեատեր</TableHead>
              <TableHead className="text-xs uppercase">Վերնագիր/Բովանդակություն</TableHead>
              <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
              <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l: any) => {
              const Icon = l.channel === "EMAIL" ? Mail : MessageCircle;
              const StatusIcon = STATUS_ICONS[l.status] ?? Clock;
              const recipient = l.client
                ? (l.client.type === "COMPANY" ? l.client.companyName : `${l.client.firstName} ${l.client.lastName}`)
                : "—";
              return (
                <TableRow key={l.id} className="border-hairline">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="text-xs">{CHANNEL_LABELS[l.channel]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{recipient}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {l.channel === "EMAIL" ? l.client?.email : l.client?.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.subject && <div className="font-medium truncate max-w-xs">{l.subject}</div>}
                    <div className="text-muted-foreground truncate max-w-xs">{l.body}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_COLORS[l.status] ?? ""}`}>
                      <StatusIcon className="size-3 mr-1" />
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("hy-AM")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SendDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [clientId, setClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const selectedClient = clientsData?.clients?.find((c: any) => c.id === clientId);
  const to = channel === "EMAIL" ? selectedClient?.email : selectedClient?.phone;

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/comms/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Հաղորդագրությունը ուղարկված է");
      qc.invalidateQueries({ queryKey: ["comms"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!clientId) { toast.error("Ընտրեք հաճախորդ"); return; }
    if (!to) { toast.error(`Հաճախորդը չունի ${channel === "EMAIL" ? "էլ․ հասցե" : "հեռախոս"}`); return; }
    if (!body) { toast.error("Մուտքագրեք հաղորդագրություն"); return; }
    mutation.mutate({ channel, to, subject: channel === "EMAIL" ? subject : undefined, body, clientId });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Նոր հաղորդագրություն</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Channel toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setChannel("EMAIL")}
              className={`p-3 border flex items-center gap-2.5 transition-colors ${channel === "EMAIL" ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"}`}
            >
              <Mail className={`size-4 ${channel === "EMAIL" ? "text-copper" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">Էլ․ փոստ</span>
            </button>
            <button
              onClick={() => setChannel("WHATSAPP")}
              className={`p-3 border flex items-center gap-2.5 transition-colors ${channel === "WHATSAPP" ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"}`}
            >
              <MessageCircle className={`size-4 ${channel === "WHATSAPP" ? "text-copper" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">WhatsApp</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հաճախորդ</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Ընտրեք հաճախորդ" /></SelectTrigger>
              <SelectContent>
                {clientsData?.clients?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`} — {channel === "EMAIL" ? (c.email || "չկա") : c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {to && (
            <div className="text-xs text-muted-foreground bg-muted/30 border border-hairline p-2">
              Ուղարկել → <span className="font-mono">{to}</span>
            </div>
          )}

          {channel === "EMAIL" && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վերնագիր</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Պատվերի հաստատում" className="focus-steel" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հաղորդագրություն</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={channel === "EMAIL" ? "Բարև ձեզ..." : "Հարգելի հաճախորդ..."}
              rows={6}
              className="focus-steel resize-none"
            />
          </div>

          <div className="text-[10px] text-muted-foreground bg-muted/20 border border-hairline p-2 flex items-center gap-2">
            <Send className="size-3 text-copper shrink-0" />
            {channel === "EMAIL"
              ? "Էլ․ փոստը կուղարկվի SMTP-ով (կամ stub ռեժիմում եթե կրեդենցիալներ չկան)"
              : "WhatsApp-ը կուղարկվի WhatsApp Business API-ով (կամ stub ռեժիմում)"}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            <Send className="size-4" />
            Ուղարկել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
