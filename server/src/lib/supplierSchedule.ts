/**
 * Client rule: short lead-time style forecast (e.g. 2 business days) applies only when
 * both ordering and delivery are effectively **daily** (see master sheet + Anthony walkthrough).
 */
export function isDailyDeliverySupplier(
  orderingDaysNote: string | null | undefined,
  deliveryDaysNote: string | null | undefined
): boolean {
  const o = (orderingDaysNote ?? "").toLowerCase();
  const d = (deliveryDaysNote ?? "").toLowerCase();
  return o.includes("daily") && d.includes("daily");
}

/** Minimum business-day cover for non–daily-delivery suppliers (not the 2-day “daily” model). */
const SCHEDULED_SUPPLIER_MIN_COVER_BUSINESS_DAYS = 7;

export type ForecastCoverModel = "daily_short" | "scheduled_long";

/**
 * Daily + daily → use DB `leadTimeBusinessDays` (typically 2).
 * Otherwise → at least `SCHEDULED_SUPPLIER_MIN_COVER_BUSINESS_DAYS` so demand is not summed on a 2-day-only window.
 */
export function effectiveForecastBusinessDays(input: {
  orderingDaysNote: string | null | undefined;
  deliveryDaysNote: string | null | undefined;
  leadTimeBusinessDays: number;
}): { coverDays: number; model: ForecastCoverModel } {
  const lead = Number.isFinite(input.leadTimeBusinessDays)
    ? Math.max(1, Math.floor(input.leadTimeBusinessDays))
    : 2;

  if (isDailyDeliverySupplier(input.orderingDaysNote, input.deliveryDaysNote)) {
    return { coverDays: lead, model: "daily_short" };
  }

  return {
    coverDays: Math.max(lead, SCHEDULED_SUPPLIER_MIN_COVER_BUSINESS_DAYS),
    model: "scheduled_long",
  };
}
