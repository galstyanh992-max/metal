"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/primitives";
import {
  Zap, DoorOpen, User, Percent, Loader2, Receipt, Package2, Trash2, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableClientSelect } from "@/components/shared/searchable-client-select";
import { QuickFillPanel, quickFillRowsToOrderItems, type QuickFillRow, type QuickFillTotals } from "./quick-fill-panel";
import { RolshutterCalculator } from "@/components/rolshutter/rolshutter-calculator";
import { buildItemsFromCalculatorRows, type CalculatorRow } from "@/lib/orders/calculator-order";
import { ErrorBoundary } from "@/components/shared/error-boundary";

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

type PaymentMethod = "debt" | "cash" | "transfer";

/**
 * AcceptOrderModule — unified order intake.
 *
 * Two blocks (tabs):
 *  - «Պատվերի լրացում» — Excel-like quick fill grid
 *  - «Դարպասի պատվեր» — rolshutter calculator
 *
 * Shared: client selector, payment method, discount.
 * Unified receipt: combined items from both blocks + single create button.
 */
export function AcceptOrderModule({ role }: { role: string }) {
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [tab, setTab] = useState<"quickfill" | "calculator">("quickfill");
  const [clientId, setClientId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debt");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [savePrices, setSavePrices] = useState(true);

  // QuickFill state
  const [qfRows, setQfRows] = useState<QuickFillRow[]>([]);
  const [qfTotals, setQfTotals] = useState<QuickFillTotals>({
    totalQty: 0, totalMeterage: 0, totalAmount: 0, selectedCount: 0, priceChanges: 0,
  });

  // Calculator state
  const [calcRows, setCalcRows] = useState<CalculatorRow[]>([]);
  const [calcTotal, setCalcTotal] = useState(0);

  const [stockError, setStockError] = useState<string[] | null>(null);

  const clients = clientsData?.clients ?? [];
  const products = productsData?.products ?? [];

  const onQfChange = useCallback((r: QuickFillRow[], t: QuickFillTotals) => {
    setQfRows(r);
    setQfTotals(t);
  }, []);

  const onCalcRowsChange = useCallback((r: CalculatorRow[]) => setCalcRows(r), []);
  const onCalcTotalChange = useCallback((t: number) => setCalcTotal(t), []);

  // Combined totals
  const combined = useMemo(() => {
    const baseTotal = qfTotals.totalAmount + calcTotal;
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    const discountAmount = Math.round((baseTotal * pct) / 100);
    const finalTotal = Math.max(0, baseTotal - discountAmount);
    const qfItemCount = qfRows.filter((r) => r.selected && (r.qty > 0 || r.meterage > 0)).length;
    const calcItemCount = calcRows.filter((r) => (r.sum || 0) > 0).length;
    return {
      baseTotal,
      discountAmount,
      finalTotal,
      qfItemCount,
      calcItemCount,
      totalItemCount: qfItemCount + calcItemCount,
    };
  }, [qfTotals.totalAmount, calcTotal, discountPercent, qfRows, calcRows]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Ընտրեք հաճախորդ");
      if (combined.totalItemCount === 0) throw new Error("Լցրեք ապրանքները");
      if (combined.baseTotal === 0) throw new Error("Ընդհանուրը 0 է");

      // Build items from both blocks
      const qfItems = quickFillRowsToOrderItems(qfRows);
      const calcItems = await buildItemsFromCalculatorRows(calcRows, products);
      const items = [...qfItems, ...calcItems];

      if (items.length === 0) throw new Error("Չկան ապրանքներ պատվերի համար");

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          items,
          savePrices,
          paymentMethod,
          discountPercent: Number(discountPercent) || 0,
          note: `Ընդունված է «Ընդունել պատվեր»-ից · Ընդհանուր՝ ${combined.finalTotal.toLocaleString("hy-AM")} դր`,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw Object.assign(new Error(e.error ?? "failed"), {
          stockError: e.stockError,
          details: e.details,
        });
      }
      return res.json();
    },
    onSuccess: (data) => {
      const msg = data?.priceUpdates > 0
        ? `Պատվերը ստեղծված է · ${data.priceUpdates} գին պահպանված է`
        : "Պատվերը ստեղծված է";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setClientId("");
      setDiscountPercent("0");
      setStockError(null);
    },
    onError: (e: any) => {
      if (e?.stockError && e?.details) {
        setStockError(e.details);
        toast.error(`Պահեստի սխալ՝ ${e.details.length} ապրանք`);
      } else {
        toast.error(e?.message ?? "Սխալ");
      }
    },
  });

  const selectedClient = clients.find((c: any) => c.id === clientId);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Ընդունել պատվեր"
        description="Լրացրեք պատվերը երկու եղանակով՝ արագ լրացում կամ դարպասի հաշվարկ, ապա ստացեք միասնական չեկ"
      />

      {/* Shared controls: client + payment + discount */}
      <div className="border border-hairline bg-card rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5" /> Հաճախորդ *
            </Label>
            <SearchableClientSelect
              clients={clients}
              value={clientId}
              onChange={setClientId}
              placeholder="Ընտրեք · որոնում անունով կամ հեռախոսով"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վճարման եղանակ</Label>
            <div className="flex items-center gap-1 border border-hairline bg-card h-9 rounded-md overflow-hidden">
              {([
                { v: "debt", label: "Պարտք" },
                { v: "cash", label: "Առձեռն" },
                { v: "transfer", label: "Փոխանցում" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPaymentMethod(opt.v)}
                  className={`flex-1 h-full px-3 text-sm font-medium transition-colors ${
                    paymentMethod === opt.v
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
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
              className="h-9 w-24 text-right tabular-nums focus-steel"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={savePrices}
            onChange={(e) => setSavePrices(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span>Պահպանել գները կատալոգում</span>
        </label>
      </div>

      {/* Two blocks (tabs) */}
      <div className="border border-hairline bg-card rounded-lg overflow-hidden">
        <div className="flex items-center gap-1 border-b border-hairline p-1 bg-muted/20">
          <button
            onClick={() => setTab("quickfill")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md ${
              tab === "quickfill" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"
            }`}
          >
            <Zap className="size-4" />
            Պատվերի լրացում
            {qfTotals.selectedCount > 0 && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${tab === "quickfill" ? "border-primary-foreground/40" : "border-hairline"}`}>
                {qfTotals.selectedCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setTab("calculator")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md ${
              tab === "calculator" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"
            }`}
          >
            <DoorOpen className="size-4" />
            Դարպասի պատվեր
            {calcRows.filter((r) => (r.sum || 0) > 0).length > 0 && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${tab === "calculator" ? "border-primary-foreground/40" : "border-hairline"}`}>
                {calcRows.filter((r) => (r.sum || 0) > 0).length}
              </Badge>
            )}
          </button>
        </div>

        <div className="p-3">
          {tab === "quickfill" ? (
            <ErrorBoundary>
              <QuickFillPanel embedded onChange={onQfChange} />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary>
              <RolshutterCalculator
                products={products}
                onRowsChange={onCalcRowsChange}
                onTotalChange={onCalcTotalChange}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Stock error banner */}
      {stockError && (
        <div className="px-4 py-3 border border-status-red/30 bg-status-red/5 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-status-red shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-status-red uppercase tracking-wider">
                Պատվերը հնարավոր չէ ընդունել — անբավարար պաշար
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-status-red/90">
                {stockError.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
            <button onClick={() => setStockError(null)} className="text-status-red/60 hover:text-status-red text-xs px-1">✕</button>
          </div>
        </div>
      )}

      {/* Unified receipt */}
      <div className="border-2 border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-primary/20 flex items-center gap-2 bg-primary/5">
          <Receipt className="size-5 text-primary" />
          <h3 className="text-base font-semibold">Միասնական չեկ</h3>
          {selectedClient && (
            <span className="ml-auto text-sm text-muted-foreground">
              {selectedClient.type === "COMPANY"
                ? selectedClient.companyName
                : `${selectedClient.firstName ?? ""} ${selectedClient.lastName ?? ""}`.trim()}
              <span className="ml-2 text-xs">· {selectedClient.phone}</span>
            </span>
          )}
        </div>

        <div className="p-4">
          {/* Receipt line items */}
          <div className="space-y-1.5">
            {qfRows.filter((r) => r.selected && (r.qty > 0 || r.meterage > 0)).map((r) => {
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
              <div className="py-6 text-center text-sm text-muted-foreground">
                Չեկը դատարկ է — լրացրեք ապրանքները վերևի բլոկներից
              </div>
            )}
          </div>

          {/* Totals */}
          {combined.totalItemCount > 0 && (
            <div className="mt-4 pt-3 border-t border-hairline space-y-1.5">
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

          {/* Create button */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setClientId("");
                setDiscountPercent("0");
                setStockError(null);
              }}
            >
              Մաքրել
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !clientId || combined.totalItemCount === 0 || combined.finalTotal === 0}
              className="bg-primary gap-2"
              size="lg"
            >
              {mutation.isPending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              Ստեղծել պատվեր
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
