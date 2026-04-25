import { prisma } from "../prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import {
  SERVICE_LEVEL_95_MULTIPLIER,
  bucketDailySales,
  capByShelfLife,
  computeMenuMape,
  forecastIngredientCoverWindow,
  possibleOrderQty,
  recommendedRawQty,
} from "./replenishment.js";

const SALES_HISTORY_DAYS = 120;
const MAPE_HISTORY_DAYS = 56;

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("does not exist") || error.message.includes("P2021");
}

export async function buildPoSuggestions() {
  const asOf = new Date();
  const since = new Date(asOf);
  since.setUTCDate(since.getUTCDate() - SALES_HISTORY_DAYS);

  const sales = await prisma.salesEntry.findMany({
    where: { soldAt: { gte: since } },
    select: { menuItemId: true, quantity: true, soldAt: true },
  });
  const daily = bucketDailySales(sales);

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
      orderPackLabel: true,
      mapeFallbackPct: true,
      shelfLifeDays: true,
      supplier: {
        select: {
          code: true,
          name: true,
          kind: true,
          contactEmail: true,
          leadTimeBusinessDays: true,
          orderingDaysNote: true,
          deliveryDaysNote: true,
        },
      },
      recipeLines: {
        select: {
          menuItemId: true,
          amount: true,
          unit: true,
        },
      },
    },
  });

  let openPoLines: { ingredientId: string; approvedQty: Decimal }[] = [];
  try {
    openPoLines = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: "APPROVED" } },
      select: { ingredientId: true, approvedQty: true },
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
  const approvedOutstandingByIngredient = new Map<string, Decimal>();
  for (const line of openPoLines) {
    const prev = approvedOutstandingByIngredient.get(line.ingredientId) ?? new Decimal(0);
    approvedOutstandingByIngredient.set(line.ingredientId, prev.add(line.approvedQty));
  }

  const menuMapeCache = new Map<string, number>();
  function menuMape(menuId: string): number {
    if (!menuMapeCache.has(menuId)) {
      menuMapeCache.set(menuId, computeMenuMape(daily, menuId, MAPE_HISTORY_DAYS));
    }
    return menuMapeCache.get(menuId)!;
  }

  const lines: {
    ingredientId: string;
    name: string;
    internalNumber: string;
    supplierCode: string | null;
    supplierEmail: string | null;
    supplierKind: string | null;
    vendorName: string | null;
    supplierSku: string | null;
    unitCost: string | null;
    inventoryUnit: string;
    onHand: string;
    parLevel: string;
    leadTimeBusinessDays: number;
    forecastDemand: string;
    mapePct: string;
    safetyStock: string;
    openPoQty: string;
    recommendedRaw: string;
    possibleQty: string;
    gapVsPar: string;
    suggestedOrderQty: string;
    reason: string;
    aiNote: string;
    priority: "high" | "medium" | "low";
  }[] = [];

  for (const ing of ingredients) {
    const lead = ing.supplier?.leadTimeBusinessDays ?? 2;
    const forecastDemand = forecastIngredientCoverWindow({
      asOf,
      leadBusinessDays: lead,
      daily,
      recipeLines: ing.recipeLines,
      inventoryUnit: ing.inventoryUnit,
    });

    let mape = 0;
    for (const rl of ing.recipeLines) {
      mape = Math.max(mape, menuMape(rl.menuItemId));
    }
    if (mape <= 0 || !Number.isFinite(mape)) {
      mape = ing.mapeFallbackPct?.toNumber() ?? 0.12;
    }

    const safetyStock = forecastDemand.mul(mape * SERVICE_LEVEL_95_MULTIPLIER);
    const on = ing.onHand;
    const par = ing.parLevel;
    const gapPar = par.sub(on);
    const outstandingApproved =
      approvedOutstandingByIngredient.get(ing.id) ?? new Decimal(0);

    const raw = recommendedRawQty(
      forecastDemand,
      mape,
      on,
      outstandingApproved
    );
    let possible = possibleOrderQty(
      raw,
      ing.minOrder,
      ing.orderPackAmount,
      ing.inventoryUnit
    );
    possible = capByShelfLife(
      possible,
      on,
      forecastDemand,
      lead,
      ing.shelfLifeDays
    );

    const supplierCode = ing.supplier?.code ?? null;
    const supplierEmail =
      process.env.NODE_ENV === "production"
        ? (ing.supplier?.contactEmail ?? null)
        : ing.supplier?.contactEmail
          ? `fake+${ing.supplier.code.toLowerCase()}@example.invalid`
          : null;

    const orderingHint = ing.supplier?.orderingDaysNote
      ? `Ordering: ${ing.supplier.orderingDaysNote}.`
      : "";
    const deliveryHint = ing.supplier?.deliveryDaysNote
      ? `Delivery: ${ing.supplier.deliveryDaysNote}.`
      : "";
    const aiNote = [
      `Forecast cover ${lead} business day(s) (weekends excluded from lead).`,
      `Expected use in window ≈ ${forecastDemand.toFixed(3)} ${ing.inventoryUnit}.`,
      `MAPE ≈ ${(mape * 100).toFixed(1)}% → safety ≈ ${safetyStock.toFixed(3)} at 95% service.`,
      outstandingApproved.gt(0)
        ? `Open PO inbound ≈ ${outstandingApproved.toFixed(3)}.`
        : "No open PO qty counted.",
      orderingHint,
      deliveryHint,
    ]
      .filter(Boolean)
      .join(" ");

    let reason: string;
    if (outstandingApproved.gt(0) && raw.lte(0)) {
      reason = "Net need covered after inbound PO.";
    } else if (on.lt(par)) {
      reason = `Below PAR reference (${on.toFixed(2)} < ${par.toFixed(2)}).`;
    } else if (forecastDemand.gt(0)) {
      reason = `Forecast-driven reorder (${lead} business-day cover).`;
    } else {
      reason = "Buffer / min order.";
    }

    let priority: "high" | "medium" | "low" = "low";
    if (on.lt(par) && possible.gt(0)) priority = "high";
    else if (forecastDemand.gt(0) && possible.gt(0)) priority = "medium";

    lines.push({
      ingredientId: ing.id,
      name: ing.name,
      internalNumber: ing.internalNumber,
      supplierCode,
      supplierEmail,
      supplierKind: ing.supplier?.kind ?? null,
      vendorName: ing.vendorName,
      supplierSku: ing.supplierSku,
      unitCost: ing.unitCost?.toString() ?? null,
      inventoryUnit: ing.inventoryUnit,
      onHand: on.toString(),
      parLevel: par.toString(),
      leadTimeBusinessDays: lead,
      forecastDemand: forecastDemand.toFixed(4),
      mapePct: (mape * 100).toFixed(2),
      safetyStock: safetyStock.toFixed(4),
      openPoQty: outstandingApproved.toFixed(4),
      recommendedRaw: raw.toFixed(4),
      possibleQty: possible.toString(),
      gapVsPar: gapPar.toString(),
      suggestedOrderQty: possible.toString(),
      reason,
      aiNote,
      priority,
    });
  }

  lines.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    const byQty =
      Number.parseFloat(b.possibleQty) - Number.parseFloat(a.possibleQty);
    return p[a.priority] - p[b.priority] || byQty || a.name.localeCompare(b.name);
  });

  return {
    generatedAt: new Date().toISOString(),
    engine: "m2-forecast-mape" as const,
    forecastWindowDays: SALES_HISTORY_DAYS,
    /** Back-compat for UI copy; real cover length is per supplier `leadTimeBusinessDays`. */
    forecastHorizonDays: 2,
    forecastHorizonNote:
      "Demand summed over the next N business days after today (N = supplier lead time; weekends excluded from N).",
    lines: lines.filter((l) => new Decimal(l.possibleQty).gt(0)),
  };
}
