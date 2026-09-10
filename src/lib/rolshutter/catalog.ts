export type WarehouseProduct = { id: string; name: string; salePrice: number; unit?: { code: string }; stock?: { available: number } };
export type CatalogOption = { id: string; variantId: string; name: string; price: number; unit?: { code: string }; stock?: { available: number } };
export type Catalog = Record<string, CatalogOption[]>;

export const ASSEMBLY_PRICE_PER_SQM_DEFAULT = 2000;

// Lamel-height divisor per profile line, used by the "how many lamels do I need"
// helper (mirrors C12 in the original sheet, which used 0.077 for the 7,7 line).
export const LAMEL_DIVISOR_BY_LINE = { "7,7": 0.077, "5,5": 0.055, "3,9": 0.039 };
// Meterage taken off Լամիլ/Տակացու/Ռետինե ժապավեն for each profile line
export const LINE_OFFSET = { "7,7": -0.11, "5,5": -0.095, "3,9": -0.075 };

// Door "type" presets — pick the profile line (3,9 / 5,5 / 7,7) and tier
// (Standart / Security). Standart uses Կախիչ; Security swaps it for
// Վերին ավտոմատ փական: Standart also drops Ադապտեր / Կառավարման անջատիչ /
// Սահմանափակիչ թիթեղ / Կողպեկ (Security keeps them). Everything set by a
// preset stays fully editable afterwards — this is just a fast starting point.
// LINE_VARIANTS — default product selection per profile line.
// Mapped from user's specification:
//   7,7: Կոռոբ 30, Վալ 70, Լամիլ 7,7, Տակացու 7,7, Ռետինե 7,7, Ուղղորդիչ 7,7,
//         Պուխ խոշոր, Առանցքակալ մեծ, Ամրակ մեծ, Օս դյուրալյումինե 70,
//         Ռոլիկ մեծ, Օղակ 70, Կախիչ 7,7/5,5, Խցան 7,7, Կարդան ունիվերսալ,
//         Վթարային DS38A, Շարժիչ 80Nm(70), Բլոկ DC155
//   5,5: Կոռոբ 25, Վալ 60, Լամիլ 5,5, ... Պուխ մանր, Օս պլաստմասե 60,
//         Օղակ 60, Կախիչ 7,7/5,5, Խցան 5,5, Կարդան ունիվերսալ,
//         Վթարային DS38A, Շարժիչ 50Nm վթարային, Բլոկ DC155
//   3,9: Կոռոբ 20, Վալ 40, Լամիլ 3,9, ... Պուխ մանր, Առանցքակալ փոքր,
//         Օս պլաստմասե 40, Օղակ 40, Կախիչ 3,9, Խցան 3,9,
//         Շարժիչ 20Nm, Բլոկ DC155
//         (NO Կարդան, NO Վթարային բռնակ, NO Ամրակ, NO Ռոլիկ)
export const LINE_VARIANTS = {
  "7,7": {
    lamil: "lamil-77", takatsu: "takatsu-77", rezin: "rezin-77",
    napravl: "napravl-77", zaglushka: "zaglushka-77",
    kakhich: "kakhich-77-55", top_lock: "top_lock-77",
    korob: "korob-30", val: "val-70", kaltso: "kaltso-70",
    os: "os-alu-70",  // դյուրալյումինե 70
    bearing: "bearing-big", bearing_holder: "bearing_holder-big",
    rolik: "rolik-big",
    chotka: "chotka-big",  // Պուխ խոշոր
    kardan: "kardan-universal",
    emergency_handle: "handle-ds38a",
    motor: "motor-80-70",  // 80Nm (70)
    blok: "blok-dc155-1ch",
  },
  "5,5": {
    lamil: "lamil-55", takatsu: "takatsu-55", rezin: "rezin-55",
    napravl: "napravl-55", zaglushka: "zaglushka-55",
    kakhich: "kakhich-77-55", top_lock: "top_lock-77",
    korob: "korob-25", val: "val-60", kaltso: "kaltso-60",
    os: "os-plastic-60",  // պլաստմասե 60
    bearing: "bearing-big", bearing_holder: "bearing_holder-big",
    rolik: "rolik-big",
    chotka: "chotka-small",  // Պուխ մանր
    kardan: "kardan-universal",
    emergency_handle: "handle-ds38a",
    motor: "motor-50noem-60",  // 50Nm վթարային
    blok: "blok-dc155-1ch",
  },
  "3,9": {
    lamil: "lamil-39", takatsu: "takatsu-39", rezin: "rezin-39",
    napravl: "napravl-39", zaglushka: "zaglushka-39",
    kakhich: "kakhich-39", top_lock: "top_lock-77",
    korob: "korob-20", val: "val-40", kaltso: "kaltso-40",
    os: "os-plastic-40",  // պլաստմասե 40
    bearing: "bearing-small",  // փոքր (no holder for 3,9)
    chotka: "chotka-small",  // Պուխ մանր
    // NO kardan, NO emergency_handle, NO rolik for 3,9
    motor: "motor-20-60",  // 20Nm
    blok: "blok-dc155-1ch",
  },
};

