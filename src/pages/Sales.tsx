import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { DarkSelect } from "../components/DarkSelect";

type MenuItem = { id: string; code: string; name: string; colorHex: string | null };

export function Sales() {
  const queryClient = useQueryClient();
  const { data: items = [], isPending, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.menuItems,
    queryFn: () => api<MenuItem[]>("/menu-items"),
  });

  const [menuItemId, setMenuItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await queryClient.invalidateQueries({ queryKey: qk.dashboard });
      await queryClient.invalidateQueries({ queryKey: qk.ingredients });
      await queryClient.invalidateQueries({ queryKey: qk.suggestionsPo });
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
        description="Post units sold against menu SKUs. Stock is reduced using recipe quantities with unit conversion handled on the server (e.g. g → kg, each → each)."
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
              <CardTitle className="text-base">Quick entry</CardTitle>
              <CardDescription>
                Select a POS-linked menu code and quantity. Changes apply immediately.
              </CardDescription>
            </CardHeader>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
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
            <Button type="submit" disabled={loading || isPending} className="w-full">
              {loading ? "Recording…" : "Record sale & update stock"}
            </Button>
            {msg && (
              <p
                className={`text-sm ${
                  msg.startsWith("Could") || msg.startsWith("Insufficient")
                    ? "text-rose-200"
                    : "text-emerald-200/90"
                }`}
              >
                {msg}
              </p>
            )}
          </form>
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
              On-hand is reduced in inventory units; invalid or insufficient stock
              returns an error from the API.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              Dashboard and AI PO views refresh after a successful post.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
