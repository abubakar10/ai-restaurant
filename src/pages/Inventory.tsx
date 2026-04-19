import { useCallback, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Save } from "lucide-react";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { PageHeader } from "../components/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

type Ingredient = {
  id: string;
  internalNumber: string;
  name: string;
  class: string;
  parLevel: string;
  onHand: string;
  inventoryUnit: string;
  vendorName: string | null;
};

export function Inventory() {
  const queryClient = useQueryClient();
  const { data: rows = [], isPending, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.ingredients,
    queryFn: () => api<Ingredient[]>("/ingredients"),
  });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const [saving, setSaving] = useState<string | null>(null);

  const data = useMemo(() => rows, [rows]);

  const commitRow = useCallback(async (row: Ingredient) => {
      const id = row.id;
      const raw = editsRef.current[id] ?? row.onHand;
      const num = Number(raw);
      if (Number.isNaN(num) || num < 0) return;
      setSaving(id);
      try {
        await api(`/ingredients/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ onHand: num }),
        });
        await queryClient.invalidateQueries({ queryKey: qk.ingredients });
        await queryClient.invalidateQueries({ queryKey: qk.dashboard });
        await queryClient.invalidateQueries({ queryKey: qk.suggestionsPo });
        setEdits((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      } finally {
        setSaving(null);
      }
  }, [queryClient]);

  const columns = useMemo<ColumnDef<Ingredient>[]>(
    () => [
      {
        accessorKey: "internalNumber",
        header: "SKU",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-zinc-300">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "name", header: "Item" },
      { accessorKey: "class", header: "Class" },
      {
        accessorKey: "onHand",
        header: "On hand",
        cell: ({ row }) => {
          const id = row.original.id;
          const val = edits[id] ?? row.original.onHand;
          return (
            <Input
              className="h-9 max-w-[120px] border-white/[0.1] bg-zinc-950/50 font-mono text-xs tabular-nums"
              value={val}
              onChange={(e) =>
                setEdits((prev) => ({ ...prev, [id]: e.target.value }))
              }
            />
          );
        },
      },
      {
        accessorKey: "parLevel",
        header: "PAR",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-zinc-400">
            {getValue<string>()}
          </span>
        ),
      },
      {
        id: "unit",
        accessorKey: "inventoryUnit",
        header: "Unit",
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const on = Number(edits[row.original.id] ?? row.original.onHand);
          const par = Number(row.original.parLevel);
          const ok = on >= par;
          return (
            <Badge variant={ok ? "success" : "warning"}>
              {ok ? "At / above PAR" : "Below PAR"}
            </Badge>
          );
        },
      },
      {
        id: "save",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1"
            disabled={saving === row.original.id}
            onClick={() => commitRow(row.original)}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        ),
      },
    ],
    [commitRow, edits, saving]
  );

  const table = useReactTable({
    data,
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock on hand"
        title="Inventory"
        description="Edit counted quantities per ingredient. PAR comparison and procurement suggestions update when you save a row."
        meta={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>
                {updatedLabel ? (
                  <>
                    Last load{" "}
                    <span className="font-medium text-foreground">{updatedLabel}</span>
                    {isFetching ? " · refreshing…" : ""}
                  </>
                ) : (
                  "…"
                )}
              </span>
            </div>
            {!isPending && (
              <span className="text-right text-[11px] tabular-nums text-muted">
                {rows.length} SKUs
              </span>
            )}
          </div>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Stock sheet</CardTitle>
            <CardDescription>
              Single location view — edit on hand, then save per line to commit.
              <span className="mt-1 block lg:hidden">
                On smaller screens, each SKU is a card for easier editing.
              </span>
            </CardDescription>
          </CardHeader>
        </div>

        {isPending ? (
          <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
            Loading inventory…
          </p>
        ) : (
          <>
            <div className="space-y-3 px-4 pb-5 pt-2 lg:hidden">
              {rows.map((row) => {
                const on = Number(edits[row.id] ?? row.onHand);
                const par = Number(row.parLevel);
                const ok = on >= par;
                const val = edits[row.id] ?? row.onHand;
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-white/[0.1] bg-zinc-950/50 p-4 shadow-sm shadow-black/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-zinc-400">{row.internalNumber}</p>
                        <p className="mt-0.5 font-medium leading-snug text-foreground">
                          {row.name}
                        </p>
                        <p className="mt-1 text-xs text-muted">{row.class}</p>
                      </div>
                      <Badge variant={ok ? "success" : "warning"}>
                        {ok ? "OK" : "Below PAR"}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          On hand
                        </label>
                        <Input
                          className="mt-1 h-10 w-full border-white/[0.1] bg-zinc-950/50 font-mono text-sm tabular-nums"
                          value={val}
                          inputMode="decimal"
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            PAR
                          </p>
                          <p className="mt-1 font-mono text-sm tabular-nums text-zinc-300">
                            {row.parLevel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Unit
                          </p>
                          <p className="mt-1 text-sm">{row.inventoryUnit}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full gap-1"
                        disabled={saving === row.id}
                        onClick={() => commitRow(row)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
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
                        <td key={cell.id} className="px-4 py-2.5 align-middle">
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
