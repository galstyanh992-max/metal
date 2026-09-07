import { Fragment, useMemo, useState } from "react";

/**
 * Ռոլստորների կոնֆիգուրատոր — mirrors the formulas from 456.xlsx, plus:
 *  - per-line stock product selection (fed by your CRM via the `products` prop)
 *  - the ability to remove any standard item the client doesn't want
 *  - optional add-ons: Հավաքում (assembly, 2000 ֏/m²) and Առաքում (delivery, flat)
 *  - a print button that fits the finished quote onto one A4 page
 *  - full real part catalog (sizes/models), all Armenian, no Russian text anywhere
 *  - door-type presets (profile line × Standart/Security)
 *
 * Drop this file into your Next.js project (e.g. components/RolshutterCalculator.jsx).
 * Uses Tailwind utility classes, including the `print:` variant for the print layout —
 * make sure Tailwind is enabled in the project this lives in.
 *
 * ── Connecting real warehouse/CRM stock ──────────────────────────────────
 *   const products = await fetch('/api/products?type=rolshutter').then(r => r.json());
 *   return <RolshutterCalculator products={products} />;
 * products: [{ id, category, name, price }], category must match a key in DEFAULT_MATERIALS.
 *
 * ── Prices ──────────────────────────────────────────────────────────────
 * Many of these part numbers are brand new, so I could not responsibly guess a
 * real price for every one. Where a category existed before I carried its old
 * flat price over as a starting point; everything genuinely new defaults to 0.
 * The Շարժիչ (motor) row especially needs your real prices per Nm rating.
 *
 * ── Font ──────────────────────────────────────────────────────────────────
 * Uses the "Arian AMU" font family. Copy the 4 .ttf files into your Next.js
 * project's public/fonts/ folder (public/fonts/arnamu.ttf, arnamu_bold.ttf,
 * arnamu_italic.ttf, arnamu_italic_bold.ttf) — Next.js serves anything under
 * public/ from the site root, so the @font-face urls below need no changes.
 */

const ASSEMBLY_PRICE_PER_SQM_DEFAULT = 2000;

// Lamel-height divisor per profile line, used by the "how many lamels do I need"
// helper (mirrors C12 in the original sheet, which used 0.077 for the 7,7 line).
const LAMEL_DIVISOR_BY_LINE = { "7,7": 0.077, "5,5": 0.055, "3,9": 0.039 };
// Meterage taken off Լամիլ/Տակացու/Ռետինե ժապավեն for each profile line
const LINE_OFFSET = { "7,7": -0.11, "5,5": -0.095, "3,9": -0.075 };

// Door "type" presets — pick the profile line (3,9 / 5,5 / 7,7) and tier
// (Standart / Security). Standart uses Կախիչ; Security swaps it for
// Վերին ավտոմատ փական: Standart also drops Ադապտեր / Կառավարման անջատիչ /
// Սահմանափակիչ թիթեղ / Կողպեկ (Security keeps them). Everything set by a
// preset stays fully editable afterwards — this is just a fast starting point.
const LINE_VARIANTS = {
  "7,7": {
    lamil: "lamil-77", takatsu: "takatsu-77", rezin: "rezin-77",
    napravl: "napravl-77", zaglushka: "zaglushka-77", kakhich: "kakhich-77-55",
    korob: "korob-35", val: "val-70", kaltso: "kaltso-70", os: "os-plastic-70",
  },
  "5,5": {
    lamil: "lamil-55", takatsu: "takatsu-55", rezin: "rezin-55",
    napravl: "napravl-55", zaglushka: "zaglushka-55", kakhich: "kakhich-77-55",
    korob: "korob-25", val: "val-60", kaltso: "kaltso-60", os: "os-plastic-60",
  },
  "3,9": {
    lamil: "lamil-39", takatsu: "takatsu-39", rezin: "rezin-39",
    napravl: "napravl-39", zaglushka: "zaglushka-39", kakhich: "kakhich-39",
    korob: "korob-20", val: "val-40", kaltso: "kaltso-40", os: "os-plastic-40",
  },
};

const SECURITY_ONLY_KEYS = ["adapter", "control_switch", "limiter_plate", "lock"];

