import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, X } from "lucide-react";
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

type NewIngredientForm = {
  internalNumber: string;
  name: string;
  class: string;
  inventoryUnit: "KG" | "EACH";
  parLevel: string;
  onHand: string;
  vendorName: string;
  supplierSku: string;
  minOrder: string;
  unitCost: string;
  orderPackAmount: string;
  orderPackLabel: string;
};

const initialNewIngredientForm: NewIngredientForm = {
  internalNumber: "",
  name: "",
  class: "",
  inventoryUnit: "KG",
  parLevel: "",
  onHand: "",
  vendorName: "",
  supplierSku: "",
  minOrder: "",
  unitCost: "",
  orderPackAmount: "",
  orderPackLabel: "",
};

export function Inventory() {
  const queryClient = useQueryClient();
  const { data: rows = [], isPending, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.ingredients,
    queryFn: () => api<Ingredient[]>("/ingredients"),
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [form, setForm] = useState<NewIngredientForm>(initialNewIngredientForm);

  const data = useMemo(() => rows, [rows]);

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
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-foreground">
            {getValue<string>()}
          </span>
        ),
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
          const on = Number(row.original.onHand);
          const par = Number(row.original.parLevel);
          const ok = on >= par;
          return (
            <Badge variant={ok ? "success" : "warning"}>
              {ok ? "At / above PAR" : "Below PAR"}
            </Badge>
          );
        },
      },
    ],
    []
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

  const onFormChange = <K extends keyof NewIngredientForm>(
    key: K,
    value: NewIngredientForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitNewIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    const parLevel = Number(form.parLevel);
    const onHand = Number(form.onHand);
    if (!form.internalNumber.trim() || !form.name.trim() || !form.class.trim()) {
      setCreateMsg("SKU, name, and class are required.");
      return;
    }
    if (!Number.isFinite(parLevel) || parLevel < 0 || !Number.isFinite(onHand) || onHand < 0) {
      setCreateMsg("PAR and On hand must be non-negative numbers.");
      return;
    }

    setCreating(true);
    try {
      await api("/ingredients", {
        method: "POST",
        body: JSON.stringify({
          internalNumber: form.internalNumber,
          name: form.name,
          class: form.class,
          parLevel,
          onHand,
          inventoryUnit: form.inventoryUnit,
          vendorName: form.vendorName.trim() || null,
          supplierSku: form.supplierSku.trim() || null,
          minOrder: form.minOrder.trim() ? Number(form.minOrder) : null,
          unitCost: form.unitCost.trim() ? Number(form.unitCost) : null,
          orderPackAmount: form.orderPackAmount.trim()
            ? Number(form.orderPackAmount)
            : null,
          orderPackLabel: form.orderPackLabel.trim() || null,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: qk.ingredients });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard });
      await queryClient.invalidateQueries({ queryKey: qk.suggestionsPo });
      setCreateMsg("Inventory item created.");
      setForm(initialNewIngredientForm);
      setIsModalOpen(false);
    } catch (e) {
      setCreateMsg(e instanceof Error ? e.message : "Failed to create item.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock on hand"
        title="Inventory"
        description="On-hand is system-driven from sales depletions and receiving posts — not edited here. PAR comparison and AI procurement use these balances."
        meta={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add New Inventory Item
            </Button>
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
              Single location view — read-only stock. Count changes flow from Sales and Receiving (and seed data), not manual edits on this sheet.
              <span className="mt-1 block lg:hidden">
                On smaller screens, each SKU is shown as a card for readability.
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
                const on = Number(row.onHand);
                const par = Number(row.parLevel);
                const ok = on >= par;
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
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          On hand
                        </p>
                        <p className="mt-1 font-mono text-sm tabular-nums text-foreground">{row.onHand}</p>
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

      {createMsg && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            createMsg.includes("created")
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-100"
          }`}
        >
          {createMsg}
        </p>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/40">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Add new inventory item
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Create a new ingredient SKU for inventory and AI procurement. Initial on-hand applies only at
                  creation; existing rows are not edited here (use Sales + Receiving).
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close add inventory popup"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <form onSubmit={submitNewIngredient} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    SKU *
                  </label>
                  <Input
                    value={form.internalNumber}
                    onChange={(e) => onFormChange("internalNumber", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Class *
                  </label>
                  <Input value={form.class} onChange={(e) => onFormChange("class", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Item name *
                </label>
                <Input value={form.name} onChange={(e) => onFormChange("name", e.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Unit *
                  </label>
                  <select
                    value={form.inventoryUnit}
                    onChange={(e) => onFormChange("inventoryUnit", e.target.value as "KG" | "EACH")}
                    className="inventory-select h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-foreground"
                  >
                    <option value="KG">KG</option>
                    <option value="EACH">EACH</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    PAR *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.parLevel}
                    onChange={(e) => onFormChange("parLevel", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    On hand *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.onHand}
                    onChange={(e) => onFormChange("onHand", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Vendor
                  </label>
                  <Input
                    value={form.vendorName}
                    onChange={(e) => onFormChange("vendorName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Supplier SKU
                  </label>
                  <Input
                    value={form.supplierSku}
                    onChange={(e) => onFormChange("supplierSku", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Min order
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.minOrder}
                    onChange={(e) => onFormChange("minOrder", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Unit cost
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={form.unitCost}
                    onChange={(e) => onFormChange("unitCost", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Pack amount
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.orderPackAmount}
                    onChange={(e) => onFormChange("orderPackAmount", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Pack label
                </label>
                <Input
                  value={form.orderPackLabel}
                  onChange={(e) => onFormChange("orderPackLabel", e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Adding..." : "Add Inventory Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
