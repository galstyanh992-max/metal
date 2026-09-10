"use client";
import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalculatorRow } from "@/lib/orders/calculator-order";
import {
  ASSEMBLY_PRICE_PER_SQM_DEFAULT, DEFAULT_COLORS, DEFAULT_MATERIALS,
  DOOR_PRESETS, LAMEL_DIVISOR_BY_LINE, LINE_OFFSET, buildCatalog, type WarehouseProduct,
} from "@/lib/rolshutter/catalog";
import {
  DEFAULTS_QUERY_KEY, captureGateDefaults, factoryGateDefaults, resolveCatalogOption,
  restoreGateDefaults, type CalculatorConfig, type GateDefaults, type GateDefaultsResponse,
  type RowOverride, type SavedGateDefaults,
} from "@/lib/rolshutter/defaults";

async function defaultsRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error === "forbidden"
    ? "Կարգավորումները փոխելու համար անհրաժեշտ է ադմինիստրատորի հասանելիություն։"
    : data.error || "Չհաջողվեց ստանալ կարգավորումները։");
  return data;
}

function formatAmd(n) {
  if (!isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ru-RU") + " ֏";
}

// Parse a numeric string, accepting both decimal comma and dot.
// "2,990" → 2.99, "6.20" → 6.2. Never applied to product names or color codes.
function parseNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const s = v.trim().replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
}

