"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuickFillPanel, quickFillRowsToOrderItems, type QuickFillRow, type QuickFillTotals } from "./quick-fill-panel";

export function ClientCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("whatsapp");
  const [creditLimit, setCreditLimit] = useState("0");

  // Inline Quick-Fill for new order — open by default
  const [showOrderSection, setShowOrderSection] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"debt" | "cash" | "transfer">("debt");
  const [savePrices, setSavePrices] = useState(true);
  const [rows, setRows] = useState<QuickFillRow[]>([]);
  const [totals, setTotals] = useState<QuickFillTotals>({
    totalQty: 0, totalMeterage: 0, totalAmount: 0, selectedCount: 0, priceChanges: 0,
  });
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const qc = useQueryClient();

  const createClientMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json();
        throw Object.assign(new Error(e.error ?? "failed"), { stockError: e.stockError, details: e.details });
      }
      return res.json();
    },
    onError: (e: any) => {
      if (e?.stockError && e?.details) {
        toast.error(`Պահեստի սխալ՝ ${e.details.length} ապրանք`);
      } else {
        toast.error(e?.message ?? "Պատվերի սխալ");
      }
    },
  });

  const reset = () => {
    setFirstName(""); setLastName(""); setCompanyName(""); setTaxId("");
    setPhone(""); setEmail(""); setPrimaryAddress(""); setCreditLimit("0");
    setCreatedClientId(null);
    setShowOrderSection(false);
  };

  const submit = async () => {
    if (!phone) { toast.error("Հեռախոսը պարտադիր է"); return; }
    if (type === "INDIVIDUAL" && (!firstName || !lastName)) { toast.error("Անուն և Ազգանունը պարտադիր են"); return; }
    if (type === "COMPANY" && !companyName) { toast.error("Ընկերության անվանումը պարտադիր է"); return; }

    try {
      const data = await createClientMutation.mutateAsync({
        type,
        firstName, lastName,
        companyName: type === "COMPANY" ? companyName : undefined,
        taxId: type === "COMPANY" ? taxId : undefined,
        phone, email, primaryAddress,
        preferredChannel,
        creditLimit: Number(creditLimit) || 0,
      });
      const newClientId = data.client.id;
      setCreatedClientId(newClientId);
      toast.success("Հաճախորդը ստեղծված է");
      qc.invalidateQueries({ queryKey: ["clients"] });

      // If user has selected products, create order immediately
      const orderItems = quickFillRowsToOrderItems(rows);
      if (orderItems.length > 0 && showOrderSection) {
        try {
          const orderData: any = await createOrderMutation.mutateAsync({
            clientId: newClientId,
            items: orderItems,
            savePrices,
            paymentMethod,
          });
          const msg = orderData?.priceUpdates > 0
            ? `Հաճախորդ և պատվեր ստեղծված են · ${orderData.priceUpdates} գին պահպանված է`
            : "Հաճախորդ և պատվեր ստեղծված են";
          toast.success(msg);
          qc.invalidateQueries({ queryKey: ["orders"] });
          reset();
          onCreated?.();
          onClose();
        } catch (e: any) {
          // Order failed but client was created — keep dialog open so user can retry
          console.error("Order creation failed:", e);
        }
      } else {
        // No order items — just close or keep open showing client created
        // Stay open so user can fill order if they want
      }
    } catch (e: any) {
      // toast already shown in onError
    }
  };

  // (single submit() handles both client + order creation)

  const clientName = createdClientId
    ? (type === "COMPANY" ? companyName : `${firstName} ${lastName}`)
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[2200px] w-[99vw] max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-hairline bg-card shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="size-5 text-primary" />
            Նոր հաճախորդ
            {createdClientId && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-sm font-normal text-status-green">
                <span className="size-2 rounded-full bg-status-green" />
                Ստեղծված է
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("INDIVIDUAL")}
                disabled={!!createdClientId}
                className={`p-3 border flex items-center gap-3 transition-colors ${type === "INDIVIDUAL" ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"} ${createdClientId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <User className={`size-5 ${type === "INDIVIDUAL" ? "text-copper" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <div className="text-sm font-medium">Ֆիզիկական անձ</div>
                  <div className="text-xs text-muted-foreground">Անհատ հաճախորդ</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType("COMPANY")}
                disabled={!!createdClientId}
                className={`p-3 border flex items-center gap-3 transition-colors ${type === "COMPANY" ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"} ${createdClientId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Building2 className={`size-5 ${type === "COMPANY" ? "text-copper" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <div className="text-sm font-medium">Իրավաբանական անձ</div>
                  <div className="text-xs text-muted-foreground">Ընկերություն</div>
                </div>
              </button>
            </div>

            {/* Personal / Company fields */}
            {type === "INDIVIDUAL" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անուն *</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!!createdClientId} className="focus-steel" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ազգանուն *</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!!createdClientId} className="focus-steel" />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ընկերության անվանում *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!!createdClientId} className="focus-steel" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">ՀՎՀՀ (հարկային)</Label>
                    <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} disabled={!!createdClientId} className="focus-steel tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վարկային սահմանաչափ (դր)</Label>
                    <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} disabled={!!createdClientId} className="focus-steel tabular-nums" />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հեռախոս *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!!createdClientId} placeholder="+374 99 123456" className="focus-steel tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Էլ․ հասցե</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!createdClientId} className="focus-steel" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հասցե</Label>
              <Textarea value={primaryAddress} onChange={(e) => setPrimaryAddress(e.target.value)} disabled={!!createdClientId} rows={2} className="focus-steel resize-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նախընտրելի կապի միջոց</Label>
              <Select value={preferredChannel} onValueChange={setPreferredChannel} disabled={!!createdClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Էլ․ փոստ</SelectItem>
                  <SelectItem value="phone">Հեռախոս</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order section — shown immediately (not after client creation) */}
            <div className="pt-4 border-t-2 border-primary/30">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {createdClientId ? (
                    <>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Հաճախորդ՝</span>
                      <span className="text-sm font-semibold">{clientName}</span>
                      <span className="text-xs text-muted-foreground">· {phone}</span>
                    </>
                  ) : (
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Պատվերի մուտքագրում — կպահպանվի հաճախորդի ստեղծումից հետո
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowOrderSection((v) => !v)}
                >
                  {showOrderSection ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  {showOrderSection ? "Փակել պատվերի բաժինը" : "Բացել պատվերի բաժինը"}
                </Button>
              </div>

              {showOrderSection && (
                <div className="space-y-3">
                  {/* Payment method */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վճարման եղանակ՝</Label>
                    <div className="flex items-center gap-1 border border-hairline bg-card">
                      {([
                        { v: "debt", label: "Պարտք" },
                        { v: "cash", label: "Առձեռն" },
                        { v: "transfer", label: "Փոխանցում" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setPaymentMethod(opt.v)}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            paymentMethod === opt.v
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={savePrices}
                        onChange={(e) => setSavePrices(e.target.checked)}
                        className="size-4 accent-primary"
                      />
                      <span>Պահպանել գները</span>
                    </label>
                  </div>

                  {/* Quick Fill panel inline */}
                  <div className="border border-hairline">
                    <QuickFillPanel
                      embedded
                      onChange={(r, t) => { setRows(r); setTotals(t); }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-hairline bg-card flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-sm">
            {showOrderSection && (
              <>
                <span className="text-muted-foreground">Ընտրված՝ <strong className="text-foreground">{totals.selectedCount}</strong></span>
                <span className="text-muted-foreground">Ընդհանուր՝ <strong className="text-primary text-base">{new Intl.NumberFormat("hy-AM").format(totals.totalAmount)} դր</strong></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={() => { reset(); onClose(); }}>Փակել</Button>
            {!createdClientId ? (
              <Button onClick={submit} disabled={createClientMutation.isPending || createOrderMutation.isPending} size="lg" className="bg-primary gap-2">
                {(createClientMutation.isPending || createOrderMutation.isPending) && <Loader2 className="size-5 animate-spin" />}
                {totals.selectedCount > 0 ? "Ստեղծել հաճախորդ և պատվեր" : "Ստեղծել հաճախորդ"}
              </Button>
            ) : (
              <Button
                onClick={() => { reset(); onCreated?.(); onClose(); }}
                size="lg"
                variant="outline"
                className="gap-2"
              >
                Ավարտել
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