// Items removed for 3,9 line (simpler construction)
export const LINE_39_EXCLUDED_KEYS = ["kardan", "emergency_handle", "bearing_holder", "rolik"];

// Items only in Security tier (not in Standart): top_lock replaces kakhich
// Standart: has Կախիչ (kakhich), no Վերին փական (top_lock)
// Security: has Վերին փական (top_lock), no Կախիչ (kakhich)
export const SECURITY_ONLY_KEYS = ["adapter", "control_switch", "limiter_plate", "lock"];

export const DOOR_PRESETS = [
  { id: "77-standart", label: "Ռոլետային դարպաս 7,7 Standart", line: "7,7", tier: "standart" },
  { id: "77-security", label: "Ռոլետային դարպաս 7,7 Security", line: "7,7", tier: "security" },
  { id: "55-standart", label: "Ռոլետային դարպաս 5,5 Standart", line: "5,5", tier: "standart" },
  { id: "55-security", label: "Ռոլետային դարպաս 5,5 Security", line: "5,5", tier: "security" },
  { id: "39-standart", label: "Ռոլետային դարպաս 3,9 Standart", line: "3,9", tier: "standart" },
  { id: "39-security", label: "Ռոլետային դարպաս 3,9 Security", line: "3,9", tier: "security" },
];

// mode meanings:
//  meters_auto — meters = width + offset, sum = meters * price
//  meters_qty  — meters = width + offset, sum = meters * qty * price
//  napravl     — meters = height - boxDepth*0.01, sum = meters * qty * price
//  chotka      — meters = napravl_meters * 4, sum = meters * price
//  count       — sum = qty * price
//  zaglushka   — qty mirrors Լամիլ qty, sum = qty * price
export const DEFAULT_MATERIALS = [
  { key: "korob", name: "Կոռոբ", mode: "meters_auto", offset: -0.01, price: null, qty: null },
  { key: "val", name: "Վալ", mode: "meters_auto", offset: -0.05, price: null, qty: null },
  { key: "lamil", name: "Լամիլ", mode: "meters_qty", offset: -0.11, price: null, qty: 30 },
  { key: "takatsu", name: "Տակացու", mode: "meters_auto", offset: -0.11, price: null, qty: null },
  { key: "rezin", name: "Ռետինե ժապավեն", mode: "meters_auto", offset: -0.11, price: null, qty: null },
  { key: "napravl", name: "Ուղղորդիչ", mode: "napravl", price: null, qty: 2 },
  { key: "chotka", name: "Պուխ", mode: "chotka", price: null },
  { key: "bakovina", name: "Կողային կափարիչ", mode: "count", price: null, qty: 1 },
  { key: "bearing", name: "Առանցքակալ", mode: "count", price: null, qty: 1 },
  { key: "bearing_holder", name: "Առանցքակալի ամրակ", mode: "count", price: null, qty: 1 },
  { key: "os", name: "Օս", mode: "count", price: null, qty: 1 },
  { key: "rolik", name: "Ռոլիկ", mode: "count", price: null, qty: 1 },
  { key: "kaltso", name: "Օղակ", mode: "count", price: null, qty: 8 },
  { key: "kakhich", name: "Կախիչ", mode: "count", price: null, qty: 10 },
  { key: "top_lock", name: "Վերին ավտոմատ փական", mode: "count", price: null, qty: 1 },
  { key: "zaglushka", name: "Լամիլի խցան", mode: "zaglushka", price: null },
  { key: "kardan", name: "Կարդան", mode: "count", price: null, qty: 1 },
  { key: "emergency_handle", name: "Վթարային բռնակ", mode: "count", price: null, qty: 1 },
  { key: "motor", name: "Շարժիչ", mode: "count", price: null, qty: 1 },
  { key: "pult", name: "Պուլտ", mode: "count", price: null, qty: 1 },
  { key: "blok", name: "Բլոկ", mode: "count", price: null, qty: 1 },
  { key: "control_switch", name: "Կառավարման անջատիչ", mode: "count", price: null, qty: 1 },
  { key: "adapter", name: "Ադապտեր", mode: "count", price: null, qty: 1 },
  { key: "limiter_plate", name: "Սահմանափակիչ թիթեղ", mode: "count", price: null, qty: 1 },
  { key: "lock", name: "Կողպեկ", mode: "count", price: null, qty: 1 },
];

