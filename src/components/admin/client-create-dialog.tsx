"use client";

import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, User, Building2, ChevronDown, ChevronRight, DoorOpen, Zap,
  Receipt, Package2, Percent, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuickFillPanel, quickFillRowsToOrderItems, type QuickFillRow, type QuickFillTotals } from "./quick-fill-panel";
import { RolshutterCalculator } from "@/components/rolshutter/rolshutter-calculator";
import { buildItemsFromCalculatorRows, type CalculatorRow } from "@/lib/orders/calculator-order";
import { invalidateOrderQueries } from "@/lib/orders/invalidate";

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ClientCreateDialog({ open, onClose, onCreated, onOrderCreated }: { open: boolean; onClose: () => void; onCreated?: () => void; onOrderCreated?: (order: { id: string }) => void }) {
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

  // Inline order entry — open by default
  const [showOrderSection, setShowOrderSection] = useState(true);
  const [orderTab, setOrderTab] = useState<"quickfill" | "calculator">("quickfill");
  const [calculatorOpened, setCalculatorOpened] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"debt" | "cash" | "transfer">("debt");
  const [savePrices, setSavePrices] = useState(true);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [rows, setRows] = useState<QuickFillRow[]>([]);
  const [totals, setTotals] = useState<QuickFillTotals>({
    totalQty: 0, totalMeterage: 0, totalAmount: 0, selectedCount: 0, priceChanges: 0,
  });
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [calcRows, setCalcRows] = useState<CalculatorRow[]>([]);
  const [calcTotal, setCalcTotal] = useState(0);
  const [stockError, setStockError] = useState<string[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const products = productsData?.products ?? [];

  const onQfChange = useCallback((r: QuickFillRow[], t: QuickFillTotals) => {
    setRows(r);
    setTotals(t);
  }, []);
  const onCalcRowsChange = useCallback((r: CalculatorRow[]) => setCalcRows(r), []);
  const onCalcTotalChange = useCallback((t: number) => setCalcTotal(t), []);

  // Combined totals (unified receipt)
  const combined = useMemo(() => {
    const baseTotal = totals.totalAmount + calcTotal;
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    const discountAmount = Math.round((baseTotal * pct) / 100);
    const finalTotal = Math.max(0, baseTotal - discountAmount);
    const qfItemCount = rows.filter((r) => r.selected && (r.qty > 0 || r.meterage > 0)).length;
    const calcItemCount = calcRows.filter((r) => (r.sum || 0) > 0).length;
    return {
      baseTotal,
      discountAmount,
      finalTotal,
      qfItemCount,
      calcItemCount,
      totalItemCount: qfItemCount + calcItemCount,
    };
  }, [totals.totalAmount, calcTotal, discountPercent, rows, calcRows]);

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
  });

  const reset = () => {
    setFirstName(""); setLastName(""); setCompanyName(""); setTaxId("");
    setPhone(""); setEmail(""); setPrimaryAddress(""); setCreditLimit("0");
    setCreatedClientId(null);
    setShowOrderSection(true);
    setOrderTab("quickfill"); setCalculatorOpened(false);
    setRows([]); setCalcRows([]); setCalcTotal(0);
    setTotals({ totalQty: 0, totalMeterage: 0, totalAmount: 0, selectedCount: 0, priceChanges: 0 });
    setPaymentMethod("debt"); setDiscountPercent("0"); setSavePrices(true);
    setStockError(null);
    setFormError(null);
  };

  const submit = async (status: "DRAFT" | "CONFIRMED" = "CONFIRMED") => {
    setFormError(null);
    setStockError(null);
    if (!phone) { toast.error("Հեռախոսը պարտադիր է"); return; }
    if (type === "INDIVIDUAL" && (!firstName || !lastName)) { toast.error("Անուն և Ազգանունը պարտադիր են"); return; }
    if (type === "COMPANY" && !companyName) { toast.error("Ընկերության անվանումը պարտադիր է"); return; }

    try {
      // Resolve the order first, so catalog errors do not create an unused client.
      const items = showOrderSection ? [
        ...quickFillRowsToOrderItems(rows),
        ...await buildItemsFromCalculatorRows(calcRows, products),
      ] : [];
      let newClientId = createdClientId;
      if (!newClientId) {
        const data = await createClientMutation.mutateAsync({
          type,
          firstName, lastName,
          companyName: type === "COMPANY" ? companyName : undefined,
          taxId: type === "COMPANY" ? taxId : undefined,
          phone, email, primaryAddress,
          preferredChannel,
          creditLimit: Number(creditLimit) || 0,
        });
        newClientId = data.client.id;
        setCreatedClientId(newClientId);
        toast.success("Հաճախորդը ստեղծված է");
        qc.invalidateQueries({ queryKey: ["clients"] });
      }

      if (items.length > 0) {
        const orderData: any = await createOrderMutation.mutateAsync({
          clientId: newClientId,
          status,
          items,
          savePrices: status === "CONFIRMED" && savePrices,
          paymentMethod,
          discountPercent: Number(discountPercent) || 0,
          note: `Ստեղծված է նոր հաճախորդի հետ · Ընդհանուր՝ ${combined.finalTotal.toLocaleString("hy-AM")} դր`,
        });
        const msg = orderData?.priceUpdates > 0
          ? `Հաճախորդ և պատվեր ստեղծված են · ${orderData.priceUpdates} գին պահպանված է`
          : "Հաճախորդ և պատվեր ստեղծված են";
        toast.success(status === "DRAFT" ? "Սևագիրը պահպանված է" : msg);
        void invalidateOrderQueries(qc);
        reset();
        onCreated?.();
        onClose();
        onOrderCreated?.(orderData.order);
        return;
      }

      // No order items — just close
      reset();
      onCreated?.();
      onClose();
    } catch (e: any) {
      if (e?.stockError && e?.details) setStockError(e.details);
      const message = e?.message ?? "Չհաջողվեց պահպանել։ Փորձեք կրկին։";
      setFormError(message);
      toast.error(message);
    }
  };

  // (single submit() handles both client + order creation)

  const clientName = createdClientId
    ? (type === "COMPANY" ? companyName : `${firstName} ${lastName}`)
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-[1600px] w-[70vw] max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
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

                <div hidden={!showOrderSection} className="space-y-3">
                  {/* Shared controls: payment + discount + save prices */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վճարման եղանակ՝</Label>
                    <div className="flex items-center gap-1 border border-hairline bg-card rounded-md overflow-hidden">
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
                    <div className="flex items-center gap-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Percent className="size-3" /> Զեղչ (%)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        placeholder="0"
                        className="h-9 w-20 text-right tabular-nums focus-steel"
                      />
                    </div>
                  </div>

                  {/* Two blocks (tabs) */}
                  <div className="border border-hairline rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1 border-b border-hairline p-1 bg-muted/20">
                      <button
                        type="button"
                        onClick={() => setOrderTab("quickfill")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md ${
                          orderTab === "quickfill" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"
                        }`}
                      >
                        <Zap className="size-4" />
                        Պատվերի լրացում
                        {totals.selectedCount > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${orderTab === "quickfill" ? "border-primary-foreground/40" : "border-hairline"}`}>
                            {totals.selectedCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCalculatorOpened(true); setOrderTab("calculator"); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md ${
                          orderTab === "calculator" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"
                        }`}
                      >
                        <DoorOpen className="size-4" />
                        Դարպասի պատվեր
                        {calcRows.filter((r) => (r.sum || 0) > 0).length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${orderTab === "calculator" ? "border-primary-foreground/40" : "border-hairline"}`}>
                            {calcRows.filter((r) => (r.sum || 0) > 0).length}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="p-3">
                      <div hidden={orderTab !== "quickfill"}>
                        <QuickFillPanel embedded onChange={onQfChange} />
                      </div>
                      <div hidden={orderTab !== "calculator"}>
                        {calculatorOpened && (
                        <RolshutterCalculator
                          products={products}
                          onRowsChange={onCalcRowsChange}
                          onTotalChange={onCalcTotalChange}
                        />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock error banner */}
                  {stockError && (
                    <div className="px-3 py-2 border border-status-red/30 bg-status-red/5 rounded text-xs text-status-red">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold uppercase tracking-wider">Պատվերը հնարավոր չէ ընդունել — անբավարար պաշար</div>
                          <ul className="mt-1 space-y-0.5">
                            {stockError.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                        <button onClick={() => setStockError(null)} className="text-status-red/60 hover:text-status-red px-1">✕</button>
                      </div>
                    </div>
                  )}

                  {/* Unified receipt */}
                  <div className="border-2 border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-primary/20 flex items-center gap-2 bg-primary/5">
                      <Receipt className="size-4 text-primary" />
                      <span className="text-sm font-semibold">Միասնական չեկ</span>
                    </div>
                    <div className="p-4">
                      <div className="space-y-1.5">
                        {rows.filter((r) => r.selected && (r.qty > 0 || r.meterage > 0)).map((r) => {
                          const qtyForCalc = r.meterage > 0 ? r.meterage : r.qty;
                          return (
                            <div key={r.productId} className="flex items-center gap-2 text-sm">
                              <Package2 className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate">{r.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {r.meterage > 0 ? `${r.meterage} մ` : `${r.qty} ${r.unitSymbol}`}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{r.unitPrice.toLocaleString("hy-AM")} դր</span>
                              <span className="text-sm font-medium tabular-nums w-24 text-right">
                                {Math.round(qtyForCalc * r.unitPrice).toLocaleString("hy-AM")} դր
                              </span>
                            </div>
                          );
                        })}
                        {calcRows.filter((r) => (r.sum || 0) > 0).map((r, i) => (
                          <div key={`calc-${i}`} className="flex items-center gap-2 text-sm">
                            <DoorOpen className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{r.name}</span>
                            {r.color && <span className="text-xs text-muted-foreground truncate max-w-[140px]">{r.color}</span>}
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {r.meters ? `${r.meters} մ` : `${r.qty} հատ`}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{r.price.toLocaleString("hy-AM")} դր</span>
                            <span className="text-sm font-medium tabular-nums w-24 text-right">
                              {Math.round(r.sum).toLocaleString("hy-AM")} դր
                            </span>
                          </div>
                        ))}
                        {combined.totalItemCount === 0 && (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            Չեկը դատարկ է — լրացրեք ապրանքները վերևի բլոկներից
                          </div>
                        )}
                      </div>

                      {combined.totalItemCount > 0 && (
                        <div className="mt-3 pt-3 border-t border-hairline space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Ապրանքների քանակ</span>
                            <span className="font-medium tabular-nums">{combined.totalItemCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Ընդհանուր (նախքան զեղչ)</span>
                            <span className="font-medium tabular-nums">{combined.baseTotal.toLocaleString("hy-AM")} դր</span>
                          </div>
                          {Number(discountPercent) > 0 && (
                            <div className="flex items-center justify-between text-sm text-status-yellow">
                              <span>Զեղչ ({discountPercent}%)</span>
                              <span className="font-medium tabular-nums">−{combined.discountAmount.toLocaleString("hy-AM")} դր</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-semibold">Վճարման ենթակա</span>
                            <span className="text-xl font-bold tabular-nums text-primary">
                              {combined.finalTotal.toLocaleString("hy-AM")} դր
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>

        {formError && (
          <div role="alert" className="mx-6 mb-3 p-3 border border-status-red/30 bg-status-red/5 text-sm text-status-red">
            {createdClientId && <p className="font-medium">Հաճախորդը պահպանված է։ Ուղղեք պատվերը և կրկին պահպանեք։</p>}
            <p>{formError}</p>
          </div>
        )}
        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-hairline bg-card flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-sm">
            {showOrderSection && combined.totalItemCount > 0 && (
              <>
                <span className="text-muted-foreground">Ապրանքներ՝ <strong className="text-foreground">{combined.totalItemCount}</strong></span>
                {Number(discountPercent) > 0 ? (
                  <span className="text-muted-foreground">Ընդհանուր՝
                    <span className="text-xs line-through text-muted-foreground ml-1 tabular-nums">{combined.baseTotal.toLocaleString("hy-AM")} դր</span>
                    <strong className="text-primary text-base ml-1 tabular-nums">{combined.finalTotal.toLocaleString("hy-AM")} դր</strong>
                    <span className="text-status-yellow ml-1 text-xs">−{discountPercent}%</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Ընդհանուր՝ <strong className="text-primary text-base">{combined.baseTotal.toLocaleString("hy-AM")} դր</strong></span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={() => { reset(); onClose(); }}>Փակել</Button>
            {showOrderSection && combined.totalItemCount > 0 && (
              <Button variant="outline" onClick={() => submit("DRAFT")} disabled={createClientMutation.isPending || createOrderMutation.isPending} size="lg">
                Պահպանել սևագիր
              </Button>
            )}
              <Button onClick={() => submit()} disabled={createClientMutation.isPending || createOrderMutation.isPending || (!!createdClientId && (!showOrderSection || combined.totalItemCount === 0))} size="lg" className="bg-primary gap-2">
                {(createClientMutation.isPending || createOrderMutation.isPending) && <Loader2 className="size-5 animate-spin" />}
                {createdClientId ? "Պահպանել պատվերը" : showOrderSection && combined.totalItemCount > 0 ? "Ստեղծել հաճախորդ և պատվեր" : "Ստեղծել հաճախորդ"}
              </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
