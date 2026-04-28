import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, X } from "lucide-react";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { DarkSelect } from "../components/DarkSelect";

type MenuItem = { id: string; code: string; name: string; colorHex: string | null };
type SalesRow = {
  id: string;
  soldAt: string;
  quantity: number;
  menuItem: { code: string; name: string };
};

export function Sales() {
  const queryClient = useQueryClient();
  const { data: items = [], isPending, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.menuItems,
    queryFn: () => api<MenuItem[]>("/menu-items"),
  });
  const { data: salesRows = [], isFetching: isFetchingSales } = useQuery({
    queryKey: qk.sales,
    queryFn: () => api<SalesRow[]>("/sales"),
  });

  const [menuItemId, setMenuItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (items.length > 0 && (!menuItemId || !items.some((m) => m.id === menuItemId))) {
      setMenuItemId(items[0].id);
    }
  }, [items, menuItemId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      await api("/sales", {
        method: "POST",
        body: JSON.stringify({ menuItemId, quantity: qty }),
      });
      setMsg("Sale recorded. Inventory updated from bill of materials.");
      setQty(1);
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: qk.dashboard });
      await queryClient.invalidateQueries({ queryKey: qk.ingredients });
      await queryClient.invalidateQueries({ queryKey: qk.suggestionsPo });
      await queryClient.invalidateQueries({ queryKey: qk.sales });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

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
        eyebrow="Revenue & depletion"
        title="Sales entry"
        description="Post units sold against menu SKUs. Stock is reduced using recipe quantities with unit conversion on the server (e.g. g → kg, each → each). Low or unknown stock does not block a sale — on-hand may go negative until you reconcile."
        meta={
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span>
              {updatedLabel ? (
                <>
                  Menu loaded{" "}
                  <span className="font-medium text-foreground">{updatedLabel}</span>
                  {isFetching ? " · refreshing…" : ""}
                </>
              ) : (
                "Loading catalog…"
              )}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Sales actions</CardTitle>
              <CardDescription>
                Add a new sale from a popup form. Posted sales update Dashboard and inventory.
              </CardDescription>
            </CardHeader>
          </div>
          <div className="space-y-4 p-5">
            <Button onClick={() => setIsModalOpen(true)} disabled={isPending}>
              <Plus className="h-4 w-4" aria-hidden />
              Add New Sale
            </Button>
            {msg && (
              <p
                className={`text-sm ${
                  msg.startsWith("Could")
                    ? "text-rose-200"
                    : "text-emerald-200/90"
                }`}
              >
                {msg}
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-zinc-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Processing rules
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              Each sale line explodes through the active BOM for that menu SKU.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              On-hand is reduced in inventory units. Sales are not blocked for low stock — balances can go
              negative so you can record what actually sold; use Inventory and AI PO to correct and reorder.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              Dashboard and AI PO views refresh after a successful post.
            </li>
          </ul>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Recent sales</CardTitle>
            <CardDescription>Latest submitted sales entries.</CardDescription>
          </CardHeader>
        </div>
        {isFetchingSales ? (
          <p className="px-5 py-8 text-sm text-muted">Refreshing sales list…</p>
        ) : salesRows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No sales yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Menu code</th>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5 text-xs text-zinc-300">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(row.soldAt))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-200">{row.menuItem.code}</td>
                    <td className="px-4 py-2.5">{row.menuItem.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/40">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Add new sale</h3>
                <p className="mt-1 text-sm text-muted">
                  Fill details and submit to update inventory and dashboard.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close add sale popup"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Menu item
                </label>
                {isPending || !items.length ? (
                  <div className="flex h-11 items-center rounded-lg border border-white/[0.1] bg-zinc-950/40 px-4 text-sm text-muted">
                    Loading menu…
                  </div>
                ) : (
                  <DarkSelect
                    options={items.map((m) => ({
                      value: m.id,
                      label: `${m.code} — ${m.name}`,
                    }))}
                    value={menuItemId}
                    onChange={setMenuItemId}
                    disabled={isPending}
                  />
                )}
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Quantity sold
                </label>
                <Input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || isPending}>
                  {loading ? "Adding…" : "Add Sale"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
