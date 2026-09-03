"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Save, RotateCcw, Calculator, Package2, TrendingUp, Star } from "lucide-react";
import { toast } from "sonner";

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export type QuickFillRow = {
  productId: string;
  name: string;
  sku: string;
  unitCode: string;
  unitSymbol: string;
  qty: number;          // քանակ
  meterage: number;     // մետրաժ (separate field for length-sensitive items)
  unitPrice: number;    // գին per unit
  useMeterage: boolean; // if true, total = meterage * unitPrice; else total = qty * unitPrice
  selected: boolean;
  salePriceOriginal: number; // from catalog
  isFavorite: boolean;       // հիմնական — показывать первой
};

export type QuickFillTotals = {
  totalQty: number;
  totalMeterage: number;
  totalAmount: number;
  selectedCount: number;
  priceChanges: number;
};

/**
 * QuickFillPanel — Excel-like grid for fast order entry.
 *
 * - Lists all products (with Quick-Fill items at top, sorted by SKU QF- first)
 * - Each row has: checkbox, name, qty input, meterage input, price input, line total
 * - Live total at the bottom
 * - "Save prices to catalog" button persists overridden prices
 * - "Reset" clears the form
 */
export function QuickFillPanel({
  onChange,
  embedded = false,
}: {
  onChange?: (rows: QuickFillRow[], totals: QuickFillTotals) => void;
  embedded?: boolean;
}) {
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [search, setSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [rows, setRows] = useState<QuickFillRow[]>([]);

  // Initialize rows once products load
  useEffect(() => {
    if (!data?.products) return;
    const all = data.products as Array<any>;
    // Sort: 1) isFavorite first, 2) QF- items, 3) by name
    const sorted = [...all].sort((a, b) => {
      // favorites first
      if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
      // then QF- items
      const aQF = a.sku?.startsWith("QF-") ? 0 : 1;
      const bQF = b.sku?.startsWith("QF-") ? 0 : 1;
      if (aQF !== bQF) return aQF - bQF;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    setRows(
      sorted.map((p) => ({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unitCode: p.unit?.code ?? "piece",
        unitSymbol: p.unit?.symbol ?? "հատ",
        qty: 0,
        meterage: 0,
        unitPrice: p.salePrice ?? 0,
        useMeterage: p.unit?.code === "m" || p.unit?.code === "m2",
        selected: false,
        salePriceOriginal: p.salePrice ?? 0,
        isFavorite: !!p.isFavorite,
      }))
    );
  }, [data]);

  // Favorites-only filter state
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Filter visible rows
  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (favoritesOnly && !r.isFavorite) return false;
      if (showSelectedOnly && !r.selected) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
    });
  }, [rows, search, showSelectedOnly, favoritesOnly]);

  // Compute totals — if meterage > 0, use it; else use qty
  const totals = useMemo<QuickFillTotals>(() => {
    let totalQty = 0;
    let totalMeterage = 0;
    let totalAmount = 0;
    let selectedCount = 0;
    let priceChanges = 0;
    for (const r of rows) {
      if (!r.selected) continue;
      selectedCount++;
      totalQty += r.qty || 0;
      totalMeterage += r.meterage || 0;
      // Use meterage if filled, else qty (allows both fields to be fillable)
      const qtyForCalc = r.meterage > 0 ? r.meterage : r.qty;
      const lineTotal = qtyForCalc * r.unitPrice;
      totalAmount += lineTotal;
      if (r.unitPrice !== r.salePriceOriginal) priceChanges++;
    }
    return { totalQty, totalMeterage, totalAmount, selectedCount, priceChanges };
  }, [rows]);

  // Notify parent
  useEffect(() => {
    onChange?.(rows, totals);
  }, [rows, totals, onChange]);

  const updateRow = (idx: number, patch: Partial<QuickFillRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const reset = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        qty: 0,
        meterage: 0,
        unitPrice: r.salePriceOriginal,
        selected: false,
      }))
    );
    setSearch("");
    setShowSelectedOnly(false);
    setFavoritesOnly(false);
    toast.success("Մաքրված է");
  };

  // Toggle favorite (uses API to persist + updates local state)
  const qc = useQueryClient();
  const favMutation = useMutation({
    mutationFn: async ({ productId, isFavorite }: { productId: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/products/${productId}/favorite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onMutate: ({ productId, isFavorite }) => {
      // Optimistic update — toggle local state immediately
      setRows((prev) =>
        prev.map((r) =>
          r.productId === productId ? { ...r, isFavorite } : r
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (_e, { productId }) => {
      // Rollback
      setRows((prev) =>
        prev.map((r) =>
          r.productId === productId ? { ...r, isFavorite: !r.isFavorite } : r
        )
      );
      toast.error("Չհաջողվեց փոխել հիմնական նշումը");
    },
  });

  // Format AMD
  const fmt = (n: number) => new Intl.NumberFormat("hy-AM").format(Math.round(n || 0));
  const fmtUnit = (n: number, decimals = 2) => {
    if (!n) return "0";
    return n.toFixed(decimals).replace(/\.?0+$/, "");
  };

  const qfCount = rows.filter((r) => r.sku.startsWith("QF-")).length;

  return (
    <div className={`flex flex-col ${embedded ? "" : "border border-hairline bg-card"}`}>
      {/* Toolbar */}
      <div className="border-b border-hairline p-2.5 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Package2 className="size-4 text-primary" />
            <span className="text-sm font-semibold">Գրանցել Պատվեր</span>
            <Badge variant="outline" className="text-[10px] border-hairline px-1.5 py-0.5">
              {qfCount} հիմն.
            </Badge>
            <Badge variant="outline" className="text-[10px] border-hairline px-1.5 py-0.5">
              {rows.length} ընդհ.
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={favoritesOnly ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setFavoritesOnly((v) => !v)}
              title="Ցույց տալ միայն հիմնական նշված ապրանքները"
            >
              <Star className={`size-3.5 ${favoritesOnly ? "fill-current" : ""}`} />
              Հիմնական ({rows.filter((r) => r.isFavorite).length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowSelectedOnly((v) => !v)}
            >
              <Checkbox checked={showSelectedOnly} className="size-3" />
              Ընտրված ({totals.selectedCount})
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={reset}>
              <RotateCcw className="size-3.5" /> Մաքրել
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Որոնում՝ անուն, SKU…"
            className="h-8 pl-8 text-xs focus-steel"
          />
        </div>
      </div>

      {/* Grid — full width, no horizontal scroll, responsive columns */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Grid header */}
        <div className="grid grid-cols-[36px_36px_1fr_60px_80px_80px_110px] gap-0 border-b border-hairline bg-muted/30 sticky top-0 z-10">
          <div className="px-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-center">✓</div>
          <div className="px-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-center">★</div>
          <div className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline">Ապրանք</div>
          <div className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Միավ.</div>
          <div className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Քանակ</div>
          <div className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-hairline text-right">Մետրաժ</div>
          <div className="px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Գին (դր)</div>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto" style={{ maxHeight: embedded ? "calc(88vh - 280px)" : "500px" }}>
          {isLoading && (
            <div className="p-6 text-center text-xs text-muted-foreground">Բեռնվում է…</div>
          )}
          {!isLoading && visibleRows.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {search ? "Որոնման արդյունքներ չկան" : "Ապրանքներ չկան"}
            </div>
          )}
          {visibleRows.map((r) => {
            // Find absolute index in rows array
            const absIdx = rows.findIndex((x) => x.productId === r.productId);
            // If meterage > 0 use it, else qty
            const qtyForCalc = r.meterage > 0 ? r.meterage : r.qty;
            const lineTotal = qtyForCalc * r.unitPrice;
            const isQuickFill = r.sku.startsWith("QF-");
            const priceChanged = r.unitPrice !== r.salePriceOriginal;
            return (
              <div
                key={r.productId}
                className={`grid grid-cols-[36px_36px_1fr_60px_80px_80px_110px] gap-0 border-b border-hairline hover:bg-muted/20 transition-colors ${
                  r.selected ? "bg-primary/5" : ""
                } ${isQuickFill ? "border-l-2 border-l-primary/40" : ""} ${r.isFavorite ? "bg-status-yellow/5" : ""}`}
              >
                  {/* Checkbox */}
                  <div className="px-1.5 py-2 border-r border-hairline flex items-center justify-center">
                    <Checkbox
                      checked={r.selected}
                      onCheckedChange={(v) => updateRow(absIdx, { selected: !!v })}
                      className="size-3.5"
                    />
                  </div>
                  {/* Star (favorite toggle) */}
                  <div className="px-1.5 py-2 border-r border-hairline flex items-center justify-center">
                    <button
                      onClick={() => favMutation.mutate({ productId: r.productId, isFavorite: !r.isFavorite })}
                      className={`text-sm leading-none hover:scale-125 transition-transform ${r.isFavorite ? "" : "text-muted-foreground/40 hover:text-status-yellow"}`}
                      title={r.isFavorite ? "Հանել հիմնականներից" : "Նշել որպես հիմնական"}
                    >
                      {r.isFavorite ? "⭐" : "☆"}
                    </button>
                  </div>
                  {/* Name + SKU — allow full text wrapping */}
                  <div className="px-2 py-1.5 border-r border-hairline min-w-0">
                    <div className="text-xs font-medium truncate flex items-center gap-1.5">
                      {isQuickFill && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                      {r.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{r.sku}</div>
                  </div>
                  {/* Unit */}
                  <div className="px-1.5 py-2 border-r border-hairline text-right">
                    <span className="text-xs text-muted-foreground">{r.unitSymbol}</span>
                  </div>
                  {/* Qty — always enabled */}
                  <div className="px-1.5 py-1.5 border-r border-hairline">
                    <Input
                      type="number"
                      min={0}
                      value={r.qty || ""}
                      onChange={(e) => updateRow(absIdx, { qty: Number(e.target.value) || 0, selected: r.selected || !!e.target.value })}
                      placeholder="0"
                      className="h-7 text-xs text-right tabular-nums px-1.5 focus-steel"
                    />
                  </div>
                  {/* Meterage — always enabled, even for piece items */}
                  <div className="px-1.5 py-1.5 border-r border-hairline">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.meterage || ""}
                      onChange={(e) => updateRow(absIdx, { meterage: Number(e.target.value) || 0, selected: r.selected || !!e.target.value })}
                      placeholder="0.00"
                      className={`h-7 text-xs text-right tabular-nums px-1.5 focus-steel ${!r.useMeterage ? "bg-muted/20" : ""}`}
                    />
                  </div>
                  {/* Price */}
                  <div className="px-1.5 py-1.5 relative">
                    <Input
                      type="number"
                      min={0}
                      value={r.unitPrice || ""}
                      onChange={(e) => updateRow(absIdx, { unitPrice: Number(e.target.value) || 0, selected: r.selected || !!e.target.value })}
                      placeholder="0"
                      className={`h-7 text-xs text-right tabular-nums px-1.5 focus-steel ${
                        priceChanged ? "border-status-yellow/50 bg-status-yellow/5" : ""
                      }`}
                    />
                    {priceChanged && (
                      <div className="absolute -bottom-0.5 right-1 text-[9px] text-status-yellow font-medium" title={`Բնօրինակ՝ ${fmt(r.salePriceOriginal)} դր`}>
                        ↑{fmt(r.salePriceOriginal)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {/* Footer — totals (hidden when embedded, parent shows its own footer) */}
      {!embedded && (
        <div className="border-t-2 border-primary/30 bg-primary/5 p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Ընտրված</div>
              <div className="text-lg font-semibold tabular-nums">{totals.selectedCount} ապրանք</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Քանակ</div>
              <div className="text-lg font-semibold tabular-nums">{fmt(totals.totalQty)} հատ</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Մետրաժ</div>
              <div className="text-lg font-semibold tabular-nums">{fmt(totals.totalMeterage)} մ</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calculator className="size-3.5" /> Ընդհանուր
              </div>
              <div className="text-xl font-bold tabular-nums text-primary">
                {fmt(totals.totalAmount)} դր
              </div>
            </div>
          </div>
          {totals.priceChanges > 0 && (
            <div className="mt-3 pt-2 border-t border-hairline flex items-center gap-2 text-sm text-status-yellow">
              <TrendingUp className="size-4" />
              <span>
                <strong>{totals.priceChanges}</strong> ապրանքի գինը փոխվել է — կպահպանվի կատալոգում պատվերը հաստատելիս
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Extract selected rows from QuickFill as order items payload.
 */
export function quickFillRowsToOrderItems(rows: QuickFillRow[]) {
  return rows
    .filter((r) => r.selected && (r.qty > 0 || r.meterage > 0))
    .map((r) => {
      // If meterage filled, use it as primary qty (allows decimal); else integer qty
      const useMeterage = r.meterage > 0;
      const qty = useMeterage ? Math.max(1, Math.round(r.meterage)) : r.qty;
      return {
        productId: r.productId,
        qty,
        parameters: {
          quantity: String(useMeterage ? r.meterage : r.qty),
          ...(useMeterage ? { meterage: String(r.meterage) } : {}),
          unitPrice: String(r.unitPrice),
        },
        unitPrice: r.unitPrice,
        savePriceToProduct: r.unitPrice !== r.salePriceOriginal,
      };
    });
}