export function RolshutterCalculator({ products = [], onRowsChange, onTotalChange }: {
  products?: WarehouseProduct[];
  onRowsChange?: (rows: CalculatorRow[]) => void;
  onTotalChange?: (total: number) => void;
}) {
  const [width, setWidth] = useState<number | string>(3);
  const [height, setHeight] = useState<number | string>(2.5);
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [motorSide, setMotorSide] = useState("right");

  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [customRows, setCustomRows] = useState<(CalculatorConfig["customRows"][number] & { id: string })[]>([]);
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [defaultsNotice, setDefaultsNotice] = useState("");

  const [assemblyOn, setAssemblyOn] = useState(false);
  const [assemblyPricePerSqm, setAssemblyPricePerSqm] = useState<number | string>(ASSEMBLY_PRICE_PER_SQM_DEFAULT);
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryPrice, setDeliveryPrice] = useState<number | string>(0);

  const catalog = useMemo(() => buildCatalog(products), [products]);
  const queryClient = useQueryClient();
  const defaultsQuery = useQuery<GateDefaultsResponse>({
    queryKey: DEFAULTS_QUERY_KEY,
    queryFn: ({ signal }) => defaultsRequest("/api/rolshutter/defaults", { signal }),
  });
  const savedDefault = selectedPresetId ? defaultsQuery.data?.defaults[selectedPresetId] : undefined;

  const applyConfiguration = (config: GateDefaults) => {
    const restored = restoreGateDefaults(config, catalog);
    setOverrides(restored.overrides);
    setRemovedKeys(restored.removedKeys);
    setCustomRows(restored.customRows.map((row) => ({ ...row, id: crypto.randomUUID() })));
    setColor(restored.color);
    setMotorSide(restored.motorSide);
    setAssemblyOn(restored.assemblyOn);
    setAssemblyPricePerSqm(restored.assemblyPricePerSqm);
    setDeliveryOn(restored.deliveryOn);
    setDeliveryPrice(restored.deliveryPrice);
    setExpandedKey(null);
  };

  const saveDefaults = useMutation({
    mutationFn: async (presetId: string) => {
      let config: GateDefaults;
      try {
        config = captureGateDefaults({
          color, motorSide, overrides, removedKeys, customRows,
          assemblyOn, assemblyPricePerSqm, deliveryOn, deliveryPrice,
        }, catalog);
      } catch {
        throw new Error("Ստուգեք քանակները, գները և լրացուցիչ ապրանքների անունները։");
      }
      return defaultsRequest("/api/rolshutter/defaults", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, config }),
      }) as Promise<{ presetId: string; saved: SavedGateDefaults }>;
    },
    onSuccess: ({ presetId, saved }) => {
      queryClient.setQueryData<GateDefaultsResponse>(DEFAULTS_QUERY_KEY, (previous) => ({
        canManage: previous?.canManage ?? true,
        defaults: { ...previous?.defaults, [presetId]: saved },
      }));
      void queryClient.invalidateQueries({ queryKey: DEFAULTS_QUERY_KEY });
      setDefaultsNotice("Լռելյայն կարգավորումները պահպանված են։ Դրանք կկիրառվեն այս տեսակն ընտրելիս։");
    },
  });
  const resetDefaults = useMutation({
    mutationFn: (presetId: string) => defaultsRequest(`/api/rolshutter/defaults?presetId=${encodeURIComponent(presetId)}`, { method: "DELETE" }),
    onSuccess: (_, presetId) => {
      queryClient.setQueryData<GateDefaultsResponse>(DEFAULTS_QUERY_KEY, (previous) => {
        const defaults = { ...previous?.defaults };
        delete defaults[presetId];
        return { canManage: previous?.canManage ?? true, defaults };
      });
      void queryClient.invalidateQueries({ queryKey: DEFAULTS_QUERY_KEY });
      applyConfiguration(factoryGateDefaults(presetId, catalog));
      setDefaultsNotice("Այս տեսակի սկզբնական կարգավորումները վերականգնված են։");
    },
  });
  const defaultsBusy = saveDefaults.isPending || resetDefaults.isPending;
  const defaultsReady = !!defaultsQuery.data && !defaultsQuery.isError;
  const clearDefaultsStatus = () => {
    setDefaultsNotice("");
    saveDefaults.reset();
    resetDefaults.reset();
  };
  const applyDoorPreset = (presetId: string) => {
    clearDefaultsStatus();
    const saved = defaultsQuery.data?.defaults[presetId];
    applyConfiguration(saved?.config ?? factoryGateDefaults(presetId, catalog));
    setSelectedPresetId(presetId);
    setPresetPanelOpen(false);
    setDefaultsNotice(saved ? "Կիրառվել են այս տեսակի պահպանված լռելյայն կարգավորումները։" : "Կիրառվել են այս տեսակի սկզբնական կարգավորումները։");
  };

  const setOverride = (key, field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value === "" ? "" : parseNum(value) },
    }));
  };

  const setProductForRow = (key, productId) => {
    const option = resolveCatalogOption(catalog[key], productId);
    if (!option) return;
    setOverrides((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], productId: option.id, variantId: option.variantId, price: undefined },
      };
      // Կողային կափարիչ always follows whatever Կոռոբ size is chosen
      if (key === "korob") {
        const size = String(option?.variantId ?? productId).match(/\d+$/)?.[0];
        const bakovinaOption = size && resolveCatalogOption(catalog.bakovina, `bakovina-${size}`);
        if (bakovinaOption) {
          next["bakovina"] = { ...prev["bakovina"], productId: bakovinaOption.id, variantId: bakovinaOption.variantId, price: undefined };
        }
      }
      return next;
    });
    setExpandedKey(null);
  };

  const removeRow = (key) => setRemovedKeys((prev) => [...prev, key]);
  const restoreRow = (key) => setRemovedKeys((prev) => prev.filter((k) => k !== key));

  const korobOverride = overrides["korob"] || {};
  const korobOptions = catalog["korob"] || [];
  const korobSelectedId = korobOverride.productId || korobOptions[0]?.id;
  const korobVariantId = resolveCatalogOption(korobOptions, korobSelectedId, korobOverride.variantId)?.variantId ?? korobSelectedId;
  const boxDepth = Number(String(korobVariantId || "").match(/\d+$/)?.[0]) || 30;

  // Profile line (3,9 / 5,5 / 7,7) is derived from whichever Լամիլ is selected —
  // drives the Տակացու/Ռետինե ժապավեն/Լամիլ meterage offset and the lamel-count divisor.
  const lamilOverrideTop = overrides["lamil"] || {};
  const lamilOptionsTop = catalog["lamil"] || [];
  const lamilSelectedIdTop = lamilOverrideTop.productId || lamilOptionsTop[0]?.id || "";
  const lamilVariantId = resolveCatalogOption(lamilOptionsTop, lamilSelectedIdTop, lamilOverrideTop.variantId)?.variantId ?? lamilSelectedIdTop;
  const currentLine = String(lamilVariantId).includes("77") ? "7,7" : String(lamilVariantId).includes("55") ? "5,5" : "3,9";
  const lineOffset = LINE_OFFSET[currentLine];

  const allRows = useMemo(() => {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const depth = boxDepth;

    return DEFAULT_MATERIALS.map((m) => {
      const ov = overrides[m.key] || {};
      const options = catalog[m.key] || [];
      const selectedProduct = resolveCatalogOption(options, ov.productId, ov.variantId) ?? options[0];
      const selectedId = selectedProduct?.id;
      const displayName = selectedProduct?.name || m.name;

      let meters: number | null = null;
      let qty = ov.qty !== undefined && ov.qty !== "" ? ov.qty : m.qty;
      let price = ov.price !== undefined && ov.price !== "" ? ov.price : (selectedProduct ? selectedProduct.price : m.price);
      // Manual meter override — when set, it replaces the auto-computed length.
      const manualMeters = ov.meters !== undefined && ov.meters !== "" ? Number(ov.meters) : null;

      let sum = 0;

      switch (m.mode) {
        case "meters_auto": {
          let offset = m.offset ?? 0;
          if (m.key === "korob") offset = depth === 35 || depth === 40 ? -0.005 : -0.01;
          if (m.key === "takatsu" || m.key === "rezin") offset = lineOffset;
          meters = manualMeters !== null ? manualMeters : w + offset;
          sum = meters * (price || 0);
          break;
        }
        case "meters_qty": {
          meters = manualMeters !== null ? manualMeters : w + lineOffset;
          sum = meters * (qty || 0) * (price || 0);
          break;
        }
        case "napravl": {
          meters = manualMeters !== null ? manualMeters : h - depth * 0.01;
          sum = meters * (qty || 0) * (price || 0);
          break;
        }
        case "chotka": {
          const napravlMeters = h - depth * 0.01;
          meters = manualMeters !== null ? manualMeters : napravlMeters * 4;
          sum = meters * (price || 0);
          break;
        }
        case "count": {
          sum = (qty || 0) * (price || 0);
          break;
        }
        case "zaglushka": {
          const lamilOv = overrides["lamil"] || {};
          qty = lamilOv.qty !== undefined && lamilOv.qty !== "" ? lamilOv.qty : DEFAULT_MATERIALS.find((x) => x.key === "lamil")?.qty;
          sum = (qty || 0) * (price || 0);
          break;
        }
        default:
          break;
      }

      return { ...m, name: displayName, meters, qty, price, sum, options, selectedId };
    });
  }, [width, height, boxDepth, lineOffset, overrides, catalog]);

  const visibleRows = allRows.filter((r) => !removedKeys.includes(r.key));
  const removedRows = allRows.filter((r) => removedKeys.includes(r.key));

  const area = (Number(width) || 0) * (Number(height) || 0);
  const materialsTotal = visibleRows.reduce((acc, r) => acc + (r.sum || 0), 0);
  const customTotal = customRows.reduce((acc, r) => acc + (Number(r.qty) || 0) * (Number(r.price) || 0), 0);
  const assemblySum = assemblyOn ? area * (Number(assemblyPricePerSqm) || 0) : 0;
  const deliverySum = deliveryOn ? Number(deliveryPrice) || 0 : 0;
  const total = materialsTotal + customTotal + assemblySum + deliverySum;
  const pricePerSqm = area > 0 ? materialsTotal / area : 0;

  // Notify parent of row changes (for order creation) — avoid infinite loops
  const lastSummaryRef = useRef("");
  useEffect(() => {
    if (typeof onRowsChange !== "function") return;
    try {
      const summary = [
        ...visibleRows
          .filter((r) => (Number(r.sum) || 0) > 0)
          .map((r) => {
            const selectedProduct = (catalog[r.key] || []).find((p) => p.id === r.selectedId);
            const unitCode = selectedProduct?.unit?.code ?? (r.mode === "count" || r.mode === "zaglushka" ? "piece" : "m");
            return {
              productId: selectedProduct?.id ?? null,
              name: String(r.name || ""),
              qty: Number(r.qty) || 0,
              meters: r.meters ?? null,
              price: Number(r.price) || 0,
              sum: Number(r.sum) || 0,
              color: color ?? null,
              unitCode,
              isService: false,
            };
          }),
        ...customRows
          .filter((r) => (Number(r.qty) || 0) * (Number(r.price) || 0) > 0)
          .map((r) => ({
            productId: null,
            name: String(r.name || "Այլ ապրանք"),
            qty: Number(r.qty) || 0,
            meters: null,
            price: Number(r.price) || 0,
            sum: (Number(r.qty) || 0) * (Number(r.price) || 0),
            color: null,
            unitCode: "piece",
            isService: false,
          })),
      ];
      if (assemblyOn && assemblySum > 0) {
        summary.push({
          productId: null,
          name: "Հավաքում",
          qty: 1,
          meters: null,
          price: Math.round(assemblySum),
          sum: Math.round(assemblySum),
          color: null,
          unitCode: "service",
          isService: true,
        });
      }
      if (deliveryOn && deliverySum > 0) {
        summary.push({
          productId: null,
          name: "Առաքում",
          qty: 1,
          meters: null,
          price: Math.round(deliverySum),
          sum: Math.round(deliverySum),
          color: null,
          unitCode: "service",
          isService: true,
        });
      }
      // Only call parent if summary actually changed (prevents infinite loop)
      const summaryKey = JSON.stringify(summary);
      if (summaryKey !== lastSummaryRef.current) {
        lastSummaryRef.current = summaryKey;
        onRowsChange(summary);
      }
    } catch (e) {
      // silent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, customRows, assemblyOn, assemblySum, deliveryOn, deliverySum, color, catalog]);

  const lastTotalRef = useRef(0);
  useEffect(() => {
    if (typeof onTotalChange === "function") {
      try {
        const t = Math.round(total);
        if (t !== lastTotalRef.current) {
          lastTotalRef.current = t;
          onTotalChange(t);
        }
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Lamel-count helper (C12 in the original sheet): (height - boxDepth*0.01) / line-divisor.
  const lamelDivisor = LAMEL_DIVISOR_BY_LINE[currentLine];
  const lamelRaw = (Number(height) - Number(boxDepth) * 0.01) / lamelDivisor;
  const lamelSuggested = Math.ceil(lamelRaw);
  const applySuggestedLamelCount = () => setOverride("lamil", "qty", lamelSuggested);

  const addCustomRow = () => setCustomRows((prev) => [...prev, { id: crypto.randomUUID(), name: "", qty: 1, price: 0 }]);
  const updateCustomRow = (id, field, value) => setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const removeCustomRow = (id) => setCustomRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div
      className="mx-auto max-w-3xl p-6 text-foreground print:p-2 print:max-w-none print:text-[11px]"
      style={{ fontFamily: "var(--font-noto-armenian), var(--font-geist-sans), system-ui, sans-serif" }}
    >
      <style>{`
        input, select, button, table { font-family: inherit; }
        @media print {
          @page { size: A4; margin: 10mm; }
          input, select { border: none !important; background: transparent !important; -webkit-appearance: none; appearance: none; }
          table { font-size: 10.5px; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-1 print:mb-2">
        <h1 className="text-2xl font-semibold print:text-base">Ռոլստորների կոնֆիգուրատոր</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden text-sm border border-neutral-300 rounded-md px-3 py-1.5 hover:bg-neutral-50"
        >
          Տպել
        </button>
      </div>

      {/* Door type presets */}
      <div className="mb-6 mt-3 print:mb-2 print:mt-1">
        <button
          type="button"
          onClick={() => setPresetPanelOpen((v) => !v)}
          className="print:hidden flex items-center justify-between w-full sm:w-auto sm:min-w-[320px] gap-3 border border-neutral-300 rounded-md px-4 py-2 text-sm hover:bg-neutral-50"
        >
          <span>
            Ընտրել դարպասի տեսակը{" "}
            {selectedPresetId && (
              <span className="text-neutral-500">
                — {DOOR_PRESETS.find((p) => p.id === selectedPresetId)?.label}
              </span>
            )}
          </span>
          <span className="text-neutral-400">{presetPanelOpen ? "▲" : "▼"}</span>
        </button>

        {presetPanelOpen && (
          <div className="print:hidden mt-2 border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-w-md">
            {DOOR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDoorPreset(p.id)}
                disabled={!defaultsReady || defaultsBusy}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 flex items-center justify-between disabled:opacity-50 ${
                  selectedPresetId === p.id ? "bg-neutral-50 font-medium" : ""
                }`}
              >
                <span>{p.label}</span>
                {defaultsQuery.data?.defaults[p.id] && <span className="text-xs text-emerald-700">Լռելյայնը պահպանված է</span>}
                {selectedPresetId === p.id && <span className="text-neutral-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}

        <div className="print:hidden mt-3 space-y-2 text-sm">
          {defaultsQuery.isPending && <p role="status" className="text-muted-foreground">Կարգավորումները բեռնվում են…</p>}
          {defaultsQuery.isError && (
            <div role="alert" className="text-red-600">
              Չհաջողվեց բեռնել լռելյայն կարգավորումները։{" "}
              <button type="button" className="underline" disabled={defaultsQuery.isFetching} onClick={() => void defaultsQuery.refetch()}>Փորձել կրկին</button>
            </div>
          )}
          {selectedPresetId && defaultsReady && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-3">
              <p className="text-xs text-neutral-600">
                {savedDefault ? "Այս տեսակի համար կան պահպանված լռելյայն կարգավորումներ։" : "Այս տեսակի համար դեռ լռելյայն կարգավորումներ չեն պահպանվել։"}
                {" "}Պահպանվում են ապրանքները, քանակները, ձեռքով նշված գները, գույնը և լրացուցիչ ծառայությունները։
                {" "}Լայնքը, բարձրությունը և ձեռքով նշված երկարությունները լրացվում են առանձին՝ յուրաքանչյուր պատվերի համար։
              </p>
              <div className="flex flex-wrap gap-2">
                {defaultsQuery.data?.canManage && (
                  <button type="button" disabled={defaultsBusy} onClick={() => { clearDefaultsStatus(); saveDefaults.mutate(selectedPresetId); }}
                    className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs disabled:opacity-50">
                    {saveDefaults.isPending ? "Պահպանվում է…" : savedDefault ? "Թարմացնել լռելյայնը" : "Պահպանել որպես լռելյայն"}
                  </button>
                )}
                {savedDefault && (
                  <button type="button" disabled={defaultsBusy} onClick={() => applyDoorPreset(selectedPresetId)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-xs hover:bg-white disabled:opacity-50">
                    Կիրառել լռելյայնը
                  </button>
                )}
                {savedDefault && defaultsQuery.data?.canManage && (
                  <button type="button" disabled={defaultsBusy} onClick={() => { clearDefaultsStatus(); resetDefaults.mutate(selectedPresetId); }}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-xs hover:bg-white disabled:opacity-50">
                    {resetDefaults.isPending ? "Վերականգնվում է…" : "Վերականգնել սկզբնականը"}
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-500">Կարգավորումները ընդհանուր են բոլոր պատվերների համար։ Դրանք կարող է փոխել ադմինիստրատորը։</p>
            </div>
          )}
          {(saveDefaults.error || resetDefaults.error) && <p role="alert" className="text-red-600">{(saveDefaults.error || resetDefaults.error)?.message}</p>}
          {defaultsNotice && <p role="status" className="text-emerald-700">{defaultsNotice}</p>}
        </div>

        {selectedPresetId && !presetPanelOpen && (
          <p className="hidden print:block text-[11px] text-neutral-500 mt-1">
            {DOOR_PRESETS.find((p) => p.id === selectedPresetId)?.label}
          </p>
        )}
      </div>

      {/* Top inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 print:grid-cols-2 print:gap-2 print:mb-2">
        <label className="flex flex-col gap-1 text-sm print:text-xs">
          Լայնք, մ
          <input
            type="number"
            step="0.01"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 print:px-0 print:py-0"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm print:text-xs">
          Բարձրություն, մ
          <input
            type="number"
            step="0.01"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 print:px-0 print:py-0"
          />
        </label>
      </div>

      {/* Color */}
      <div className="grid grid-cols-1 gap-4 mb-8 print:gap-2 print:mb-2">
        <label className="flex flex-col gap-1 text-sm print:text-xs">
          Գույն
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 print:px-0 print:py-0"
          >
            {DEFAULT_COLORS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Lamel count helper */}
      <div className="flex items-center justify-between border border-neutral-200 rounded-lg px-4 py-3 mb-6 bg-neutral-50 text-sm print:hidden">
        <div>
          Անհրաժեշտ լամելների քանակ՝ {" "}
          <span className="font-medium">{isFinite(lamelRaw) ? lamelRaw.toFixed(2) : "—"}</span>
          {" "}→ կլորացված՝{" "}
          <span className="font-medium">{isFinite(lamelSuggested) ? lamelSuggested : "—"} հատ</span>
        </div>
        <button
          type="button"
          onClick={applySuggestedLamelCount}
          className="border border-neutral-300 rounded-md px-3 py-1 hover:bg-neutral-100"
        >
          Տեղադրել աղյուսակում
        </button>
      </div>

      {/* Materials table */}
      <div className="overflow-x-auto border border-neutral-200 rounded-lg mb-2 print:border-neutral-400">
        <table className="w-full text-sm print:text-[11px]">
          <thead className="bg-neutral-50 text-neutral-600 print:bg-transparent">
            <tr>
              <th className="text-left px-3 py-2 print:px-1 print:py-1">Ապրանք</th>
              <th className="text-right px-3 py-2 print:px-1 print:py-1">Մետր</th>
              <th className="text-right px-3 py-2 print:px-1 print:py-1">Հատ</th>
              <th className="text-right px-3 py-2 print:px-1 print:py-1">Գին</th>
              <th className="text-right px-3 py-2 print:px-1 print:py-1">Գումար</th>
              <th className="w-6 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <Fragment key={r.key}>
                <tr className="border-t border-neutral-100 print:border-neutral-300">
                  <td className="px-3 py-2 min-w-[220px] print:px-1 print:py-1 print:min-w-0">
                    {r.options.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expandedKey === r.key ? null : r.key)}
                        className="w-full flex items-center justify-between gap-2 text-left print:pointer-events-none"
                      >
                        <span>{r.name}</span>
                        <span className="text-neutral-400 text-xs print:hidden">
                          {expandedKey === r.key ? "▲" : "▼ փոխել"}
                        </span>
                      </button>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-500 print:px-1 print:py-1">
                    {r.meters !== null ? (
                      <input
                        type="number"
                        step="0.001"
                        aria-label={`${r.name}՝ մետր`}
                        value={r.meters}
                        onChange={(e) => setOverride(r.key, "meters", e.target.value)}
                        className="w-20 border border-neutral-200 rounded px-1 py-0.5 text-right print:w-14 print:px-0 print:py-0"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right print:px-1 print:py-1">
                    {r.mode === "count" || r.mode === "meters_qty" || r.mode === "napravl" ? (
                      <input
                        type="number"
                        aria-label={`${r.name}՝ քանակ`}
                        value={r.qty ?? ""}
                        onChange={(e) => setOverride(r.key, "qty", e.target.value)}
                        className="w-16 border border-neutral-200 rounded px-1 py-0.5 text-right print:w-10 print:px-0 print:py-0"
                      />
                    ) : r.mode === "zaglushka" ? (
                      <span className="text-neutral-500">{r.qty}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right print:px-1 print:py-1">
                    <input
                      type="number"
                      aria-label={`${r.name}՝ գին`}
                      value={r.price ?? ""}
                      onChange={(e) => setOverride(r.key, "price", e.target.value)}
                      className="w-20 border border-neutral-200 rounded px-1 py-0.5 text-right print:w-14 print:px-0 print:py-0"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium print:px-1 print:py-1">{formatAmd(r.sum)}</td>
                  <td className="px-1 print:hidden">
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label={`Ջնջել ${r.name}`}
                      title="Հաճախորդը այս ապրանքը չի ուզում"
                    >
                      ✕
                    </button>
                  </td>
                </tr>

                {r.options.length > 1 && expandedKey === r.key && (
                  <tr className="print:hidden">
                    <td colSpan={6} className="bg-neutral-50 px-3 py-2 border-t border-neutral-100">
                      <div className="text-xs text-neutral-500 mb-1">Այս կատեգորիայի այլ տարբերակները՝</div>
                      <table className="w-full text-xs">
                        <thead className="text-neutral-500">
                          <tr>
                            <th className="text-left py-1 font-normal">Ապրանք</th>
                            <th className="text-right py-1 font-normal">Գին</th>
                            <th className="w-24"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.options.map((o) => {
                            const isSelected = o.id === r.selectedId;
                            return (
                              <tr key={o.id} className={isSelected ? "bg-white" : ""}>
                                <td className={`py-1.5 pr-2 ${isSelected ? "font-medium" : ""}`}>{o.name}</td>
                                <td className="py-1.5 text-right pr-2">{formatAmd(o.price)}</td>
                                <td className="py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setProductForRow(r.key, o.id)}
                                    disabled={isSelected}
                                    className={
                                      isSelected
                                        ? "text-neutral-400 cursor-default"
                                        : "border border-neutral-300 rounded px-2 py-0.5 hover:bg-neutral-100"
                                    }
                                  >
                                    {isSelected ? "Ընտրված է" : "Ընտրել"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            {customRows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 bg-amber-50/40 print:bg-transparent print:border-neutral-300">
                <td className="px-3 py-2 print:px-1 print:py-1">
                  <input
                    type="text"
                    value={r.name}
                    placeholder="Ապրանքի անվանումը"
                    onChange={(e) => updateCustomRow(r.id, "name", e.target.value)}
                    className="w-full border border-neutral-200 rounded px-2 py-1 print:px-0 print:py-0"
                  />
                </td>
                <td className="px-3 py-2 text-right text-neutral-400 print:px-1 print:py-1">—</td>
                <td className="px-3 py-2 text-right print:px-1 print:py-1">
                  <input
                    type="number"
                    value={r.qty}
                    onChange={(e) => updateCustomRow(r.id, "qty", e.target.value)}
                    className="w-16 border border-neutral-200 rounded px-1 py-0.5 text-right print:w-10 print:px-0 print:py-0"
                  />
                </td>
                <td className="px-3 py-2 text-right print:px-1 print:py-1">
                  <input
                    type="number"
                    value={r.price}
                    onChange={(e) => updateCustomRow(r.id, "price", e.target.value)}
                    className="w-20 border border-neutral-200 rounded px-1 py-0.5 text-right print:w-14 print:px-0 print:py-0"
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium print:px-1 print:py-1">
                  {formatAmd((Number(r.qty) || 0) * (Number(r.price) || 0))}
                </td>
                <td className="px-1 print:hidden">
                  <button
                    type="button"
                    onClick={() => removeCustomRow(r.id)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Ջնջել տողը"
                    title="Ջնջել տողը"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {removedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs text-neutral-500 print:hidden">
          <span>Թաքցված (հաճախորդը հրաժարվել է)՝</span>
          {removedRows.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => restoreRow(r.key)}
              className="border border-neutral-200 rounded-full px-2 py-0.5 hover:bg-neutral-50"
            >
              + {r.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addCustomRow}
        className="mb-6 text-sm border border-dashed border-neutral-300 rounded-md px-3 py-1.5 hover:bg-neutral-50 print:hidden"
      >
        + Ավելացնել իմ ապրանքը
      </button>

      {/* Optional add-ons: assembly & delivery */}
      <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-6 print:border-neutral-400 print:divide-neutral-300 print:mb-2">
        <div className="flex items-center gap-3 px-4 py-3 text-sm print:px-1 print:py-1">
          <input
            type="checkbox"
            aria-label="Հավաքում"
            checked={assemblyOn}
            onChange={(e) => setAssemblyOn(e.target.checked)}
          />
          <span className="flex-1">Հավաքում (ըստ ցանկության)</span>
          <span className="text-neutral-500 hidden sm:inline print:inline">
            <input
              type="number"
              aria-label="Հավաքման գին՝ ք.մ"
              value={assemblyPricePerSqm}
              onChange={(e) => setAssemblyPricePerSqm(e.target.value)}
              disabled={!assemblyOn}
              className="w-20 border border-neutral-200 rounded px-1 py-0.5 text-right disabled:opacity-40 print:w-14 print:px-0 print:py-0"
            /> ֏/ք.մ
          </span>
          <span className="font-medium w-24 text-right">
            {assemblyOn ? formatAmd(assemblySum) : <span className="text-neutral-400">—</span>}
          </span>
        </div>
        {assemblyOn && (
          <div className="flex items-center gap-3 px-4 py-3 text-sm print:px-1 print:py-1">
            <span className="flex-1 pl-7">Շարժիչի կողմը</span>
            <select
              aria-label="Շարժիչի կողմը"
              value={motorSide}
              onChange={(e) => setMotorSide(e.target.value)}
              className="border border-neutral-200 rounded px-2 py-1 print:px-0 print:py-0"
            >
              <option value="right">Աջ</option>
              <option value="left">Ձախ</option>
            </select>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3 text-sm print:px-1 print:py-1">
          <input
            type="checkbox"
            aria-label="Առաքում"
            checked={deliveryOn}
            onChange={(e) => setDeliveryOn(e.target.checked)}
          />
          <span className="flex-1">Առաքում (ըստ ցանկության)</span>
          <span className="text-neutral-500 hidden sm:inline print:inline">
            <input
              type="number"
              aria-label="Առաքման գին"
              value={deliveryPrice}
              onChange={(e) => setDeliveryPrice(e.target.value)}
              disabled={!deliveryOn}
              placeholder="գին"
              className="w-20 border border-neutral-200 rounded px-1 py-0.5 text-right disabled:opacity-40 print:w-14 print:px-0 print:py-0"
            /> ֏
          </span>
          <span className="font-medium w-24 text-right">
            {deliveryOn ? formatAmd(deliverySum) : <span className="text-neutral-400">—</span>}
          </span>
        </div>
      </div>

      {/* Totals */}
      <div className="flex flex-col items-end gap-1 print:gap-0.5">
        <div className="text-sm text-neutral-500 print:text-[11px]">Մակերես՝ {area.toFixed(2)} ք/մ</div>
        <div className="text-sm text-neutral-500 print:text-[11px]">Գույն՝ {color}</div>
        <div className="text-sm text-neutral-500 print:text-[11px]">Գին/ք.մ (նյութեր)՝ {formatAmd(pricePerSqm)}</div>
        {assemblyOn && <div className="text-sm text-neutral-500 print:text-[11px]">Հավաքում՝ {formatAmd(assemblySum)}</div>}
        {assemblyOn && <div className="text-sm text-neutral-500 print:text-[11px]">Շարժիչի կողմը՝ {motorSide === "right" ? "Աջ" : "Ձախ"}</div>}
        {deliveryOn && <div className="text-sm text-neutral-500 print:text-[11px]">Առաքում՝ {formatAmd(deliverySum)}</div>}
        <div className="text-xl font-semibold mt-1 print:text-base print:mt-1">Ընդամենը՝ {formatAmd(total)}</div>
      </div>
    </div>
  );
}
