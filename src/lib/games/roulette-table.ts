// Espejo EXACTO de public._roulette_bet_cells / _roulette_bet_multiplier.
// El servidor es la única autoridad: esto solo sirve para pintar el tapete y
// previsualizar pagos.

export type BetType =
  | "straight"
  | "split"
  | "street"
  | "corner"
  | "line"
  | "dozen"
  | "column"
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high";

export type PlacedBet = { type: BetType; key: string; amount: number };

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const OUTSIDE_TYPES: ReadonlySet<BetType> = new Set([
  "red",
  "black",
  "even",
  "odd",
  "low",
  "high",
  "dozen",
  "column",
]);

export function betId(type: BetType, key: string) {
  return `${type}:${key}`;
}

export function parseBetId(id: string): { type: BetType; key: string } {
  const idx = id.indexOf(":");
  return { type: id.slice(0, idx) as BetType, key: id.slice(idx + 1) };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function cellsFor(type: BetType, key: string): number[] {
  switch (type) {
    case "straight":
      return [Number(key)];
    case "split": {
      const [a, b] = key.split("-").map(Number);
      return [a, b];
    }
    case "street": {
      const r = Number(key);
      return [3 * r - 2, 3 * r - 1, 3 * r];
    }
    case "corner": {
      const a = Number(key);
      return [a, a + 1, a + 3, a + 4];
    }
    case "line": {
      const r = Number(key);
      return range(3 * r - 2, 3 * r + 3);
    }
    case "dozen": {
      const d = Number(key);
      return range(12 * d - 11, 12 * d);
    }
    case "column": {
      const c = Number(key);
      return range(1, 36).filter((n) => n % 3 === c % 3);
    }
    case "red":
      return range(1, 36).filter((n) => RED_NUMBERS.has(n));
    case "black":
      return range(1, 36).filter((n) => !RED_NUMBERS.has(n));
    case "even":
      return range(1, 36).filter((n) => n % 2 === 0);
    case "odd":
      return range(1, 36).filter((n) => n % 2 === 1);
    case "low":
      return range(1, 18);
    case "high":
      return range(19, 36);
    default:
      return [];
  }
}

/** Pago total (incluye la apuesta). El pleno al 0 se escala por el peso del verde. */
export function multiplierFor(type: BetType, key: string, greenWeight = 1): number {
  switch (type) {
    case "straight":
      return key === "0" ? Math.round((36 / Math.max(greenWeight, 1)) * 100) / 100 : 36;
    case "split":
      return 18;
    case "street":
      return 12;
    case "corner":
      return 9;
    case "line":
      return 6;
    case "dozen":
    case "column":
      return 3;
    default:
      return 2;
  }
}

export const BET_TYPE_LABEL: Record<BetType, string> = {
  straight: "Pleno",
  split: "Split",
  street: "Calle",
  corner: "Esquina",
  line: "Línea",
  dozen: "Docena",
  column: "Columna",
  red: "Rojo",
  black: "Negro",
  even: "Par",
  odd: "Impar",
  low: "1 – 18",
  high: "19 – 36",
};

export function betLabel(type: BetType, key: string): string {
  switch (type) {
    case "straight":
      return `Pleno ${key}`;
    case "split":
      return `Split ${key.replace("-", "/")}`;
    case "street":
    case "corner":
    case "line":
      return `${BET_TYPE_LABEL[type]} ${cellsFor(type, key).join("/")}`;
    case "dozen":
      return `${["1ª", "2ª", "3ª"][Number(key) - 1]} docena`;
    case "column":
      return `${key}ª columna`;
    default:
      return BET_TYPE_LABEL[type];
  }
}

export function colorOfNumber(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}
