import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  contactPerson: string | null;
  phone: string | null;
  contactEmail: string | null;
  orderingDaysNote: string | null;
  deliveryDaysNote: string | null;
  weekendsNote: string | null;
  leadTimeBusinessDays: number;
};

export function Suppliers() {
  const { data: rows = [], isPending } = useQuery({
    queryKey: qk.suppliersMaster,
    queryFn: () => api<SupplierRow[]>("/suppliers"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Master data"
        title="Suppliers"
        description="Supplier master columns: type (internal/external), ID, name, contact, phone, email, ordering and delivery days, weekends, lead time."
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
            <p className="p-6 text-sm text-muted">No suppliers found.</p>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">SupplierID</th>
                  <th className="px-3 py-2.5">Supplier name</th>
                  <th className="px-3 py-2.5">Contact</th>
                  <th className="px-3 py-2.5">Phone</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Ordering</th>
                  <th className="px-3 py-2.5">Delivery</th>
                  <th className="px-3 py-2.5">Weekends</th>
                  <th className="px-3 py-2.5">Lead (bd)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.05] odd:bg-transparent even:bg-white/[0.02] hover:bg-white/[0.04]"
                  >
                    <td className="px-3 py-2 text-muted">{r.kind}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-300">{r.code}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                    <td className="px-3 py-2 text-muted">{r.contactPerson ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.contactEmail ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.orderingDaysNote ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.deliveryDaysNote ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.weekendsNote ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{r.leadTimeBusinessDays}</td>
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
