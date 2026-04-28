import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";

type ItemMaster = {
  id: string;
  itemId: string;
  itemName: string;
  type: string;
  class: string;
  baseUom: string;
  shelfLifeDays: number | null;
  traceBatch: string | null;
  barcode: string | null;
  isProductionItem: boolean;
  isRecipeIngredient: boolean;
  sourcingMode: string;
  productionCapacityPerDay: string | null;
  ingredientInternalNumber: string | null;
};

export function Items() {
  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.itemMasters,
    queryFn: () => api<ItemMaster[]>("/item-masters"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master data"
        title="Items catalog"
        description="Item master fields aligned with the Google Sheet (Item_ID, name, type, class, UOM, shelf life, trace batch, barcode, production flags, sourcing mode, capacity)."
        meta={
          <Badge variant="muted" className="uppercase">
            Read-only
          </Badge>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          {isPending ? (
            <p className="p-6 text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted">No item master rows yet. Run seed or sync from Sheets.</p>
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-3 py-2.5">Item_ID</th>
                  <th className="px-3 py-2.5">Item name</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Class</th>
                  <th className="px-3 py-2.5">BaseUOM</th>
                  <th className="px-3 py-2.5">Shelf life</th>
                  <th className="px-3 py-2.5">Trace batch</th>
                  <th className="px-3 py-2.5">Barcode</th>
                  <th className="px-3 py-2.5">Prod item</th>
                  <th className="px-3 py-2.5">Recipe ingr.</th>
                  <th className="px-3 py-2.5">Sourcing</th>
                  <th className="px-3 py-2.5">Capacity / day</th>
                  <th className="px-3 py-2.5">SKU link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.05] odd:bg-transparent even:bg-white/[0.02] hover:bg-white/[0.04]"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-zinc-300">{r.itemId}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.itemName}</td>
                    <td className="px-3 py-2 text-muted">{r.type}</td>
                    <td className="px-3 py-2 text-muted">{r.class}</td>
                    <td className="px-3 py-2 text-muted">{r.baseUom}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">
                      {r.shelfLifeDays == null ? "—" : `${r.shelfLifeDays}d`}
                    </td>
                    <td className="px-3 py-2 text-muted">{r.traceBatch ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{r.barcode ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.isProductionItem ? "yes" : "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.isRecipeIngredient ? "yes" : "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.sourcingMode}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {r.productionCapacityPerDay ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                      {r.ingredientInternalNumber ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
