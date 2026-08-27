"use client";

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, MapPin, MessageCircle, Crown, Receipt, ShoppingBag, TrendingUp, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/shared/primitives";

async function fetchClient(id: string) {
  const res = await fetch(`/api/clients/${id}`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ClientDetailDrawer({ clientId, open, onClose, role }: { clientId: string | null; open: boolean; onClose: () => void; role: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient(clientId!),
    enabled: !!clientId && open,
  });

  const client = data?.client;
  if (!client) return null;

  const fp = client.financialProfile ?? {};
  const name = client.type === "COMPANY" ? client.companyName : `${client.firstName} ${client.lastName}`;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-hairline space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-muted flex items-center justify-center text-sm font-semibold">
                {client.type === "COMPANY" ? "Ը" : (client.firstName?.[0] ?? "?")}
              </div>
              <div>
                <SheetTitle className="text-base">{name}</SheetTitle>
                <div className="text-xs text-muted-foreground">
                  {client.type === "COMPANY" ? "Իրավաբանական անձ" : "Ֆիզիկական անձ"}
                  {client.loyaltyTier && <span> · <Crown className="size-3 inline text-copper" /> {client.loyaltyTier.name}</span>}
                </div>
              </div>
            </div>
            <StatusPill status={client.status} />
          </div>
        </SheetHeader>

        <div className="p-4 space-y-5">
          {/* Contact */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Կոնտակտային տվյալներ</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ContactItem icon={Phone} label="Հեռախոս" value={client.phone} />
              {client.email && <ContactItem icon={Mail} label="Էլ․ հասցե" value={client.email} />}
              {client.primaryAddress && <ContactItem icon={MapPin} label="Հասցե" value={client.primaryAddress} />}
              <ContactItem icon={MessageCircle} label="Նախընտրելի կապ" value={client.preferredChannel === "whatsapp" ? "WhatsApp" : client.preferredChannel === "email" ? "Էլ․ փոստ" : "Հեռախոս"} />
              {client.type === "COMPANY" && client.taxId && <ContactItem icon={Receipt} label="ՀՎՀՀ" value={client.taxId} />}
            </div>
          </div>

          {/* Financial profile */}
          {role !== "WAREHOUSE" && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                <TrendingUp className="size-3.5" /> Ֆինանսական պրոֆիլ
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Շրջանառություն" value={fmt(fp.lifetimeTurnover)} icon={ShoppingBag} />
                <Stat label="Վճարված" value={fmt(fp.totalPaid)} icon={Receipt} accent="green" />
                <Stat label="Պարտք" value={fmt(fp.currentDebt)} icon={AlertTriangle} accent={fp.currentDebt > 0 ? "red" : "green"} />
                <Stat label="Պատվերներ" value={String(fp.totalOrders ?? 0)} icon={ShoppingBag} />
                <Stat label="Միջին պատվեր" value={fmt(fp.avgOrderValue)} icon={TrendingUp} />
                {client.creditLimit > 0 && (
                  <Stat label="Վարկային սահմանաչափ" value={fmt(client.creditLimit)} icon={Receipt} sub={`${fp.creditUtilization ?? 0}% օգտագործված`} />
                )}
                {role === "ADMIN" && fp.grossProfit !== undefined && (
                  <Stat label="Շահույթ" value={fmt(fp.grossProfit)} icon={TrendingUp} accent="green" />
                )}
                {role === "ADMIN" && fp.totalCost !== undefined && (
                  <Stat label="Արժեք" value={fmt(fp.totalCost)} icon={Receipt} />
                )}
              </div>
              {client.creditLimit > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${fp.creditUtilization > 90 ? "bg-status-red" : fp.creditUtilization > 70 ? "bg-status-orange" : "bg-status-green"}`}
                      style={{ width: `${Math.min(100, fp.creditUtilization)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Orders */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Պատվերների պատմություն</h4>
            {client.orders?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-hairline">
                    <TableHead className="text-xs uppercase">Համար</TableHead>
                    <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
                    {role !== "WAREHOUSE" && <TableHead className="text-xs uppercase text-right">Գումար</TableHead>}
                    {role !== "WAREHOUSE" && <TableHead className="text-xs uppercase text-right">Մնացորդ</TableHead>}
                    <TableHead className="text-xs uppercase">Ամսաթիվ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.orders.map((o: any) => (
                    <TableRow key={o.id} className="border-hairline">
                      <TableCell className="text-xs font-mono">{o.number}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{o.status}</Badge></TableCell>
                      {role !== "WAREHOUSE" && <TableCell className="text-right tabular-nums text-xs">{fmt(o.totalAmount)}</TableCell>}
                      {role !== "WAREHOUSE" && <TableCell className="text-right tabular-nums text-xs">{o.outstandingAmount > 0 ? <span className="text-status-red">{fmt(o.outstandingAmount)}</span> : "—"}</TableCell>}
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("hy-AM")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-xs text-muted-foreground py-3 border border-dashed border-hairline text-center">Պատվերներ չկան</div>
            )}
          </div>

          {/* Comments */}
          {client.comments?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Նշումներ</h4>
              <div className="space-y-2">
                {client.comments.map((c: any) => (
                  <div key={c.id} className="bg-muted/30 border border-hairline p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">{c.author?.name} · {new Date(c.createdAt).toLocaleDateString("hy-AM")}</div>
                    <div className="text-sm">{c.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContactItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 border border-hairline">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent, sub }: { label: string; value: string; icon: any; accent?: "green" | "red" | "copper"; sub?: string }) {
  const color = accent === "green" ? "text-status-green" : accent === "red" ? "text-status-red" : accent === "copper" ? "text-copper" : "";
  return (
    <div className="bg-muted/30 border border-hairline p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className={`text-sm tabular-nums font-medium mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (!v) return "0 դր";
  return new Intl.NumberFormat("hy-AM").format(v) + " դր";
}
