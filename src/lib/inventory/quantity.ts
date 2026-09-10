import Decimal from "decimal.js";

type Value = string | number | undefined;
export type InventoryQuantityInput = {
  mode: "total" | "dimensions";
  unit: string;
  amount?: Value;
  count?: Value;
  length?: Value;
  width?: Value;
  height?: Value;
  amountPerPiece?: Value;
};

const UNITS: Record<string, { dimension: string; factor: number; symbol: string }> = {
  m: { dimension: "length", factor: 1, symbol: "մ" },
  cm: { dimension: "length", factor: 0.01, symbol: "սմ" },
  mm: { dimension: "length", factor: 0.001, symbol: "մմ" },
  m2: { dimension: "area", factor: 1, symbol: "մ²" },
  cm2: { dimension: "area", factor: 0.0001, symbol: "սմ²" },
  mm2: { dimension: "area", factor: 0.000001, symbol: "մմ²" },
  m3: { dimension: "volume", factor: 1, symbol: "մ³" },
  kg: { dimension: "mass", factor: 1, symbol: "կգ" },
  g: { dimension: "mass", factor: 0.001, symbol: "գ" },
  t: { dimension: "mass", factor: 1000, symbol: "տ" },
  l: { dimension: "liquid", factor: 1, symbol: "լ" },
  ml: { dimension: "liquid", factor: 0.001, symbol: "մլ" },
};

export function inventoryDimension(unitCode: string) {
  return UNITS[unitCode]?.dimension ?? "count";
}

export function inventoryInputUnits(unitCode: string, mode: "total" | "dimensions") {
  const dimension = inventoryDimension(unitCode);
  const inputDimension = mode === "dimensions" && ["area", "volume"].includes(dimension) ? "length" : dimension;
  return Object.entries(UNITS).filter(([, unit]) => unit.dimension === inputDimension).map(([code, unit]) => ({ code, symbol: unit.symbol }));
}

export function formatInventoryQuantity(value: number) {
  return new Intl.NumberFormat("hy-AM", { maximumFractionDigits: 6 }).format(value);
}

export function roundInventoryQuantity(value: number) {
  return new Decimal(value).toDecimalPlaces(6).toNumber();
}

function decimal(value: Value, label: string) {
  const normalized = typeof value === "number" ? String(value) : value?.trim().replace(",", ".");
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new Error(`${label}․ մուտքագրեք թիվ (օրինակ՝ 6,2)`);
  }
  const parsed = new Decimal(normalized);
  if (!parsed.isFinite() || parsed.abs().greaterThan(1_000_000_000)) throw new Error(`${label}․ թիվը չափազանց մեծ է`);
  return parsed;
}

/** Converts receipt input to the product's stock unit on both client and server. */
export function calculateInventoryQuantity(input: InventoryQuantityInput, stockUnit: { code: string; symbol: string }, allowNegative = false) {
  const base = UNITS[stockUnit.code];
  const dimension = inventoryDimension(stockUnit.code);
  const inputUnit = UNITS[input.unit];
  const format = (value: Decimal) => formatInventoryQuantity(value.toNumber());
  let quantity: Decimal;
  let formula: string;

  if (input.mode === "total") {
    const amount = decimal(input.amount, "Քանակ");
    if (dimension === "count") {
      if (input.unit !== stockUnit.code || !amount.isInteger()) throw new Error("Այս ապրանքի քանակը պետք է լինի ամբողջ թիվ՝ իր հաշվառման միավորով");
      quantity = amount;
    } else {
      if (!inputUnit || inputUnit.dimension !== dimension) throw new Error("Չափման միավորը չի համապատասխանում ապրանքի միավորին");
      quantity = amount.mul(inputUnit.factor).div(base.factor);
    }
    formula = `${format(amount)} ${inputUnit?.symbol ?? stockUnit.symbol}`;
  } else if (input.mode === "dimensions") {
    if (!base) throw new Error("Չափերով հաշվառման համար ապրանքի քարտում ընտրեք մ, մ², մ³ կամ կգ միավորը");
    const count = decimal(input.count, "Հատերի քանակ");
    if (!count.isInteger() || !count.isPositive()) throw new Error("Հատերի քանակը պետք է լինի դրական ամբողջ թիվ");
    const expectedDimension = ["area", "volume"].includes(dimension) ? "length" : dimension;
    if (!inputUnit || inputUnit.dimension !== expectedDimension) throw new Error("Չափման միավորը չի համապատասխանում հաշվարկին");
    const values = dimension === "length" ? [decimal(input.length, "Երկարություն")]
      : dimension === "area" ? [decimal(input.length, "Երկարություն"), decimal(input.width, "Լայնություն")]
      : dimension === "volume" ? [decimal(input.length, "Երկարություն"), decimal(input.width, "Լայնություն"), decimal(input.height, "Բարձրություն")]
      : [decimal(input.amountPerPiece, dimension === "mass" ? "Մեկ հատի քաշը" : "Մեկ հատի ծավալը")];
    if (values.some((value) => !value.isPositive())) throw new Error("Չափերը պետք է լինեն դրական թվեր");
    quantity = values.reduce((total, value) => total.mul(value).mul(inputUnit.factor), count).div(base.factor);
    formula = `${format(count)} հատ × ${values.map((value) => `${format(value)} ${inputUnit.symbol}`).join(" × ")}`;
  } else {
    throw new Error("Ընտրեք քանակի մուտքագրման եղանակը");
  }

  quantity = quantity.toDecimalPlaces(6);
  if (quantity.isZero() || (!allowNegative && quantity.isNegative())) throw new Error("Քանակը պետք է լինի դրական թիվ");
  if (quantity.abs().greaterThan(1_000_000_000)) throw new Error("Ընդհանուր քանակը չափազանց մեծ է");
  return { qty: quantity.toNumber(), calculation: `${formula} = ${format(quantity)} ${stockUnit.symbol}` };
}
