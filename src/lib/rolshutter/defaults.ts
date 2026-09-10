import { z } from "zod";
import {
  ASSEMBLY_PRICE_PER_SQM_DEFAULT, DEFAULT_COLORS, DEFAULT_MATERIALS,
  DEFAULT_VARIANTS, DOOR_PRESETS, LINE_39_EXCLUDED_KEYS, LINE_VARIANTS,
  SECURITY_ONLY_KEYS, type Catalog, type CatalogOption,
} from "./catalog";

export const DEFAULTS_KEY_PREFIX = "rolshutter.defaults.v1.";
export const DEFAULTS_QUERY_KEY = ["rolshutter-defaults"] as const;
const materialKeys = new Set(DEFAULT_MATERIALS.map((material) => material.key));
export const presetIdSchema = z.string().refine(
  (id) => DOOR_PRESETS.some((preset) => preset.id === id), "Unknown gate type",
);
const quantitySchema = z.number().finite().min(0).max(1_000_000);
const priceSchema = z.number().finite().min(0).max(1_000_000_000);
const selectionSchema = z.object({
  productId: z.string().min(1).max(200),
  variantId: z.string().min(1).max(100),
  qty: quantitySchema.optional(),
  price: priceSchema.optional(),
}).strict();

// Dimensions and manual lengths deliberately never belong to shared defaults.
export const gateDefaultsSchema = z.object({
  version: z.literal(1),
  color: z.string().refine((color) => DEFAULT_COLORS.includes(color)),
  motorSide: z.enum(["right", "left"]),
  overrides: z.record(z.string(), selectionSchema).superRefine((rows, ctx) => {
    for (const [key, row] of Object.entries(rows)) {
      if (!materialKeys.has(key) || !DEFAULT_VARIANTS[key]?.some((v) => v.id === row.variantId)) {
        ctx.addIssue({ code: "custom", path: [key], message: "Unknown material variant" });
      }
    }
    if (Object.keys(rows).length !== materialKeys.size) {
      ctx.addIssue({ code: "custom", message: "Incomplete material selection" });
    }
  }),
  removedKeys: z.array(z.string().refine((key) => materialKeys.has(key))).max(materialKeys.size),
  customRows: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    qty: quantitySchema,
    price: priceSchema,
  }).strict()).max(100),
  assemblyOn: z.boolean(),
  assemblyPricePerSqm: priceSchema,
  deliveryOn: z.boolean(),
  deliveryPrice: priceSchema,
}).strict();

export const saveGateDefaultsSchema = z.object({
  presetId: presetIdSchema,
  config: gateDefaultsSchema,
}).strict();
export type GateDefaults = z.infer<typeof gateDefaultsSchema>;
export type SavedGateDefaults = { config: GateDefaults; updatedAt: string };
export type GateDefaultsResponse = {
  defaults: Record<string, SavedGateDefaults>;
  canManage: boolean;
};
export type RowOverride = {
  productId?: string;
  variantId?: string;
  qty?: number | "";
  price?: number | "";
  meters?: number | "";
};
export type CalculatorConfig = {
  color: string;
  motorSide: string;
  overrides: Record<string, RowOverride>;
  removedKeys: string[];
  customRows: { name: string; qty: number | string; price: number | string }[];
  assemblyOn: boolean;
  assemblyPricePerSqm: number | string;
  deliveryOn: boolean;
  deliveryPrice: number | string;
};

export function resolveCatalogOption(options: CatalogOption[] = [], productId?: string, variantId?: string) {
  return options.find((option) => option.id === productId)
    ?? options.find((option) => option.variantId === (variantId ?? productId));
}

export function factoryGateDefaults(presetId: string, catalog: Catalog): GateDefaults {
  const preset = DOOR_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error("Unknown gate type");
  const variants = LINE_VARIANTS[preset.line];
  const overrides: GateDefaults["overrides"] = {};
  for (const material of DEFAULT_MATERIALS) {
    const variant = material.key === "bakovina"
      ? `bakovina-${variants.korob.match(/\d+$/)?.[0]}`
      : variants[material.key];
    const option = resolveCatalogOption(catalog[material.key], variant) ?? catalog[material.key]?.[0];
    if (!option) throw new Error("Missing material catalog");
    overrides[material.key] = { productId: option.id, variantId: option.variantId };
  }
  return {
    version: 1,
    color: DEFAULT_COLORS[0], motorSide: "right", overrides,
    removedKeys: [
      ...(preset.tier === "standart" ? ["top_lock", ...SECURITY_ONLY_KEYS] : ["kakhich"]),
      ...(preset.line === "3,9" ? LINE_39_EXCLUDED_KEYS : []),
    ],
    customRows: [], assemblyOn: false, assemblyPricePerSqm: ASSEMBLY_PRICE_PER_SQM_DEFAULT,
    deliveryOn: false, deliveryPrice: 0,
  };
}

export function captureGateDefaults(state: CalculatorConfig, catalog: Catalog): GateDefaults {
  const overrides: GateDefaults["overrides"] = {};
  for (const material of DEFAULT_MATERIALS) {
    const row = state.overrides[material.key] ?? {};
    const option = resolveCatalogOption(catalog[material.key], row.productId, row.variantId)
      ?? catalog[material.key]?.[0];
    if (!option) throw new Error("Missing material catalog");
    overrides[material.key] = {
      productId: option.id, variantId: option.variantId,
      ...(row.qty !== undefined && row.qty !== "" ? { qty: row.qty } : {}),
      ...(row.price !== undefined && row.price !== "" ? { price: row.price } : {}),
    };
  }
  return gateDefaultsSchema.parse({
    version: 1, color: state.color, motorSide: state.motorSide, overrides,
    removedKeys: [...new Set(state.removedKeys)],
    customRows: state.customRows.map(({ name, qty, price }) => ({ name, qty: Number(qty), price: Number(price) })),
    assemblyOn: state.assemblyOn, assemblyPricePerSqm: Number(state.assemblyPricePerSqm),
    deliveryOn: state.deliveryOn, deliveryPrice: Number(state.deliveryPrice),
  });
}

export function restoreGateDefaults(config: GateDefaults, catalog: Catalog): GateDefaults {
  const restored = structuredClone(config);
  for (const [key, row] of Object.entries(restored.overrides)) {
    const option = resolveCatalogOption(catalog[key], row.productId, row.variantId);
    if (option) row.productId = option.id;
  }
  return restored;
}