export const DEFAULT_COLORS = [
  "Անտրացիտ V16 (RAL 7016)",
  "Մետալիկ Y06 (RAL 9006)",
  "Սպիտակ W16 (RAL 9016)",
  "Շագանակագույն M14 (RAL 8014)",
  "Ոսկեգույն դուբ (A40)",
  "Դուբ (A25)",
];

// Built-in catalog per category — replace/extend with your own real items and
// prices, or feed them in live via the `products` prop (fully replaces a
// category's variants the first time real CRM data for it shows up).
export const DEFAULT_VARIANTS = {
  korob: [
    { id: "korob-16", name: "Կոռոբ 16", price: 0 },
    { id: "korob-20", name: "Կոռոբ 20", price: 0 },
    { id: "korob-25", name: "Կոռոբ 25", price: 12000 },
    { id: "korob-30", name: "Կոռոբ 30", price: 14500 },
    { id: "korob-35", name: "Կոռոբ 35", price: 16500 },
    { id: "korob-40", name: "Կոռոբ 40", price: 0 },
  ],
  val: [
    { id: "val-40", name: "Վալ 40", price: 2400 },
    { id: "val-60", name: "Վալ 60", price: 2400 },
    { id: "val-70", name: "Վալ 70", price: 2400 },
    { id: "val-102", name: "Վալ 102", price: 2400 },
  ],
  lamil: [
    { id: "lamil-39", name: "Լամիլ 3,9", price: 1450 },
    { id: "lamil-55", name: "Լամիլ 5,5", price: 1450 },
    { id: "lamil-77", name: "Լամիլ 7,7", price: 1450 },
  ],
  takatsu: [
    { id: "takatsu-39", name: "Տակացու 3,9", price: 2800 },
    { id: "takatsu-55", name: "Տակացու 5,5", price: 2800 },
    { id: "takatsu-77", name: "Տակացու 7,7", price: 2800 },
  ],
  rezin: [
    { id: "rezin-39", name: "Ռետինե ժապավեն 3,9", price: 460 },
    { id: "rezin-55", name: "Ռետինե ժապավեն 5,5", price: 460 },
    { id: "rezin-77", name: "Ռետինե ժապավեն 7,7", price: 460 },
  ],
  napravl: [
    { id: "napravl-39", name: "Ուղղորդիչ 3,9", price: 4600 },
    { id: "napravl-55", name: "Ուղղորդիչ 5,5", price: 4600 },
    { id: "napravl-77", name: "Ուղղորդիչ 7,7", price: 4600 },
    { id: "napravl-mega", name: "Ուղղորդիչ մեգա", price: 0 },
  ],
  chotka: [
    { id: "chotka-small", name: "Պուխ մանր", price: 60 },
    { id: "chotka-big", name: "Պուխ խոշոր", price: 60 },
  ],
  bakovina: [
    { id: "bakovina-16", name: "Կողային կափարիչ 16", price: 0 },
    { id: "bakovina-20", name: "Կողային կափարիչ 20", price: 0 },
    { id: "bakovina-25", name: "Կողային կափարիչ 25", price: 10000 },
    { id: "bakovina-30", name: "Կողային կափարիչ 30", price: 12000 },
    { id: "bakovina-35", name: "Կողային կափարիչ 35", price: 14000 },
    { id: "bakovina-40", name: "Կողային կափարիչ 40", price: 0 },
  ],
  bearing: [
    { id: "bearing-small", name: "Առանցքակալ փոքր", price: 0 },
    { id: "bearing-big", name: "Առանցքակալ մեծ", price: 0 },
  ],
  bearing_holder: [
    { id: "bearing_holder-small", name: "Առանցքակալի ամրակ փոքր", price: 600 },
    { id: "bearing_holder-big", name: "Առանցքակալի ամրակ մեծ", price: 600 },
  ],
  os: [
    { id: "os-plastic-40", name: "Օս պլաստմասե 40", price: 1000 },
    { id: "os-plastic-60", name: "Օս պլաստմասե 60", price: 1000 },
    { id: "os-adj-alu-60", name: "Օս կարգավորվող դյուրալյումինե 60", price: 1800 },
    { id: "os-plastic-70", name: "Օս պլաստմասե 70", price: 1000 },
    { id: "os-alu-70", name: "Օս դյուրալյումինե 70", price: 1000 },
    { id: "os-adj-plastic-70", name: "Օս կարգավորվող պլաստմասե 70", price: 1800 },
    { id: "os-adj-alu-70", name: "Օս կարգավորվող դյուրալյումինե 70", price: 1800 },
  ],
  rolik: [
    { id: "rolik-big", name: "Ռոլիկ մեծ", price: 3200 },
    { id: "rolik-small", name: "Ռոլիկ փոքր", price: 3200 },
  ],
  kaltso: [
    { id: "kaltso-40", name: "Օղակ 40", price: 200 },
    { id: "kaltso-60", name: "Օղակ 60", price: 200 },
    { id: "kaltso-70", name: "Օղակ 70", price: 200 },
  ],
  kakhich: [
    { id: "kakhich-39", name: "Կախիչ 3,9", price: 250 },
    { id: "kakhich-77-55", name: "Կախիչ 7,7/5,5", price: 250 },
  ],
  top_lock: [
    { id: "top_lock-77", name: "Վերին ավտոմատ փական 7,7", price: 0 },
  ],
  zaglushka: [
    { id: "zaglushka-39", name: "Լամիլի խցան 3,9", price: 30 },
    { id: "zaglushka-55", name: "Լամիլի խցան 5,5", price: 30 },
    { id: "zaglushka-77", name: "Լամիլի խցան 7,7", price: 30 },
  ],
  kardan: [
    { id: "kardan-universal", name: "Կարդան ունիվերսալ", price: 1200 },
    { id: "kardan-mobile", name: "Կարդան շարժական", price: 1200 },
  ],
  emergency_handle: [
    { id: "handle-ds38a", name: "Վթարային բռնակ DS38A 1300mm", price: 2500 },
    { id: "handle-ds38c", name: "Վթարային բռնակ DS38C 1800mm", price: 2500 },
  ],
  motor: [
    { id: "motor-20-60", name: "Շարժիչ 20Nm(60)", price: 0 },
    { id: "motor-50noem-60", name: "Շարժիչ 50Nm առանց վթարային (60)", price: 0 },
    { id: "motor-50-60", name: "Շարժիչ 50Nm(60)", price: 0 },
    { id: "motor-80-70", name: "Շարժիչ 80Nm (70)", price: 0 },
    { id: "motor-100-70", name: "Շարժիչ 100Nm (70)", price: 0 },
    { id: "motor-120-70", name: "Շարժիչ 120Nm (70)", price: 0 },
    { id: "motor-140-70", name: "Շարժիչ 140Nm (70)", price: 0 },
    { id: "motor-230-102", name: "Շարժիչ 230Nm (102)", price: 0 },
  ],
  pult: [
    { id: "pult-ds115a", name: "Պուլտ DC115A", price: 0 },
    { id: "pult-ds115b", name: "Պուլտ DC115B", price: 0 },
  ],
  blok: [
    { id: "blok-dc155-1ch", name: "Բլոկ DC155 1 կանալանի", price: 9200 },
    { id: "blok-dc257-4ch", name: "Բլոկ DC257 4 կանալանի", price: 0 },
  ],
  control_switch: [
    { id: "control_switch-dc866", name: "Կառավարման անջատիչ DC866", price: 0 },
  ],
  adapter: [
    { id: "adapter-60-70", name: "Ադապտեր 60-70", price: 0 },
  ],
  limiter_plate: [
    { id: "limiter_plate-1", name: "Սահմանափակիչ թիթեղ", price: 0 },
  ],
  lock: [
    { id: "lock-1", name: "Կողպեկ", price: 0 },
  ],
};

export function buildCatalog(products: WarehouseProduct[]): Catalog {
  const warehouseProductsByName = new Map<string, any>(
    (products || []).map((product: any) => [String(product.name || "").trim().toLocaleLowerCase(), product])
  );
  const catalog: Catalog = {};
  DEFAULT_MATERIALS.forEach((m) => {
    catalog[m.key] = (DEFAULT_VARIANTS[m.key] || [{ id: `${m.key}-default`, name: m.name, price: m.price || 0 }]).map((v: any) => {
      const warehouseProduct = warehouseProductsByName.get(String(v.name).trim().toLocaleLowerCase());
      return warehouseProduct
        ? { ...v, variantId: v.id, id: warehouseProduct.id, name: warehouseProduct.name, price: warehouseProduct.salePrice, unit: warehouseProduct.unit, stock: warehouseProduct.stock }
        : { ...v, variantId: v.id, price: 0 };
    });
  });
  return catalog;
}

