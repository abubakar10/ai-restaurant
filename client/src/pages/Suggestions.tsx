import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { PageHeader } from "../components/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

type Line = {
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
};

type PoRes = {
  generatedAt: string;
  forecastWindowDays: number;
  forecastHorizonDays: number;
  lines: Line[];
};

function priorityBadgeVariant(p: Line["priority"]) {
  return p === "high" ? "danger" : p === "medium" ? "warning" : "muted";
}

export function Suggestions() {
  const { data, isPending, error, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.suggestionsPo,
    queryFn: () => api<PoRes>("/suggestions/po"),
  });

  const err = error instanceof Error ? error.message : null;
  const lines = data?.lines ?? [];

  const columns = useMemo<ColumnDef<Line>[]>(
    () => [
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ getValue }) => {
          const p = getValue<string>() as Line["priority"];
          return (
            <Badge variant={priorityBadgeVariant(p)} className="uppercase">
              {p}
            </Badge>
          );
        },
      },
      {
        accessorKey: "internalNumber",
        header: "SKU",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-zinc-300">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "name", header: "Ingredient" },
      {
        accessorKey: "vendorName",
        header: "Vendor",
        cell: ({ getValue }) => getValue<string>() ?? "—",
      },
      {
        accessorKey: "suggestedOrderQty",
        header: "Suggested qty",
        cell: ({ row }) => (
          <span className="font-mono text-sm tabular-nums text-zinc-200">
            {row.original.suggestedOrderQty}{" "}
            <span className="text-xs text-muted">{row.original.inventoryUnit}</span>
          </span>
        ),
      },
      {
        accessorKey: "unitCost",
        header: "Est. unit",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<string>() ?? "—"}</span>
        ),
      },
      {
        id: "reason",
        accessorKey: "reason",
        header: "Rationale",
        cell: ({ getValue }) => (
          <span className="max-w-[280px] text-muted">{getValue<string>()}</span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: lines,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const updatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(dataUpdatedAt)
    : null;

  const generatedStr = data
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.generatedAt))
    : null;

  if (err) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        {err}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="AI purchase suggestions"
        description="Combines PAR shortfall with a moving-average forecast from recent sales. Quantities respect minimum order and pack sizes where configured. Use as a draft before issuing to suppliers."
        meta={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {generatedStr && data && (
              <div className="rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Engine run
                </span>
                <span className="text-foreground">{generatedStr}</span>
                <span className="mt-1 block text-[11px] text-zinc-500">
                  Window {data.forecastWindowDays}d · horizon {data.forecastHorizonDays}d
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>
                {updatedLabel ? (
                  <>
                    View synced{" "}
                    <span className="font-medium text-foreground">{updatedLabel}</span>
                    {isFetching ? " · updating…" : ""}
                  </>
                ) : (
                  "…"
                )}
              </span>
            </div>
          </div>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Draft order lines</CardTitle>
            <CardDescription>
              Sorted by priority. Confirm against physical counts and vendor cutoffs
              before placing orders.
              <span className="mt-1 block lg:hidden">
                On smaller screens, each line is shown as a card.
              </span>
            </CardDescription>
          </CardHeader>
        </div>

        {isPending ? (
          <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
            Computing suggestions…
          </p>
        ) : lines.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
            No lines — stock and forecast are within targets.
          </p>
        ) : (
          <>
            <div className="space-y-3 px-4 pb-5 pt-2 lg:hidden">
              {lines.map((line) => (
                <div
                  key={line.ingredientId}
                  className="rounded-xl border border-white/[0.1] bg-zinc-950/50 p-4 shadow-sm shadow-black/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant={priorityBadgeVariant(line.priority)}
                      className="uppercase"
                    >
                      {line.priority}
                    </Badge>
                    <span className="font-mono text-xs text-zinc-400">{line.internalNumber}</span>
                  </div>
                  <p className="mt-2 font-medium leading-snug text-foreground">{line.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {line.vendorName ?? "Vendor —"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Suggested qty
                      </p>
                      <p className="mt-0.5 font-mono text-base tabular-nums text-zinc-100">
                        {line.suggestedOrderQty}{" "}
                        <span className="text-xs font-sans text-muted">{line.inventoryUnit}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Est. unit
                      </p>
                      <p className="mt-0.5 tabular-nums">{line.unitCost ?? "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-muted">
                    <span className="font-mono text-[10px] text-zinc-500">Rationale · </span>
                    {line.reason}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-muted"
                    >
                      {hg.headers.map((h) => (
                        <th key={h.id} className="px-4 py-2.5 font-medium">
                          {h.isPlaceholder
                            ? null
                            : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-2.5 align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
