import { prisma } from "../prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import { consumptionAmount } from "./units.js";

const DAYS_LOOKBACK = 14;
const FORECAST_DAYS = 3;

function roundUpToMinOrder(
  need: Decimal,
  minOrder: Decimal | null,
  pack: Decimal | null
): Decimal {
  if (need.lte(0)) return new Decimal(0);
  let q = need;
  const mo = minOrder && minOrder.gt(0) ? minOrder : new Decimal(1);
  if (pack && pack.gt(0)) {
    const packs = need.div(pack).ceil();
    q = packs.mul(pack);
    if (q.lt(mo)) q = mo;
    return q;
  }
  if (q.lt(mo)) return mo;
  return q;
}

/** Moving-average forecast of ingredient demand (kg or each) over FORECAST_DAYS */
export async function buildPoSuggestions() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS_LOOKBACK);

  const sales = await prisma.salesEntry.findMany({
    where: { soldAt: { gte: since } },
    select: { menuItemId: true, quantity: true, soldAt: true },
  });

  const byMenu = new Map<string, number[]>();
  for (const s of sales) {
    const arr = byMenu.get(s.menuItemId) ?? [];
    arr.push(s.quantity);
    byMenu.set(s.menuItemId, arr);
  }

  const daySpan = Math.max(1, DAYS_LOOKBACK);
  const avgDailyByMenu = new Map<string, number>();
  for (const [menuId, qtys] of byMenu) {
    const sum = qtys.reduce((a, b) => a + b, 0);
    avgDailyByMenu.set(menuId, sum / daySpan);
  }

  const ingredients = await prisma.ingredient.findMany({
    select: {
      id: true,
      internalNumber: true,
      name: true,
      parLevel: true,
      onHand: true,
      inventoryUnit: true,
      vendorName: true,
      supplierSku: true,
      minOrder: true,
      unitCost: true,
      orderPackAmount: true,
      recipeLines: {
        select: {
          menuItemId: true,
          amount: true,
          unit: true,
        },
      },
    },
  });

  const lines: {
    ingredientId: string;
    name: string;
    internalNumber: string;
    vendorName: string | null;
    supplierSku: string | null;
    unitCost: string | null;
    inventoryUnit: string;
    onHand: string;
    parLevel: string;
    gapVsPar: string;
    forecastedUse: string;
    suggestedOrderQty: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }[] = [];

  for (const ing of ingredients) {
    let forecastUse = new Decimal(0);
    for (const rl of ing.recipeLines) {
      const avg = avgDailyByMenu.get(rl.menuItemId) ?? 0;
      const daily = consumptionAmount(
        1,
        rl.amount,
        rl.unit,
        ing.inventoryUnit
      ).mul(avg);
      forecastUse = forecastUse.add(daily.mul(FORECAST_DAYS));
    }

    const par = ing.parLevel;
    const on = ing.onHand;
    const gapPar = par.sub(on);
    const needForPar = Decimal.max(new Decimal(0), gapPar);
    const needForForecast = forecastUse;
    const rawNeed = needForPar.add(needForForecast);

    const suggested = roundUpToMinOrder(
      rawNeed,
      ing.minOrder,
      ing.orderPackAmount
    );

    let reason: string;
    if (on.lt(par)) {
      reason = `Below PAR (${on.toFixed(2)} < ${par.toFixed(2)}).`;
    } else if (needForForecast.gt(0)) {
      reason = `Forecast covers ~${FORECAST_DAYS}d of sales from last ${DAYS_LOOKBACK}d history.`;
    } else {
      reason = "Buffer / min order.";
    }

    let priority: "high" | "medium" | "low" = "low";
    if (on.lt(par)) priority = "high";
    else if (needForForecast.gt(0)) priority = "medium";

    lines.push({
      ingredientId: ing.id,
      name: ing.name,
      internalNumber: ing.internalNumber,
      vendorName: ing.vendorName,
      supplierSku: ing.supplierSku,
      unitCost: ing.unitCost?.toString() ?? null,
      inventoryUnit: ing.inventoryUnit,
      onHand: on.toString(),
      parLevel: par.toString(),
      gapVsPar: gapPar.toString(),
      forecastedUse: forecastUse.toFixed(4),
      suggestedOrderQty: suggested.toString(),
      reason,
      priority,
    });
  }

  lines.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority] || a.name.localeCompare(b.name);
  });

  return {
    generatedAt: new Date().toISOString(),
    forecastWindowDays: DAYS_LOOKBACK,
    forecastHorizonDays: FORECAST_DAYS,
    lines: lines.filter((l) => new Decimal(l.suggestedOrderQty).gt(0)),
  };
}
