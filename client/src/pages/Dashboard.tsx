import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Clock,
  Package,
  WandSparkles,
} from "lucide-react";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/PageHeader";
import { cn } from "../lib/utils";

type DashboardRes = {
  stats: {
    ingredients: number;
    menuItems: number;
    approvedPoCount: number;
  };
  belowParPreview: { id: string; name: string; onHand: string; parLevel: string }[];
};

type WatchRow = DashboardRes["belowParPreview"][number] & {
  onNum: number;
  parNum: number;
  coveragePct: number;
  shortfall: number;
};

function enrichWatchlist(
  rows: DashboardRes["belowParPreview"] | undefined
): WatchRow[] {
  if (!rows?.length) return [];
  const enriched = rows.map((row) => {
    const onNum = Number.parseFloat(row.onHand);
    const parNum = Number.parseFloat(row.parLevel);
    const safePar = Number.isFinite(parNum) && parNum > 0 ? parNum : 1;
    const safeOn = Number.isFinite(onNum) ? onNum : 0;
    const coveragePct = Math.min(100, Math.round((safeOn / safePar) * 1000) / 10);
    const shortfall = Math.max(0, safePar - safeOn);
    return { ...row, onNum: safeOn, parNum: safePar, coveragePct, shortfall };
  });
  return enriched.sort((a, b) => a.coveragePct - b.coveragePct);
}

function riskLabel(pct: number): { label: string; className: string } {
  if (pct < 40) return { label: "Critical", className: "risk-chip risk-chip-critical" };
  if (pct < 65) return { label: "High", className: "risk-chip risk-chip-high" };
  return { label: "Reorder", className: "risk-chip risk-chip-reorder" };
}

export function Dashboard() {
  const { data, isPending, error, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<DashboardRes>("/dashboard"),
  });

  const err = error instanceof Error ? error.message : null;
  const stats = data?.stats;
  const watchSorted = useMemo(
    () => enrichWatchlist(data?.belowParPreview),
    [data?.belowParPreview]
  );

  const updatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(dataUpdatedAt)
    : null;

  if (err) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        {err}
      </p>
    );
  }

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Inventory control center"
        description="Real-time stock health, approved AI PO count, and PAR exposure across your catalog. Data refreshes automatically while this view is open."
        meta={
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span>
              {updatedLabel ? (
                <>
                  Last sync{" "}
                  <span className="font-medium text-foreground">{updatedLabel}</span>
                  {isFetching ? " · updating…" : ""}
                </>
              ) : (
                "Awaiting data…"
              )}
            </span>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: "Active ingredients",
            value: stats?.ingredients ?? "—",
            icon: Package,
            hint: "SKU master",
            accent: "from-violet-500 to-fuchsia-500",
            to: "/inventory",
          },
          {
            label: "AI PO",
            value: stats?.approvedPoCount ?? "—",
            icon: WandSparkles,
            hint: "Approved purchase orders (open)",
            accent: "from-amber-500 to-rose-500",
            to: "/suggestions",
          },
          {
            label: "Menu SKUs",
            value: stats?.menuItems ?? "—",
            icon: Activity,
            hint: "POS-linked items",
            accent: "from-sky-500 to-indigo-500",
            to: "/recipes",
          },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={cn(
              "relative overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-950/55 pl-4 pr-4 py-4 shadow-sm shadow-black/20",
              "block transition-all hover:bg-white/[0.04] hover:shadow-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1 bg-gradient-to-b",
                s.accent
              )}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {s.label}
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-foreground">
                  {isPending ? "—" : s.value}
                </p>
                <p className="mt-1 text-[11px] text-muted">{s.hint}</p>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2">
                <s.icon className="h-4 w-4 text-zinc-300" aria-hidden />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <CardHeader className="mb-0 p-0">
              <CardTitle className="text-base">PAR exposure</CardTitle>
              <CardDescription>
                Ingredients under minimum stock, ranked by coverage (lowest first).
                <span className="mt-1 block lg:hidden">
                  Cards below; full table on large screens.
                </span>
              </CardDescription>
            </CardHeader>
          </div>

          {isPending ? (
            <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
              Loading inventory…
            </p>
          ) : watchSorted.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
              All ingredients are at or above PAR.
            </p>
          ) : (
            <>
              <div className="space-y-3 px-4 pb-5 pt-2 lg:hidden">
                {watchSorted.map((row, i) => {
                  const risk = riskLabel(row.coveragePct);
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border border-white/[0.1] bg-zinc-950/50 p-4 shadow-sm shadow-black/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs tabular-nums text-muted">#{i + 1}</span>
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                            risk.className
                          )}
                        >
                          {risk.label}
                        </span>
                      </div>
                      <p className="mt-2 font-medium leading-snug text-foreground">{row.name}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            On hand
                          </p>
                          <p className="mt-0.5 tabular-nums text-zinc-200">{row.onHand}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            PAR
                          </p>
                          <p className="mt-0.5 tabular-nums text-zinc-300">{row.parLevel}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-muted">
                          <span>Coverage</span>
                          <span className="tabular-nums">{row.coveragePct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                            style={{ width: `${row.coveragePct}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3 text-sm">
                        <span className="text-muted">Shortfall</span>
                        <span className="shortfall-value tabular-nums">
                          {row.shortfall.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Ingredient</th>
                  <th className="px-4 py-2.5 text-right font-medium tabular-nums">On hand</th>
                  <th className="px-4 py-2.5 text-right font-medium tabular-nums">PAR</th>
                  <th className="min-w-[140px] px-4 py-2.5 font-medium">Coverage</th>
                  <th className="px-4 py-2.5 text-right font-medium tabular-nums">Shortfall</th>
                  <th className="px-4 py-2.5 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                  {watchSorted.map((row, i) => {
                    const risk = riskLabel(row.coveragePct);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-2.5 tabular-nums text-muted">{i + 1}</td>
                        <td className="max-w-[220px] px-4 py-2.5 font-medium text-foreground">
                          <span className="line-clamp-2">{row.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-200">
                          {row.onHand}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                          {row.parLevel}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 min-w-[72px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                                style={{ width: `${row.coveragePct}%` }}
                              />
                            </div>
                            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
                              {row.coveragePct}%
                            </span>
                          </div>
                        </td>
                        <td className="shortfall-value px-4 py-2.5 text-right tabular-nums">
                          {row.shortfall.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
                              risk.className
                            )}
                          >
                            {risk.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Procurement
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              AI-assisted purchase lines
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Consolidated PAR gaps with a light demand forecast and vendor pack
              rounding.
            </p>
            <Link
              to="/suggestions"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] py-2.5 text-xs font-semibold text-foreground transition hover:bg-white/[0.1]"
            >
              Open AI PO
              <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </Link>
          </div>
          <div className="rounded-xl border border-dashed border-white/[0.1] bg-transparent px-4 py-3 text-xs text-muted">
            <span className="font-medium text-foreground/90">Tip:</span> adjust on-hand
            values in{" "}
            <Link to="/inventory" className="font-medium text-violet-300 hover:underline">
              Inventory
            </Link>{" "}
            after physical counts.
          </div>
        </div>
      </div>
    </div>
  );
}
