import { Decimal } from "@prisma/client/runtime/library";
import { consumptionAmount } from "./units.js";
import {
  nextBusinessDaysExclusive,
  utcDateKey,
  utcDayOfWeek,
} from "./businessDays.js";
import type { InventoryUnit, RecipeUnit } from "@prisma/client";

/** 95% service level → normal approx multiplier on MAPE-scaled buffer (per client PDF). */
export const SERVICE_LEVEL_95_MULTIPLIER = 1.65;

export type DailyUnitsByMenu = Map<string, Map<string, number>>;

/** Bucket sales into UTC calendar day → menuItemId → units. */
export function bucketDailySales(
  rows: { menuItemId: string; quantity: number; soldAt: Date }[]
): DailyUnitsByMenu {
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = utcDateKey(r.soldAt);
    const inner = m.get(key) ?? new Map<string, number>();
    inner.set(r.menuItemId, (inner.get(r.menuItemId) ?? 0) + r.quantity);
    m.set(key, inner);
  }
  return m;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Forecast units for `targetDate` using average of up to `sameWeekdayLookback`
 * prior occurrences of the same weekday (strictly before targetDate).
 */
export function forecastSameWeekdayAverage(
  daily: DailyUnitsByMenu,
  menuItemId: string,
  targetDate: Date,
  sameWeekdayLookback: number
): number {
  const dow = utcDayOfWeek(targetDate);
  const values: number[] = [];
  let d = addDaysUtc(targetDate, -1);
  while (values.length < sameWeekdayLookback && daysScanned(d, targetDate) < 400) {
    if (utcDayOfWeek(d) === dow) {
      const k = utcDateKey(d);
      const dayMap = daily.get(k);
      const u = dayMap?.get(menuItemId);
      if (u != null && u > 0) values.push(u);
    }
    d = addDaysUtc(d, -1);
  }
  if (values.length > 0) return mean(values);
  // Fallback: overall average for this menu across all days in history
  const all: number[] = [];
  for (const dm of daily.values()) {
    const u = dm.get(menuItemId);
    if (u != null && u > 0) all.push(u);
  }
  return all.length ? mean(all) : 0;
}

function addDaysUtc(d: Date, delta: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}

function daysScanned(from: Date, to: Date): number {
  return Math.abs(
    Math.floor(
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
    )
  );
}

/**
 * MAPE per menu: mean of |actual - forecast| / max(actual,1) over historical calendar days
 * where forecast for that day is same-weekday average from strictly prior dates.
 */
export function computeMenuMape(
  daily: DailyUnitsByMenu,
  menuItemId: string,
  maxHistoricalDays: number
): number {
  const errors: number[] = [];
  const dates = [...daily.keys()].sort();
  const cutoff = dates.length > maxHistoricalDays ? dates.length - maxHistoricalDays : 0;
  for (let i = cutoff; i < dates.length; i++) {
    const dateKey = dates[i]!;
    const dayMap = daily.get(dateKey);
    const actual = dayMap?.get(menuItemId);
    if (actual == null || actual <= 0) continue;
    const d = parseUtcDate(dateKey);
    const f = forecastSameWeekdayAverage(daily, menuItemId, d, 3);
    if (f <= 0) continue;
    const pct = Math.abs(actual - f) / Math.max(actual, 1);
    errors.push(pct);
  }
  if (errors.length === 0) return 0.15;
  return mean(errors);
}

function parseUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function ingredientDemandForMenuUnits(
  menuUnits: number,
  amount: Decimal,
  unit: RecipeUnit,
  inventoryUnit: InventoryUnit
): Decimal {
  return consumptionAmount(menuUnits, amount, unit, inventoryUnit);
}

/** Raw continuous need before purchase rounding. */
export function recommendedRawQty(
  forecastDemand: Decimal,
  mape: number,
  onHand: Decimal,
  openPo: Decimal
): Decimal {
  const safety = forecastDemand.mul(mape * SERVICE_LEVEL_95_MULTIPLIER);
  const target = forecastDemand.add(safety);
  const raw = target.sub(onHand).sub(openPo);
  return Decimal.max(new Decimal(0), raw);
}

/**
 * Supplier-feasible quantity: round up to pack / min order (Milestone 2 “Possible”).
 * EACH with case pack 60 → full cases; KG → whole units (e.g. 6.5 → 7).
 */
export function possibleOrderQty(
  rawNeed: Decimal,
  minOrder: Decimal | null,
  pack: Decimal | null,
  inventoryUnit: InventoryUnit
): Decimal {
  if (rawNeed.lte(0)) return new Decimal(0);
  let need = rawNeed;
  if (pack && pack.gt(0)) {
    need = rawNeed.div(pack).ceil().mul(pack);
  } else if (inventoryUnit === "KG") {
    need = new Decimal(Math.ceil(rawNeed.toNumber()));
  } else {
    need = new Decimal(Math.ceil(rawNeed.toNumber()));
  }
  const mo = minOrder && minOrder.gt(0) ? minOrder : null;
  if (mo && need.lt(mo)) need = mo;
  return need;
}

/**
 * Cap so we do not stock more than ~`shelfLifeDays` of demand at the implied daily rate
 * from the cover window (`forecastDemand` over `leadBusinessDays`).
 */
export function capByShelfLife(
  possible: Decimal,
  onHand: Decimal,
  forecastDemand: Decimal,
  leadBusinessDays: number,
  shelfLifeDays: number | null
): Decimal {
  if (shelfLifeDays == null || shelfLifeDays <= 0 || leadBusinessDays <= 0) {
    return possible;
  }
  const dailyRate = forecastDemand.div(leadBusinessDays);
  const maxStock = dailyRate.mul(shelfLifeDays);
  if (maxStock.lte(0)) return possible;
  const maxOrder = Decimal.max(new Decimal(0), maxStock.sub(onHand));
  return Decimal.min(possible, maxOrder);
}

export function forecastIngredientCoverWindow(args: {
  asOf: Date;
  leadBusinessDays: number;
  daily: DailyUnitsByMenu;
  recipeLines: {
    menuItemId: string;
    amount: Decimal;
    unit: RecipeUnit;
  }[];
  inventoryUnit: InventoryUnit;
}): Decimal {
  const days = nextBusinessDaysExclusive(args.asOf, args.leadBusinessDays);
  let total = new Decimal(0);
  for (const day of days) {
    for (const rl of args.recipeLines) {
      const fu = forecastSameWeekdayAverage(args.daily, rl.menuItemId, day, 3);
      total = total.add(
        ingredientDemandForMenuUnits(fu, rl.amount, rl.unit, args.inventoryUnit)
      );
    }
  }
  return total;
}