const DOOR_PRESETS = [
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
const DEFAULT_MATERIALS = [
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

const DEFAULT_COLORS = [
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
const DEFAULT_VARIANTS = {
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

function formatAmd(n) {
  if (!isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ru-RU") + " ֏";
}

function buildCatalog(products) {
  const catalog = {};
  DEFAULT_MATERIALS.forEach((m) => {
    catalog[m.key] = (DEFAULT_VARIANTS[m.key] || [{ id: `${m.key}-default`, name: m.name, price: m.price || 0 }]).map((v) => ({ ...v }));
  });
  const seenFromProducts = new Set();
  (products || []).forEach((p) => {
    if (!seenFromProducts.has(p.category)) {
      catalog[p.category] = [];
      seenFromProducts.add(p.category);
    }
    catalog[p.category].push(p);
  });
  return catalog;
}

let customRowSeq = 1;

export default function RolshutterCalculator({ products }) {
  const [width, setWidth] = useState(3);
  const [height, setHeight] = useState(2.5);
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [motorSide, setMotorSide] = useState("right");

  const [overrides, setOverrides] = useState({});
  const [customRows, setCustomRows] = useState([]);
  const [removedKeys, setRemovedKeys] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(null);

  const [assemblyOn, setAssemblyOn] = useState(false);
  const [assemblyPricePerSqm, setAssemblyPricePerSqm] = useState(ASSEMBLY_PRICE_PER_SQM_DEFAULT);
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryPrice, setDeliveryPrice] = useState(0);

  const catalog = useMemo(() => buildCatalog(products), [products]);

  const setOverride = (key, field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value === "" ? "" : Number(value) },
    }));
  };

  const setProductForRow = (key, productId) => {
    const option = (catalog[key] || []).find((p) => p.id === productId);
    setOverrides((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], productId, price: option ? option.price : prev[key]?.price },
      };
      // Կողային կափարիչ always follows whatever Կոռոբ size is chosen
      if (key === "korob") {
        const size = productId.match(/\d+$/)?.[0];
        const bakovinaOption = size && (catalog["bakovina"] || []).find((p) => p.id === `bakovina-${size}`);
        if (bakovinaOption) {
          next["bakovina"] = { ...prev["bakovina"], productId: bakovinaOption.id, price: bakovinaOption.price };
        }
      }
      return next;
    });
    setExpandedKey(null);
  };

  const removeRow = (key) => setRemovedKeys((prev) => [...prev, key]);
  const restoreRow = (key) => setRemovedKeys((prev) => prev.filter((k) => k !== key));

  const applyDoorPreset = (presetId) => {
    const preset = DOOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const lv = LINE_VARIANTS[preset.line];

    setProductForRow("korob", lv.korob);
    setProductForRow("val", lv.val);
    setProductForRow("lamil", lv.lamil);
    setProductForRow("takatsu", lv.takatsu);
    setProductForRow("rezin", lv.rezin);
    setProductForRow("napravl", lv.napravl);
    setProductForRow("zaglushka", lv.zaglushka);
    setProductForRow("kaltso", lv.kaltso);
    setProductForRow("os", lv.os);

    if (preset.tier === "standart") {
      setProductForRow("kakhich", lv.kakhich);
      setRemovedKeys((prev) => {
        const s = new Set(prev);
        s.delete("kakhich");
        s.add("top_lock");
        SECURITY_ONLY_KEYS.forEach((k) => s.add(k));
        return Array.from(s);
      });
    } else {
      setProductForRow("top_lock", "top_lock-77");
      setRemovedKeys((prev) => {
        const s = new Set(prev);
        s.delete("top_lock");
        SECURITY_ONLY_KEYS.forEach((k) => s.delete(k));
        s.add("kakhich");
        return Array.from(s);
      });
    }

    setSelectedPresetId(presetId);
    setPresetPanelOpen(false);
  };

  // Կոռոբի խորքը (mm) is derived from whichever Կոռոբ product is currently
  // selected in the table — no separate input, and always in sync with it.
  const korobOverride = overrides["korob"] || {};
  const korobOptions = catalog["korob"] || [];
  const korobSelectedId = korobOverride.productId || korobOptions[0]?.id;
  const boxDepth = Number((korobSelectedId || "").match(/\d+$/)?.[0]) || 30;

  // Profile line (3,9 / 5,5 / 7,7) is derived from whichever Լամիլ is selected —
  // drives the Տակացու/Ռետինե ժապավեն/Լամիլ meterage offset and the lamel-count divisor.
  const lamilOverrideTop = overrides["lamil"] || {};
  const lamilOptionsTop = catalog["lamil"] || [];
  const lamilSelectedIdTop = lamilOverrideTop.productId || lamilOptionsTop[0]?.id || "";
  const currentLine = lamilSelectedIdTop.includes("77") ? "7,7" : lamilSelectedIdTop.includes("55") ? "5,5" : "3,9";
  const lineOffset = LINE_OFFSET[currentLine];

  const allRows = useMemo(() => {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const depth = boxDepth;

    return DEFAULT_MATERIALS.map((m) => {
      const ov = overrides[m.key] || {};
      const options = catalog[m.key] || [];
      const selectedId = ov.productId || options[0]?.id;
      const selectedProduct = options.find((p) => p.id === selectedId);
      const displayName = selectedProduct?.name || m.name;

      let meters = null;
      let qty = ov.qty !== undefined && ov.qty !== "" ? ov.qty : m.qty;
      let price = ov.price !== undefined && ov.price !== "" ? ov.price : (selectedProduct ? selectedProduct.price : m.price);

      let sum = 0;

      switch (m.mode) {
        case "meters_auto": {
          let offset = m.offset;
          if (m.key === "korob") offset = depth === 35 || depth === 40 ? -0.005 : -0.01;
          if (m.key === "takatsu" || m.key === "rezin") offset = lineOffset;
          meters = w + offset;
          sum = meters * (price || 0);
          break;
        }
        case "meters_qty": {
          meters = w + lineOffset;
          sum = meters * (qty || 0) * (price || 0);
          break;
        }
        case "napravl": {
          meters = h - depth * 0.01;
          sum = meters * (qty || 0) * (price || 0);
          break;
        }
        case "chotka": {
          const napravlMeters = h - depth * 0.01;
          meters = napravlMeters * 4;
          sum = meters * (price || 0);
          break;
        }
        case "count": {
          sum = (qty || 0) * (price || 0);
          break;
        }
        case "zaglushka": {
          const lamilOv = overrides["lamil"] || {};
          qty = lamilOv.qty !== undefined && lamilOv.qty !== "" ? lamilOv.qty : DEFAULT_MATERIALS.find((x) => x.key === "lamil").qty;
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

  // Lamel-count helper (C12 in the original sheet): (height - boxDepth*0.01) / line-divisor.
  const lamelDivisor = LAMEL_DIVISOR_BY_LINE[currentLine];
  const lamelRaw = (Number(height) - Number(boxDepth) * 0.01) / lamelDivisor;
  const lamelSuggested = Math.ceil(lamelRaw);
  const applySuggestedLamelCount = () => setOverride("lamil", "qty", lamelSuggested);

  const addCustomRow = () => setCustomRows((prev) => [...prev, { id: `custom-${customRowSeq++}`, name: "", qty: 1, price: 0 }]);
  const updateCustomRow = (id, field, value) => setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const removeCustomRow = (id) => setCustomRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div
      className="mx-auto max-w-3xl p-6 text-neutral-900 print:p-2 print:max-w-none print:text-[11px]"
      style={{ fontFamily: "'Arian AMU', sans-serif" }}
    >
      <style>{`
        @font-face {
          font-family: 'Arian AMU';
          src: url('/fonts/arnamu.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Arian AMU';
          src: url('/fonts/arnamu_bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Arian AMU';
          src: url('/fonts/arnamu_italic.ttf') format('truetype');
          font-weight: 400;
          font-style: italic;
          font-display: swap;
        }
        @font-face {
          font-family: 'Arian AMU';
          src: url('/fonts/arnamu_italic_bold.ttf') format('truetype');
          font-weight: 700;
          font-style: italic;
          font-display: swap;
        }
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
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 flex items-center justify-between ${
                  selectedPresetId === p.id ? "bg-neutral-50 font-medium" : ""
                }`}
              >
                <span>{p.label}</span>
                {selectedPresetId === p.id && <span className="text-neutral-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}

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
                    {r.meters !== null ? r.meters.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right print:px-1 print:py-1">
                    {r.mode === "count" || r.mode === "meters_qty" || r.mode === "napravl" ? (
                      <input
                        type="number"
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
            checked={assemblyOn}
            onChange={(e) => setAssemblyOn(e.target.checked)}
          />
          <span className="flex-1">Հավաքում (ըստ ցանկության)</span>
          <span className="text-neutral-500 hidden sm:inline print:inline">
            <input
              type="number"
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
            checked={deliveryOn}
            onChange={(e) => setDeliveryOn(e.target.checked)}
          />
          <span className="flex-1">Առաքում (ըստ ցանկության)</span>
          <span className="text-neutral-500 hidden sm:inline print:inline">
            <input
              type="number"
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
