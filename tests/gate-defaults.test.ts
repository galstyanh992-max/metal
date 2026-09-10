import { describe, expect, test } from "bun:test";
import { buildCatalog, DEFAULT_COLORS, DEFAULT_VARIANTS, DOOR_PRESETS } from "../src/lib/rolshutter/catalog";
import {
  captureGateDefaults, factoryGateDefaults, gateDefaultsSchema, restoreGateDefaults,
  resolveCatalogOption, saveGateDefaultsSchema,
} from "../src/lib/rolshutter/defaults";

const products = Object.values(DEFAULT_VARIANTS).flat().map((variant, index) => ({
  id: `db-product-${index}`, name: variant.name, salePrice: index + 100,
}));
const catalog = buildCatalog(products);

describe("gate defaults", () => {
  for (const preset of DOOR_PRESETS) {
    test(`${preset.id} selects real catalog IDs and matching side caps`, () => {
      const config = factoryGateDefaults(preset.id, catalog);
      expect(gateDefaultsSchema.safeParse(config).success).toBe(true);
      expect(config.overrides.lamil.variantId).toBe(`lamil-${preset.id.slice(0, 2)}`);
      for (const row of Object.values(config.overrides)) {
        expect(row.productId.startsWith("db-product-")).toBe(true);
        expect(row.price).toBeUndefined();
      }
      expect(config.overrides.bakovina.variantId.split("-")[1]).toBe(config.overrides.korob.variantId.split("-")[1]);
    });
  }

  test("switching from 3.9 Standart to 7.7 Security restores its full equipment", () => {
    const small = factoryGateDefaults("39-standart", catalog);
    small.overrides.motor.qty = 9;
    small.removedKeys.push("lamil");
    const large = factoryGateDefaults("77-security", catalog);
    expect(large.removedKeys).toEqual(["kakhich"]);
    expect(large.overrides.motor.qty).toBeUndefined();
    expect(large.overrides.motor.variantId).toBe("motor-80-70");
    expect(small.removedKeys).toContain("rolik");
  });

  test("saves equipment, manual prices, colors and services, excluding all dimensions", () => {
    const state = {
      ...factoryGateDefaults("55-security", catalog), width: 8, height: 6,
      color: DEFAULT_COLORS[2], motorSide: "left", assemblyOn: true,
      assemblyPricePerSqm: "2500", deliveryOn: true, deliveryPrice: "6000",
      customRows: [{ id: "temporary-ui-id", name: "Extra part", qty: "2", price: "800" }],
    };
    const config = captureGateDefaults({
      ...state, overrides: { ...state.overrides, lamil: { ...state.overrides.lamil, qty: 38, price: 1900, meters: 7.91 } },
    }, catalog);
    expect(config).not.toHaveProperty("width");
    expect(config).not.toHaveProperty("height");
    expect(config.overrides.lamil).not.toHaveProperty("meters");
    expect(config.overrides.lamil.qty).toBe(38);
    expect(config.overrides.lamil.price).toBe(1900);
    expect(config.color).toBe(DEFAULT_COLORS[2]);
    expect(config.motorSide).toBe("left");
    expect(config.assemblyPricePerSqm).toBe(2500);
    expect(config.deliveryPrice).toBe(6000);
    expect(config.customRows).toEqual([{ name: "Extra part", qty: 2, price: 800 }]);
  });

  test("catalog price changes stay live unless a price was manually overridden", () => {
    const config = captureGateDefaults(factoryGateDefaults("77-standart", catalog), catalog);
    config.overrides.motor.price = 17000;
    const refreshed = buildCatalog(products.map((product) => ({ ...product, salePrice: product.salePrice * 2 })));
    const restored = restoreGateDefaults(config, refreshed);
    expect(restored.overrides.korob.price).toBeUndefined();
    expect(resolveCatalogOption(refreshed.korob, restored.overrides.korob.productId)?.price).toBe(catalog.korob[3].price * 2);
    expect(restored.overrides.motor.price).toBe(17000);
  });

  test("stored variants resolve when inventory loads later or product IDs change", () => {
    const config = factoryGateDefaults("77-standart", buildCatalog([]));
    const restored = restoreGateDefaults(config, catalog);
    expect(restored.overrides.korob.productId).toBe(catalog.korob[3].id);
    expect(restored.overrides.bakovina.productId).toBe(catalog.bakovina[3].id);
    expect(config.overrides.korob.productId).toBe("korob-30");
  });

  test("editing restored defaults does not mutate the saved configuration", () => {
    const config = factoryGateDefaults("39-security", catalog);
    config.customRows = [{ name: "Extra", qty: 1, price: 2 }];
    const restored = restoreGateDefaults(config, catalog);
    restored.removedKeys.push("lamil");
    restored.overrides.korob.qty = 3;
    restored.customRows[0].price = 40;
    expect(config.removedKeys).not.toContain("lamil");
    expect(config.overrides.korob.qty).toBeUndefined();
    expect(config.customRows[0].price).toBe(2);
  });

  test("rejects invalid types, dimensions, unknown materials and invalid amounts", () => {
    const config = factoryGateDefaults("77-standart", catalog);
    expect(saveGateDefaultsSchema.safeParse({ presetId: "arbitrary-setting", config }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, width: 9 }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, deliveryPrice: -1 }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, assemblyPricePerSqm: Infinity }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, overrides: {} }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, removedKeys: ["unknown"] }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, overrides: {
      ...config.overrides, motor: { productId: "x", variantId: "korob-30" },
    } }).success).toBe(false);
    expect(gateDefaultsSchema.safeParse({ ...config, customRows: [{ name: "  ", qty: 1, price: 4 }] }).success).toBe(false);
  });
});
