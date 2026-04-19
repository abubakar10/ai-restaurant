import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { PageHeader } from "../components/PageHeader";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

type RecipeRow = {
  id: string;
  code: string;
  name: string;
  colorHex: string | null;
  recipe: {
    amount: string;
    unit: string;
    ingredient: { name: string; internalNumber: string };
  }[];
};

export function Recipes() {
  const { data: items = [], isPending, dataUpdatedAt, isFetching } = useQuery({
    queryKey: qk.recipes,
    queryFn: () => api<RecipeRow[]>("/recipes"),
  });

  const updatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(dataUpdatedAt)
    : null;

  const headerMeta = (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
      <span>
        {updatedLabel ? (
          <>
            Loaded{" "}
            <span className="font-medium text-foreground">{updatedLabel}</span>
            {isFetching ? " · refreshing…" : ""}
          </>
        ) : isPending ? (
          "Loading…"
        ) : (
          "Ready"
        )}
      </span>
    </div>
  );

  if (isPending) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Product structure"
          title="Recipes & bill of materials"
          description="Menu SKU definitions drive sales depletion and purchase planning. Units are normalized server-side for forecasting."
          meta={headerMeta}
        />
        <p className="text-sm text-muted">Loading recipes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product structure"
        title="Recipes & bill of materials"
        description="Menu SKU definitions drive sales depletion and purchase planning. Units are normalized server-side for forecasting."
        meta={headerMeta}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((m) => (
          <Card key={m.id} className="overflow-hidden p-0">
            <div
              className="border-b border-white/[0.07] px-5 py-4"
              style={{
                borderLeftWidth: 3,
                borderLeftStyle: "solid",
                borderLeftColor: m.colorHex ?? "rgba(113, 113, 122, 0.8)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="muted" className="font-mono">
                  {m.code}
                </Badge>
                <span className="text-[11px] tabular-nums text-muted">
                  {m.recipe.length} component{m.recipe.length === 1 ? "" : "s"}
                </span>
              </div>
              <CardTitle className="mt-2 text-base">{m.name}</CardTitle>
              <CardDescription className="mt-1">
                Per portion
                <span className="mt-1 block md:hidden">
                  Components as cards; table on wide screens.
                </span>
              </CardDescription>
            </div>
            <div className="md:hidden">
              <div className="divide-y divide-white/[0.06] px-4 pb-4">
                {m.recipe.map((r) => (
                  <div
                    key={`${m.id}-${r.ingredient.internalNumber}-${r.unit}`}
                    className="flex gap-3 py-3 first:pt-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] text-zinc-500">
                        {r.ingredient.internalNumber}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground/95">{r.ingredient.name}</p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-sm tabular-nums text-zinc-300">
                      {r.amount} {r.unit.toLowerCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 font-medium">Component</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {m.recipe.map((r) => (
                    <tr
                      key={`${m.id}-${r.ingredient.internalNumber}-${r.unit}`}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <td className="px-4 py-2 text-foreground/95">
                        <span className="mr-2 font-mono text-[10px] text-zinc-500">
                          {r.ingredient.internalNumber}
                        </span>
                        {r.ingredient.name}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-300">
                        {r.amount} {r.unit.toLowerCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
