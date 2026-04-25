/** UTC date helpers: weekends are non-business (Sat=6, Sun=0). */

export function utcDayOfWeek(d: Date): number {
  return d.getUTCDay();
}

export function isUtcBusinessDay(d: Date): boolean {
  const dow = utcDayOfWeek(d);
  return dow !== 0 && dow !== 6;
}

export function addUtcDays(d: Date, days: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** First calendar day on/after `from` that is a business day (same date if already business). */
export function startOfNextOrSameBusinessDay(from: Date): Date {
  let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (!isUtcBusinessDay(d)) {
    d = addUtcDays(d, 1);
  }
  return d;
}

/** The next `count` strictly future business days after `from` (excludes `from` even if business). */
export function nextBusinessDaysExclusive(from: Date, count: number): Date[] {
  const out: Date[] = [];
  let d = addUtcDays(
    new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())),
    1
  );
  while (out.length < count) {
    if (isUtcBusinessDay(d)) {
      out.push(new Date(d));
    }
    d = addUtcDays(d, 1);
  }
  return out;
}
