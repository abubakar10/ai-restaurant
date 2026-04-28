import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import { cn } from "../lib/utils";

type PoLine = {
  id: string;
  name: string;
  internalNumber: string;
  suggestedQty: string;
  approvedQty: string;
  supplierConfirmedQty: string | null;
  supplierLineNote: string | null;
  receivedQty: string | null;
  receivingNote: string | null;
  inventoryUnit: string;
};

type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  status: string;
  supplier: { code: string; name: string } | null;
  lines: PoLine[];
};

function expectedQty(line: PoLine): string {
  return line.supplierConfirmedQty ?? line.approvedQty;
}

export function Receiving() {
  const queryClient = useQueryClient();
  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.purchaseOrders,
    queryFn: () => api<PurchaseOrderRow[]>("/purchase-orders"),
  });

  const receivable = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.status === "SUPPLIER_APPROVED" ||
          r.status === "SENT_TO_SUPPLIER" ||
          r.status === "APPROVED"
      ),
    [rows]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = receivable.find((r) => r.id === selectedId) ?? null;

  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [noteByLine, setNoteByLine] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const openPo = (po: PurchaseOrderRow) => {
    setSelectedId(po.id);
    const q: Record<string, string> = {};
    const n: Record<string, string> = {};
    for (const l of po.lines) {
      q[l.id] = expectedQty(l);
      n[l.id] = l.receivingNote ?? "";
    }
    setQtyByLine(q);
    setNoteByLine(n);
    setMsg(null);
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const lines = selected.lines.map((l) => ({
        lineId: l.id,
        receivedQty: Number(qtyByLine[l.id] ?? 0),
        receivingNote: noteByLine[l.id]?.trim() || undefined,
      }));
      await api(`/purchase-orders/${selected.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
    },
    onSuccess: async () => {
      setMsg("Receiving saved. Inventory updated from received quantities.");
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: qk.purchaseOrders });
      await queryClient.invalidateQueries({ queryKey: qk.ingredients });
      await queryClient.invalidateQueries({ queryKey: qk.suggestionsPo });
      await queryClient.invalidateQueries({ queryKey: qk.approvedPoLines });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: (e) => {
      setMsg(e instanceof Error ? e.message : "Failed to receive");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="Receiving"
        description="Open POs in flight, confirm physical receipt, record discrepancies vs expected (supplier-confirmed or supervisor-approved), and post stock to inventory."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Open for receiving</p>
            <p className="mt-1 text-xs text-muted">Statuses: sent to supplier (pre-confirm) or supplier approved.</p>
          </div>
          {isPending ? (
            <p className="p-4 text-sm text-muted">Loading…</p>
          ) : receivable.length === 0 ? (
            <p className="p-4 text-sm text-muted">No POs waiting for receiving.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {receivable.map((po) => (
                <li key={po.id}>
                  <button
                    type="button"
                    onClick={() => openPo(po)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-sm transition hover:bg-white/[0.04]",
                      selectedId === po.id && "bg-white/[0.06]"
                    )}
                  >
                    <span className="font-mono text-xs font-semibold text-zinc-200">{po.poNumber}</span>
                    <span className="text-xs text-muted">{po.supplier?.name ?? "Supplier —"}</span>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">{po.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Confirm receipt</p>
            <p className="mt-1 text-xs text-muted">
              Expected qty uses supplier-confirmed amount when present, otherwise the supervisor-approved qty.
            </p>
          </div>
          {!selected ? (
            <p className="p-4 text-sm text-muted">Select a PO on the left.</p>
          ) : (
            <div className="space-y-4 p-4">
              {msg && (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  {msg}
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[10px] font-semibold uppercase tracking-wider text-muted">
                      <th className="px-2 py-2">SKU</th>
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2">AI suggested</th>
                      <th className="px-2 py-2">Supervisor</th>
                      <th className="px-2 py-2">Supplier</th>
                      <th className="px-2 py-2">Received</th>
                      <th className="px-2 py-2">Recv. note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((l) => {
                      const disc =
                        l.supplierConfirmedQty != null &&
                        l.supplierConfirmedQty !== l.approvedQty;
                      return (
                        <tr
                          key={l.id}
                          className={cn(
                            "border-b border-white/[0.05] align-middle",
                            disc && "bg-amber-500/[0.06]"
                          )}
                        >
                          <td className="px-2 py-2 font-mono text-zinc-400">{l.internalNumber}</td>
                          <td className="px-2 py-2 text-foreground">{l.name}</td>
                          <td className="px-2 py-2 font-mono tabular-nums text-muted">{l.suggestedQty}</td>
                          <td className="px-2 py-2 font-mono tabular-nums text-muted">{l.approvedQty}</td>
                          <td className="px-2 py-2 font-mono tabular-nums text-muted">
                            {l.supplierConfirmedQty ?? "—"}
                            {disc ? (
                              <span className="mt-0.5 block text-[10px] font-normal text-amber-200/90">
                                discrepancy
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              className="h-8 max-w-[100px] font-mono text-xs"
                              type="number"
                              min={0}
                              step="0.01"
                              value={qtyByLine[l.id] ?? ""}
                              onChange={(e) =>
                                setQtyByLine((prev) => ({ ...prev, [l.id]: e.target.value }))
                              }
                            />
                            <span className="mt-0.5 block text-[10px] text-muted">{l.inventoryUnit}</span>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              className="h-8 min-w-[120px] text-xs"
                              value={noteByLine[l.id] ?? ""}
                              onChange={(e) =>
                                setNoteByLine((prev) => ({ ...prev, [l.id]: e.target.value }))
                              }
                              placeholder="Optional"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button
                onClick={() => receiveMutation.mutate()}
                disabled={receiveMutation.isPending}
                className="w-full sm:w-auto"
              >
                {receiveMutation.isPending ? "Saving…" : "Post receiving & update inventory"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
