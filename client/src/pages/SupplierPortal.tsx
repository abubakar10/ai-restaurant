import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

type PublicLine = {
  id: string;
  name: string;
  internalNumber: string;
  inventoryUnit: string;
  suggestedQty: string;
  approvedQty: string;
  supplierConfirmedQty: string | null;
  supplierLineNote: string | null;
  readOnly: boolean;
};

type PublicPo = {
  poNumber: string;
  status: string;
  supplierName: string | null;
  supplierCode: string | null;
  approvedAt: string;
  sentAt: string | null;
  supplierApprovedAt: string | null;
  supplierDeclinedAt: string | null;
  supplierPoNote: string | null;
  lines: PublicLine[];
};

export function SupplierPortal() {
  const { token } = useParams<{ token: string }>();
  const t = token ?? "";

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["public-po", t],
    queryFn: () => api<PublicPo>(`/public/po/${encodeURIComponent(t)}`),
    enabled: Boolean(t),
    retry: false,
  });

  const [qty, setQty] = useState<Record<string, string>>({});
  const [lineNote, setLineNote] = useState<Record<string, string>>({});
  const [poNote, setPoNote] = useState("");

  useEffect(() => {
    if (!data?.lines) return;
    const q: Record<string, string> = {};
    const n: Record<string, string> = {};
    for (const l of data.lines) {
      q[l.id] = l.supplierConfirmedQty ?? l.approvedQty;
      n[l.id] = l.supplierLineNote ?? "";
    }
    setQty(q);
    setLineNote(n);
    setPoNote(data.supplierPoNote ?? "");
  }, [data]);

  const readOnly = data?.lines?.some((l) => l.readOnly) ?? true;

  const submitMutation = useMutation({
    mutationFn: async (action: "approve" | "decline") => {
      if (!data) return;
      if (action === "decline") {
        await api(`/public/po/${encodeURIComponent(t)}/submit`, {
          method: "POST",
          body: JSON.stringify({ action: "decline", poNote: poNote || undefined }),
        });
        return;
      }
      await api(`/public/po/${encodeURIComponent(t)}/submit`, {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
          poNote: poNote || undefined,
          lines: data.lines.map((l) => ({
            lineId: l.id,
            supplierConfirmedQty: Number(qty[l.id] ?? 0),
            supplierLineNote: lineNote[l.id]?.trim() || undefined,
          })),
        }),
      });
    },
    onSuccess: () => void refetch(),
  });

  const err = error instanceof Error ? error.message : null;

  const subtitle = useMemo(() => {
    if (!data) return null;
    return `${data.supplierName ?? "Supplier"} · ${data.poNumber}`;
  }, [data]);

  return (
    <div className="relative min-h-screen bg-zinc-950 px-4 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Supplier portal
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Purchase order</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </header>

        {isPending && <p className="text-sm text-muted">Loading…</p>}
        {err && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {err}
          </p>
        )}

        {data && (
          <>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-xs text-muted">
              <p>
                <span className="font-semibold text-foreground">Supervisor approved:</span>{" "}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(data.approvedAt))}
              </p>
              {data.sentAt && (
                <p className="mt-1">
                  <span className="font-semibold text-foreground">PO sent:</span>{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(data.sentAt))}
                </p>
              )}
              {data.supplierApprovedAt && (
                <p className="mt-1">
                  <span className="font-semibold text-emerald-200">Supplier approved:</span>{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(data.supplierApprovedAt))}
                </p>
              )}
              {data.supplierDeclinedAt && (
                <p className="mt-1 text-rose-200">
                  Declined{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(data.supplierDeclinedAt))}
                </p>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">AI suggested</th>
                    <th className="px-3 py-2">Ordered (supervisor)</th>
                    <th className="px-3 py-2">Your confirmed qty</th>
                    <th className="px-3 py-2">Line note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => {
                    const ordered = Number(l.approvedQty);
                    const confirmed = Number(qty[l.id] ?? l.approvedQty);
                    const hasDisc = Number.isFinite(ordered) && confirmed !== ordered;
                    return (
                      <tr
                        key={l.id}
                        className={cn(
                          "border-b border-white/[0.06] align-middle",
                          hasDisc && "bg-amber-500/[0.07]"
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-xs text-zinc-400">{l.internalNumber}</td>
                        <td className="px-3 py-2">{l.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted">{l.suggestedQty}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted">
                          {l.approvedQty}{" "}
                          <span className="font-sans text-[10px] text-zinc-500">{l.inventoryUnit}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-9 max-w-[120px] font-mono text-xs"
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={readOnly}
                            value={qty[l.id] ?? ""}
                            onChange={(e) => setQty((p) => ({ ...p, [l.id]: e.target.value }))}
                          />
                          {hasDisc && (
                            <span className="mt-1 block text-[10px] text-amber-200/90">Discrepancy vs order</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-9 min-w-[140px] text-xs"
                            disabled={readOnly}
                            value={lineNote[l.id] ?? ""}
                            onChange={(e) => setLineNote((p) => ({ ...p, [l.id]: e.target.value }))}
                            placeholder="Stock / substitution note"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                PO-level note (optional)
              </label>
              <textarea
                className="min-h-[88px] w-full rounded-lg border border-white/[0.1] bg-zinc-950/60 px-3 py-2 text-sm text-foreground outline-none ring-violet-500/40 focus:ring-2 disabled:opacity-50"
                disabled={readOnly}
                value={poNote}
                onChange={(e) => setPoNote(e.target.value)}
                placeholder="Anything the kitchen should know…"
              />
            </div>

            {!readOnly ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => submitMutation.mutate("approve")}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "Submitting…" : "Confirm quantities"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-500/40 text-rose-100"
                  onClick={() => submitMutation.mutate("decline")}
                  disabled={submitMutation.isPending}
                >
                  Decline PO
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">This link is read-only — responses are already recorded.</p>
            )}

            {submitMutation.isError && (
              <p className="text-sm text-rose-200">
                {submitMutation.error instanceof Error
                  ? submitMutation.error.message
                  : "Could not submit"}
              </p>
            )}
            {submitMutation.isSuccess && !submitMutation.isPending && data.status !== "SENT_TO_SUPPLIER" && (
              <p className="text-sm text-emerald-200">Thank you — your response has been saved.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
