"use client";

import { invalidateOrderQueries } from "@/lib/orders/invalidate";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RolshutterCalculator } from "./rolshutter-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, Percent, Save } from "lucide-react";
import { toast } from "sonner";
import { SearchableClientSelect } from "@/components/shared/searchable-client-select";
import { createOrderFromCalculatorRows, type CalculatorRow } from "@/lib/orders/calculator-order";

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

/**
 * Wraps the RolshutterCalculator with a client selector + payment method
 * + "Ստեղծել պատվեր" button that converts calculator rows into an order.
 *
 * Two modes:
 *  - Standalone (default): shows its own client selector + create button.
 *  - Embedded: receives `clientId` from parent (e.g. ClientCreateDialog) and
 *    only renders calculator + payment + discount + create button.
 */
export type CalculatorOrderState = {
  rows: CalculatorRow[];
  total: number;
  paymentMethod: "debt" | "cash" | "transfer";
  discountPercent: number;
};

export function RolshutterCalculatorWithOrder({
  embedded = false,
  clientId: externalClientId,
  onOrderCreated,
  onStateChange,
}: {
  embedded?: boolean;
  clientId?: string;
  onOrderCreated?: () => void;
  onStateChange?: (state: CalculatorOrderState) => void;
}) {
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    enabled: !embedded,
  });
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [internalClientId, setInternalClientId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"debt" | "cash" | "transfer">("debt");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [rows, setRows] = useState<CalculatorRow[]>([]);
  const [total, setTotal] = useState(0);

  const clientId = embedded ? (externalClientId ?? "") : internalClientId;

  const onRowsChange = useCallback((r: CalculatorRow[]) => setRows(r), []);
  const onTotalChange = useCallback((t: number) => setTotal(t), []);

  const clients = clientsData?.clients ?? [];
  const products = productsData?.products ?? [];

  // Report state to parent (embedded mode) so it can create the order itself
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  useEffect(() => {
    if (embedded) {
      onStateChangeRef.current?.({
        rows,
        total,
        paymentMethod,
        discountPercent: Number(discountPercent) || 0,
      });
    }
  }, [embedded, rows, total, paymentMethod, discountPercent]);

  // Compute discount-adjusted total
  const discountAmount = useMemo(() => {
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    return Math.round((total * pct) / 100);
  }, [total, discountPercent]);

  const finalTotal = useMemo(() => {
    return Math.max(0, total - discountAmount);
  }, [total, discountAmount]);

  const orderMutation = useMutation({
    mutationFn: async (status: "DRAFT" | "CONFIRMED") => {
      return createOrderFromCalculatorRows({
        clientId,
        status,
        rows,
        total,
        paymentMethod,
        discountPercent: Number(discountPercent) || 0,
        products,
      });
    },
    onSuccess: (data) => {
      toast.success(data?.order?.status === "DRAFT" ? "Սևագիրը պահպանված է" : `Պատվերը ստեղծված է · ${data?.priceUpdates > 0 ? data.priceUpdates + " գին պահպանված է" : "OK"}`);
      void invalidateOrderQueries(qc);
      setInternalClientId("");
      setRows([]);
      setTotal(0);
      setDiscountPercent("0");
      onOrderCreated?.();
    },
    onError: (e: any) => {
      if (e?.stockError && e?.details) {
        toast.error(`Պահեստի սխալ՝ ${e.details.length} ապրանք`);
      } else {
        toast.error(e?.message ?? "Սխալ");
      }
    },
  });

  return (
    <div className="border-2 border-primary/30 bg-primary/5 p-4 rounded-lg space-y-4">
      {/* TOP: title + client + payment + discount */}
      <div className="flex items-center gap-2 pb-3 border-b border-hairline">
        <Zap className="size-5 text-primary" />
        <h3 className="text-base font-semibold">Ստեղծել պատվեր հաշվարկից</h3>
        {rows.length > 0 && total > 0 && (
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {Number(discountPercent) > 0 ? (
              <>
                <span className="line-through">{new Intl.NumberFormat("hy-AM").format(Math.round(total))} դր</span>
                {" → "}
                <strong className="text-primary">{new Intl.NumberFormat("hy-AM").format(Math.round(finalTotal))} դր</strong>
              </>
            ) : (
              <><strong className="text-primary">{new Intl.NumberFormat("hy-AM").format(Math.round(total))} դր</strong></>
            )}
            {" · "}
            {rows.length} ապրանք
          </span>
        )}
      </div>

      {/* Client + payment + discount selectors */}
      <div className={`grid gap-3 ${embedded ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
        {!embedded && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հաճախորդ *</Label>
            <SearchableClientSelect
              clients={clients}
              value={clientId}
              onChange={setInternalClientId}
              placeholder="Ընտրեք · որոնում անունով կամ հեռախոսով"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վճարման եղանակ</Label>
          <div className="flex items-center gap-1 border border-hairline bg-card h-9">
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
            className="h-9 text-right tabular-nums focus-steel"
          />
        </div>
      </div>

      {/* MIDDLE: Calculator */}
      <div className="border border-hairline bg-card rounded-lg p-3">
        <RolshutterCalculator
          products={products}
          onRowsChange={onRowsChange}
          onTotalChange={onTotalChange}
        />
      </div>

      {/* BOTTOM: price + discount summary + create button */}
      {Number(discountPercent) > 0 && (
        <div className="px-3 py-1.5 bg-status-yellow/10 border border-status-yellow/30 rounded text-xs">
          <span className="text-status-yellow font-medium">Զեղչ {discountPercent}%</span>
          <span className="text-muted-foreground ml-2">
            · զեղչված գումար՝ {new Intl.NumberFormat("hy-AM").format(discountAmount)} դր
            · վերջնական՝ {new Intl.NumberFormat("hy-AM").format(finalTotal)} դր
          </span>
        </div>
      )}

      {/* Stock warning if not enough stock */}
      {orderMutation.isError && (orderMutation.error as any)?.stockError && (
        <div className="px-3 py-2 bg-status-red/10 border border-status-red/30 rounded text-xs text-status-red">
          <strong>⚠️ Պատվերը հնարավոր չէ ընդունել — անբավարար պաշար</strong>
          <ul className="mt-1 space-y-0.5">
            {((orderMutation.error as any)?.details ?? []).map((d: string, i: number) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom bar: total + create button */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-hairline">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Ընդհանուր՝ </span>
            {Number(discountPercent) > 0 ? (
              <span className="flex flex-col leading-tight">
                <span className="text-xs line-through text-muted-foreground tabular-nums">
                  {new Intl.NumberFormat("hy-AM").format(Math.round(total || 0))} դր
                </span>
                <span className="text-xl font-bold tabular-nums text-primary">
                  {new Intl.NumberFormat("hy-AM").format(Math.round(finalTotal))} դր
                </span>
              </span>
            ) : (
              <span className="text-xl font-bold tabular-nums text-primary">
                {new Intl.NumberFormat("hy-AM").format(Math.round(total || 0))} դր
              </span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">
              · {rows.length} ապրանք
            </span>
          </div>
          <p className="text-xs text-muted-foreground hidden md:block">
            Պատվերը կուղարկվի Պահեստապետին · գները նրան չեն երևում · պահեստի առկայությունը ստուգվում է
          </p>
        </div>
        {!embedded && (
          <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => orderMutation.mutate("DRAFT")}
            disabled={orderMutation.isPending || !clientId || rows.length === 0 || total === 0}
            className="gap-2"
            size="lg"
          >
            <Save className="size-5" /> Պահպանել սևագիր
          </Button>
          <Button
            onClick={() => orderMutation.mutate("CONFIRMED")}
            disabled={orderMutation.isPending || !clientId || rows.length === 0 || finalTotal === 0}
            className="bg-primary gap-2"
            size="lg"
          >
            {orderMutation.isPending && <Loader2 className="size-5 animate-spin" />}
            <Zap className="size-5" />
            Ստեղծել պատվեր
          </Button>
          </div>
        )}
      </div>
    </div>
  );
}
