"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RolshutterCalculator } from "./rolshutter-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, Percent } from "lucide-react";
import { toast } from "sonner";

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

export type CalculatorRow = {
  name: string;
  qty: number;
  meters: number | null;
  price: number;
  sum: number;
};

/**
 * Wraps the RolshutterCalculator with a client selector + payment method
 * + "Ստեղծել պատվեր" button that converts calculator rows into an order.
 *
 * Strategy for product matching:
 *  - Search Supabase products by name (case-insensitive contains)
 *  - If found — use that product's ID and current salePrice
 *  - If not found — auto-create a new product with the calculator's name/price
 */
export function RolshutterCalculatorWithOrder() {
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [clientId, setClientId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"debt" | "cash" | "transfer">("debt");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [rows, setRows] = useState<CalculatorRow[]>([]);
  const [total, setTotal] = useState(0);

  const onRowsChange = useCallback((r: CalculatorRow[]) => setRows(r), []);
  const onTotalChange = useCallback((t: number) => setTotal(t), []);

  const clients = clientsData?.clients ?? [];
  const products = productsData?.products ?? [];

  // Compute discount-adjusted total
  const discountAmount = useMemo(() => {
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    return Math.round((total * pct) / 100);
  }, [total, discountPercent]);

  const finalTotal = useMemo(() => {
    return Math.max(0, total - discountAmount);
  }, [total, discountAmount]);

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Ընտրեք հաճախորդ");
      if (rows.length === 0) throw new Error("Լցրեք ապրանքները");
      if (total === 0) throw new Error("Ընդհանուրը 0 է");

      // For each calculator row, find or create a matching product
      const items: any[] = [];
      for (const r of rows) {
        if (!r.name || (r.sum || 0) <= 0) continue;

        // Find by exact name (case-insensitive)
        let product = products.find((p: any) => p.name.toLowerCase() === r.name.toLowerCase());
        if (!product) {
          // Find by partial name
          product = products.find((p: any) =>
            p.name.toLowerCase().includes(r.name.toLowerCase()) ||
            r.name.toLowerCase().includes(p.name.toLowerCase())
          );
        }

        let productId: string;
        let unitId: string;
        if (product) {
          productId = product.id;
          unitId = product.unitId ?? product.unit?.id ?? "";
        } else {
          // Auto-create new product
          const sku = `CALC-${Date.now().toString(36).toUpperCase()}-${r.name.replace(/\s/g, "").slice(0, 8).toUpperCase()}`;
          const createRes = await fetch("/api/products", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sku,
              name: r.name,
              unitId: "1", // հատ (piece) — fallback ID
              salePrice: Math.round(r.price || 0),
              categoryId: null,
            }),
          });
          if (!createRes.ok) {
            const e = await createRes.json();
            throw new Error(`Չհաջողվեց ստեղծել «${r.name}» ապրանքը: ${e.error ?? "սխալ"}`);
          }
          const created = await createRes.json();
          productId = created.product.id;
          unitId = created.product.unitId;
        }

        const qty = r.meters ? Math.max(1, Math.round(r.meters)) : Math.max(1, Math.round(r.qty || 1));
        items.push({
          productId,
          qty,
          unitPrice: Math.round(r.price || 0),
          parameters: {
            quantity: String(r.qty ?? 1),
            ...(r.meters ? { meterage: String(r.meters) } : {}),
            unitPrice: String(Math.round(r.price || 0)),
            fromCalculator: "rolshutter",
          },
        });
      }

      if (items.length === 0) throw new Error("Չկան ապրանքներ պատվերի համար");

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          items,
          savePrices: false,
          paymentMethod,
          discountPercent: Number(discountPercent) || 0,
          note: `Ստեղծված է Դարպասի Հաշվարկից · Ընդհանուր՝ ${Math.round(finalTotal).toLocaleString("hy-AM")} դր${Number(discountPercent) > 0 ? ` · զեղչ ${discountPercent}%` : ""}`,
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
      toast.success(`Պատվերը ստեղծված է · ${data?.priceUpdates > 0 ? data.priceUpdates + " գին պահպանված է" : "OK"}`);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setClientId("");
      setRows([]);
      setTotal(0);
      setDiscountPercent("0");
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
    <div className="space-y-3">
      {/* Order panel — moved to TOP (above calculator) */}
      <div className="border-2 border-primary/30 bg-primary/5 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="size-5 text-primary" />
          <h3 className="text-base font-semibold">Ստեղծել պատվեր հաշվարկից</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հաճախորդ *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Ընտրեք հաճախորդ" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ընդհանուր</Label>
            <div className="h-9 px-3 flex items-center bg-card border border-hairline">
              {Number(discountPercent) > 0 ? (
                <div className="flex flex-col">
                  <span className="text-xs line-through text-muted-foreground tabular-nums">
                    {new Intl.NumberFormat("hy-AM").format(Math.round(total || 0))} դր
                  </span>
                  <span className="text-base font-bold tabular-nums text-primary">
                    {new Intl.NumberFormat("hy-AM").format(Math.round(finalTotal))} դր
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-lg font-bold tabular-nums text-primary">
                    {new Intl.NumberFormat("hy-AM").format(Math.round(total || 0))} դր
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {rows.length} ապրանք
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {Number(discountPercent) > 0 && (
          <div className="mb-3 px-3 py-1.5 bg-status-yellow/10 border border-status-yellow/30 rounded text-xs">
            <span className="text-status-yellow font-medium">Զեղչ {discountPercent}%</span>
            <span className="text-muted-foreground ml-2">
              · զեղչված գումար՝ {new Intl.NumberFormat("hy-AM").format(discountAmount)} դր
              · վերջնական՝ {new Intl.NumberFormat("hy-AM").format(finalTotal)} դր
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Ապրանքները ավտոմատ կկապվեն կատալոգի հետ։ Պահեստի ստուգումը կկատարվի պատվերի ստեղծման ժամանակ։
          </p>
          <Button
            onClick={() => orderMutation.mutate()}
            disabled={orderMutation.isPending || !clientId || rows.length === 0 || finalTotal === 0}
            className="bg-primary gap-2"
            size="lg"
          >
            {orderMutation.isPending && <Loader2 className="size-5 animate-spin" />}
            <Zap className="size-5" />
            Ստեղծել պատվեր
          </Button>
        </div>
      </div>

      {/* Calculator below */}
      <RolshutterCalculator onRowsChange={onRowsChange} onTotalChange={onTotalChange} />
    </div>
  );
}
