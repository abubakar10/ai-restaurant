import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui/card";
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
  approvedAt: string;
  sentAt: string | null;
  supplierApprovedAt: string | null;
  supplierDeclinedAt: string | null;
  supplierPoNote: string | null;
  supplier: { code: string; name: string; contactEmail: string | null } | null;
  lineCount: number;
  lines: PoLine[];
};

function statusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return { label: "Approved (legacy)", className: "border-zinc-500/30 bg-zinc-500/12 text-zinc-200" };
    case "SENT_TO_SUPPLIER":
      return { label: "Supplier pending", className: "border-amber-500/30 bg-amber-500/15 text-amber-100" };
    case "SUPPLIER_APPROVED":
      return { label: "Supplier approved", className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-100" };
    case "SUPPLIER_DECLINED":
      return { label: "Declined", className: "border-rose-500/30 bg-rose-500/15 text-rose-100" };
    case "RECEIVED":
      return { label: "Received", className: "border-cyan-500/30 bg-cyan-500/15 text-cyan-100" };
    case "CANCELLED":
      return { label: "Cancelled", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" };
    default:
      return { label: status, className: "border-white/10 bg-white/[0.06] text-foreground" };
  }
}

export function PoStatus() {
  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.purchaseOrders,
    queryFn: () => api<PurchaseOrderRow[]>("/purchase-orders"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="PO status"
        description="Sent purchase orders with lifecycle timestamps, supplier notes, and line-level discrepancies."
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          {isPending ? (
            <p className="p-6 text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted">No purchase orders yet.</p>
          ) : (
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-3 py-2.5">PO</th>
                  <th className="px-3 py-2.5">Supplier</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Supervisor approved</th>
                  <th className="px-3 py-2.5">Sent</th>
                  <th className="px-3 py-2.5">Supplier action</th>
                  <th className="px-3 py-2.5">Lines</th>
                  <th className="px-3 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((po) => {
                  const b = statusBadge(po.status);
                  return (
                    <tr
                      key={po.id}
                      className="border-b border-white/[0.05] align-top odd:bg-transparent even:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-zinc-200">
                        {po.poNumber}
                      </td>
                      <td className="px-3 py-2.5 text-muted">
                        <span className="font-medium text-foreground">
                          {po.supplier?.name ?? "—"}
                        </span>
                        {po.supplier?.code ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                            {po.supplier.code}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            b.className
                          )}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(po.approvedAt))}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {po.sentAt
                          ? new Intl.DateTimeFormat(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(po.sentAt))
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {po.supplierApprovedAt
                          ? new Intl.DateTimeFormat(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(po.supplierApprovedAt))
                          : po.supplierDeclinedAt
                            ? `Declined ${new Intl.DateTimeFormat(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(po.supplierDeclinedAt))}`
                            : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">{po.lineCount}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {po.supplierPoNote ? (
                          <span className="line-clamp-3">{po.supplierPoNote}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {rows.some((r) => r.lines.some((l) => l.supplierConfirmedQty && l.supplierConfirmedQty !== l.approvedQty)) && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Discrepancy summary</p>
          <p className="mt-2 text-sm text-muted">
            Lines where supplier-confirmed qty differs from the supervisor-approved qty are highlighted on the
            receiving tab and were locked in when the supplier submitted the portal.
          </p>
        </Card>
      )}
    </div>
  );
}
