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
import { effectiveForecastBusinessDays } from "./supplierSchedule.js";

/** Sales lookback for bucketing (aligned with MAPE window — fewer rows, faster). */
const SALES_HISTORY_DAYS = 56;
const MAPE_HISTORY_DAYS = 56;
/** Reuse result briefly so double-clicks / strict-mode double-fetch stay instant. */
const SUGGESTIONS_CACHE_TTL_MS = 25_000;

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("does not exist") || error.message.includes("P2021");
}

async function loadOpenPoLinesSafe(): Promise<
  { ingredientId: string; approvedQty: Decimal; supplierConfirmedQty: Decimal | null }[]
> {
  try {
    return await prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          status: { in: ["SENT_TO_SUPPLIER", "SUPPLIER_APPROVED", "APPROVED"] },
        },
      },
      select: {
        ingredientId: true,
        approvedQty: true,
        supplierConfirmedQty: true,
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function buildPoSuggestionsPayload() {
  const asOf = new Date();
  const since = new Date(asOf);
  since.setUTCDate(since.getUTCDate() - SALES_HISTORY_DAYS);

  const [sales, ingredients, openPoLines] = await Promise.all([
    prisma.salesEntry.findMany({
      where: { soldAt: { gte: since } },
      select: { menuItemId: true, quantity: true, soldAt: true },
    }),
    prisma.ingredient.findMany({
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
        supplierId: true,
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            contactEmail: true,
            leadTimeBusinessDays: true,
            orderingDaysNote: true,
            deliveryDaysNote: true,
            weekendsNote: true,
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
    }),
    loadOpenPoLinesSafe(),
  ]);

  const daily = bucketDailySales(sales);

  const approvedOutstandingByIngredient = new Map<string, Decimal>();
  for (const line of openPoLines) {
    const prev = approvedOutstandingByIngredient.get(line.ingredientId) ?? new Decimal(0);
    const inbound =
      line.supplierConfirmedQty != null ? line.supplierConfirmedQty : line.approvedQty;
    approvedOutstandingByIngredient.set(line.ingredientId, prev.add(inbound));
  }

  const forecastCache = new Map<string, number>();
  const menuIds = new Set<string>();
  for (const ing of ingredients) {
    for (const rl of ing.recipeLines) menuIds.add(rl.menuItemId);
  }
  const menuMapeById = new Map<string, number>();
  for (const mid of menuIds) {
    menuMapeById.set(mid, computeMenuMape(daily, mid, MAPE_HISTORY_DAYS, forecastCache));
  }

  const lines: {
    ingredientId: string;
    supplierId: string | null;
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
    supplierLeadTimeDays: number;
    forecastCoverBusinessDays: number;
    forecastModel: "daily_short" | "scheduled_long";
    orderingDaysNote: string | null;
    deliveryDaysNote: string | null;
    weekendsNote: string | null;
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
    const supplierLead = ing.supplier?.leadTimeBusinessDays ?? 2;
    const { coverDays, model } = effectiveForecastBusinessDays({
      orderingDaysNote: ing.supplier?.orderingDaysNote,
      deliveryDaysNote: ing.supplier?.deliveryDaysNote,
      leadTimeBusinessDays: supplierLead,
    });
    const forecastDemand = forecastIngredientCoverWindow({
      asOf,
      leadBusinessDays: coverDays,
      daily,
      recipeLines: ing.recipeLines,
      inventoryUnit: ing.inventoryUnit,
      forecastCache,
    });

    let mape = 0;
    for (const rl of ing.recipeLines) {
      mape = Math.max(mape, menuMapeById.get(rl.menuItemId) ?? 0);
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
      coverDays,
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
    const modelLine =
      model === "daily_short"
        ? `Daily delivery supplier → short cover ${coverDays} business day(s) (weekends excluded from span).`
        : `Scheduled supplier → extended cover ${coverDays} business day(s) (not the daily-only short window).`;
    const aiNote = [
      modelLine,
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
      reason = `Forecast-driven reorder (${coverDays} business-day cover${model === "scheduled_long" ? ", extended schedule" : ""}).`;
    } else {
      reason = "Buffer / min order.";
    }

    let priority: "high" | "medium" | "low" = "low";
    if (on.lt(par) && possible.gt(0)) priority = "high";
    else if (forecastDemand.gt(0) && possible.gt(0)) priority = "medium";

    lines.push({
      ingredientId: ing.id,
      supplierId: ing.supplierId,
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
      leadTimeBusinessDays: supplierLead,
      supplierLeadTimeDays: supplierLead,
      forecastCoverBusinessDays: coverDays,
      forecastModel: model,
      orderingDaysNote: ing.supplier?.orderingDaysNote ?? null,
      deliveryDaysNote: ing.supplier?.deliveryDaysNote ?? null,
      weekendsNote: ing.supplier?.weekendsNote ?? null,
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
    engine: "m2-forecast-mape-daily-split" as const,
    forecastWindowDays: SALES_HISTORY_DAYS,
    forecastHorizonDays: null,
    forecastHorizonNote:
      "Daily suppliers (ordering & delivery both marked Daily): demand is summed over the supplier’s lead time in business days (often 2). Scheduled suppliers: summed over a longer window (at least 7 business days) so the short 2-day model does not apply. Weekends are excluded from those spans.",
    lines: lines.filter((l) => new Decimal(l.possibleQty).gt(0)),
  };
}

type SuggestionsPayload = Awaited<ReturnType<typeof buildPoSuggestionsPayload>>;

let suggestionsCache: { at: number; payload: SuggestionsPayload } | null = null;

export async function buildPoSuggestions() {
  const now = Date.now();
  if (suggestionsCache && now - suggestionsCache.at < SUGGESTIONS_CACHE_TTL_MS) {
    return {
      ...suggestionsCache.payload,
      generatedAt: new Date().toISOString(),
    };
  }
  const payload = await buildPoSuggestionsPayload();
  suggestionsCache = { at: now, payload };
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
}
