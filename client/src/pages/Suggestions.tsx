import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, ThumbsDown, WandSparkles } from "lucide-react";
import { api } from "../lib/api";
import { downloadPoPdf } from "../lib/poPdf";
import { qk } from "../lib/queryClient";
import { PageHeader } from "../components/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type Line = {
  ingredientId: string;
  name: string;
  internalNumber: string;
  supplierCode: string | null;
  supplierEmail: string | null;
  supplierKind: string | null;
  vendorName: string | null;
  supplierSku: string | null;
  unitCost: string | null;
  inventoryUnit: string;
  onHand: string;
  parLevel: string;
  leadTimeBusinessDays: number;
  forecastDemand: string;
  mapePct: string;
  safetyStock: string;
  openPoQty: string;
  recommendedRaw: string;
  possibleQty: string;
  gapVsPar: string;
  suggestedOrderQty: string;
  reason: string;
  aiNote: string;
  priority: "high" | "medium" | "low";
};

type PoRes = {
  generatedAt: string;
  forecastWindowDays: number;
  forecastHorizonDays: number;
  forecastHorizonNote?: string;
  engine?: string;
  lines: Line[];
};

type DraftLine = Line & { approvedQty: string; disapproved?: boolean };
type ApprovedLine = {
  id: string;
  ingredientId: string;
  name: string;
  internalNumber: string;
  vendorName: string | null;
  inventoryUnit: string;
  suggestedQty: string;
  approvedQty: string;
  unitCost: string | null;
  poNumber: string;
  approvedAt: string;
};

type ApproveRes = {
  poNumber: string;
  approvedAt: string;
  lineCount: number;
  vendorCount: number;
  totalEstimated: string;
  status: string;
  email?: {
    sent: boolean;
    to: string;
    mode: "smtp" | "simulated";
    error?: string | null;
  };
};

function priorityBadgeVariant(p: Line["priority"]) {
  return p === "high" ? "danger" : p === "medium" ? "warning" : "muted";
}

export function Suggestions() {
  const queryClient = useQueryClient();
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, error, dataUpdatedAt, isFetching, refetch, isRefetching } = useQuery({
    queryKey: qk.suggestionsPo,
    queryFn: () => api<PoRes>("/suggestions/po"),
    enabled: false,
  });
  const { data: approvedLines = [] } = useQuery({
    queryKey: qk.approvedPoLines,
    queryFn: () => api<ApprovedLine[]>("/suggestions/po/approved"),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      api<ApproveRes>("/suggestions/po/approve", {
        method: "POST",
        body: JSON.stringify({
          lines: draftLines
            .filter((line) => !line.disapproved)
            .map((line) => ({
            ingredientId: line.ingredientId,
            name: line.name,
            internalNumber: line.internalNumber,
            inventoryUnit: line.inventoryUnit,
            suggestedQty: Number(line.suggestedOrderQty || 0),
            approvedQty: Number(line.approvedQty || 0),
            unitCost: line.unitCost == null ? null : Number(line.unitCost),
            vendorName: line.vendorName ?? null,
            })),
        }),
      }),
    onSuccess: (res) => {
      const approvedLines = draftLines.filter((line) => Number(line.approvedQty) > 0);
      if (approvedLines.length) {
        downloadPoPdf({
          poNumber: res.poNumber,
          approvedAt: res.approvedAt,
          title: "Approved Purchase Order",
          lines: approvedLines.map((line) => ({
            sku: line.internalNumber,
            ingredient: line.name,
            vendor: line.vendorName,
            suggestedQty: line.suggestedOrderQty,
            approvedQty: line.approvedQty,
            unit: line.inventoryUnit,
            unitCost: line.unitCost,
          })),
        });
      }
      const approvedAt = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(res.approvedAt));
      const emailLine = res.email
        ? res.email.sent
          ? ` Email sent to ${res.email.to}.`
          : ` Email not sent (${res.email.mode}); target ${res.email.to}${res.email.error ? `: ${res.email.error}` : "."}`
        : "";
      setMessage(
        `PO ${res.poNumber} approved with ${res.lineCount} lines across ${res.vendorCount} vendor(s). Estimated total ${res.totalEstimated}. Approved ${approvedAt}.${emailLine}`
      );
      setDraftLines([]);
      void queryClient.invalidateQueries({ queryKey: qk.approvedPoLines });
    },
  });

  useEffect(() => {
    if (!data) return;
    setDraftLines(
      data.lines.map((line) => ({
        ...line,
        approvedQty: line.suggestedOrderQty,
        disapproved: false,
      }))
    );
    setMessage(null);
  }, [data]);

  const generateSuggestions = async () => {
    setMessage(null);
    setHasGenerated(true);
    await refetch();
  };

  const updateApprovedQty = (ingredientId: string, qty: string) => {
    setDraftLines((prev) =>
      prev.map((line) =>
        line.ingredientId === ingredientId ? { ...line, approvedQty: qty } : line
      )
    );
  };

  const disapproveLine = (ingredientId: string) => {
    setDraftLines((prev) =>
      prev.map((line) =>
        line.ingredientId === ingredientId ? { ...line, disapproved: true, approvedQty: "0" } : line
      )
    );
  };

  const runSearch = () => {
    setSearchQuery(searchInput.trim().toLowerCase());
  };

  const totalEstimate = useMemo(() => {
    return draftLines.reduce((sum, line) => {
      const qty = Number(line.approvedQty);
      const unitCost = line.unitCost == null ? NaN : Number(line.unitCost);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitCost)) return sum;
      return sum + qty * unitCost;
    }, 0);
  }, [draftLines]);

  const hasInvalidQty = draftLines.some((line) => {
    const q = Number(line.approvedQty);
    return !Number.isFinite(q) || q < 0;
  });

  const downloadFullDraftPo = () => {
    if (!draftLines.length) return;
    downloadPoPdf({
      poNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
      title: "Draft Purchase Order",
      lines: draftLines
        .filter((line) => Number(line.approvedQty) > 0)
        .map((line) => ({
          sku: line.internalNumber,
          ingredient: line.name,
          vendor: line.vendorName,
          suggestedQty: line.suggestedOrderQty,
          approvedQty: line.approvedQty,
          unit: line.inventoryUnit,
          unitCost: line.unitCost,
        })),
    });
  };

  const approveSingleLine = async (line: DraftLine) => {
    if (Number(line.approvedQty) <= 0) {
      setMessage("Approved quantity must be greater than zero.");
      return;
    }
    try {
      const res = await api<ApproveRes>("/suggestions/po/approve", {
        method: "POST",
        body: JSON.stringify({
          lines: [
            {
              ingredientId: line.ingredientId,
              name: line.name,
              internalNumber: line.internalNumber,
              inventoryUnit: line.inventoryUnit,
              suggestedQty: Number(line.suggestedOrderQty || 0),
              approvedQty: Number(line.approvedQty),
              unitCost: line.unitCost == null ? null : Number(line.unitCost),
              vendorName: line.vendorName ?? null,
            },
          ],
        }),
      });
      setDraftLines((prev) => prev.filter((l) => l.ingredientId !== line.ingredientId));
      const emailLine = res.email
        ? res.email.sent
          ? ` Email sent to ${res.email.to}.`
          : ` Email not sent (${res.email.mode}); target ${res.email.to}${res.email.error ? `: ${res.email.error}` : "."}`
        : "";
      setMessage(`${line.name} moved to Approved.${emailLine}`);
      void queryClient.invalidateQueries({ queryKey: qk.approvedPoLines });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to approve.");
    }
  };

  const err = error instanceof Error ? error.message : null;

  const updatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(dataUpdatedAt)
    : null;

  const generatedStr = data
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.generatedAt))
    : null;

  const filteredDraftLines = useMemo(() => {
    if (!searchQuery) return draftLines;
    return draftLines.filter((line) => {
      const haystack = [
        line.internalNumber,
        line.name,
        line.vendorName ?? "",
        line.supplierCode ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [draftLines, searchQuery]);

  const filteredApprovedLines = useMemo(() => {
    if (!searchQuery) return approvedLines;
    return approvedLines.filter((line) => {
      const haystack = [line.internalNumber, line.name, line.vendorName ?? "", line.poNumber]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [approvedLines, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="AI purchase suggestions"
        description="Milestone 2: forecast + MAPE safety over supplier lead time (business days, weekends excluded), open PO netting, supplier-feasible “Possible” qty, supervisor edit, then approve."
        meta={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex items-center justify-end gap-2">
              <Badge variant="warning" className="uppercase">
                Supervisor
              </Badge>
              <Button
                size="sm"
                onClick={generateSuggestions}
                disabled={isRefetching}
                className="min-w-44"
              >
                <WandSparkles className="h-4 w-4" aria-hidden />
                {isRefetching ? "Generating..." : "Generate recommendations"}
              </Button>
            </div>
            {generatedStr && data && (
              <div className="rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Engine run
                </span>
                <span className="text-foreground">{generatedStr}</span>
                <span className="mt-1 block text-[11px] text-zinc-500">
                  Sales lookback {data.forecastWindowDays}d · lead default{" "}
                  {data.forecastHorizonDays} business day(s)
                  {data.engine ? ` · ${data.engine}` : ""}
                </span>
                {data.forecastHorizonNote && (
                  <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                    {data.forecastHorizonNote}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>
                {updatedLabel ? (
                  <>
                    View synced{" "}
                    <span className="font-medium text-foreground">{updatedLabel}</span>
                    {isFetching ? " · updating…" : ""}
                  </>
                ) : (
                  "Click Generate recommendations to run AI"
                )}
              </span>
            </div>
          </div>
        }
      />

      {err && hasGenerated && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {err}
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Draft order lines</CardTitle>
            <CardDescription>
              Suggested quantities are editable. You can remove lines before approval.
              <span className="mt-1 block">
                Estimate means cost estimate: line estimate = approved qty x est. unit
                cost, draft estimate = sum of all lines.
              </span>
              <span className="mt-1 block">
                This view uses simple cards to avoid horizontal scrolling.
              </span>
            </CardDescription>
          </CardHeader>
        </div>

        {!hasGenerated ? (
          <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
            Generate recommendations to build the supervisor draft PO.
          </p>
        ) : isRefetching ? (
          <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
            Computing suggestions…
          </p>
        ) : draftLines.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted lg:px-5">
            No lines in this draft. Generate again or keep inventory as-is.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.015] px-4 py-3 text-xs text-muted lg:px-5">
              <div>
                <span className="font-semibold text-zinc-300">{filteredDraftLines.length}</span> line(s) in
                draft · est. total{" "}
                <span className="font-semibold text-zinc-300">
                  {Number.isFinite(totalEstimate) ? totalEstimate.toFixed(2) : "—"}
                </span>
                <span className="ml-2 text-[11px] text-zinc-500">
                  (approved qty x est. unit cost)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch();
                    }}
                    placeholder="Search SKU, item, vendor..."
                    className="h-9 w-56"
                  />
                  <Button size="sm" variant="secondary" onClick={runSearch}>
                    Search
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={downloadFullDraftPo}
                  disabled={filteredDraftLines.length === 0}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download draft PDF
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={
                    filteredDraftLines.length === 0 || hasInvalidQty || approveMutation.isPending
                  }
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {approveMutation.isPending ? "Approving..." : "Approve PO draft"}
                </Button>
              </div>
            </div>

            {hasInvalidQty && (
              <p className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 lg:mx-5">
                Approved quantity must be a non-negative number.
              </p>
            )}
            {approveMutation.error && (
              <p className="mx-4 mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 lg:mx-5">
                {approveMutation.error instanceof Error
                  ? approveMutation.error.message
                  : "Failed to approve PO draft"}
              </p>
            )}
            {message && (
              <p className="mx-4 mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 lg:mx-5">
                {message}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 px-4 pb-5 pt-2 md:grid-cols-2 xl:grid-cols-3">
              {filteredDraftLines.map((line) => (
                <div
                  key={line.ingredientId}
                  className={`rounded-xl border border-white/[0.1] bg-zinc-950/50 p-4 shadow-sm shadow-black/20 ${
                    line.disapproved ? "opacity-45 grayscale" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant={priorityBadgeVariant(line.priority)}
                      className="uppercase"
                    >
                      {line.priority}
                    </Badge>
                    <span className="font-mono text-xs text-zinc-400">{line.internalNumber}</span>
                  </div>
                  <p className="mt-2 font-medium leading-snug text-foreground">{line.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {line.vendorName ?? "Vendor —"}{" "}
                    {line.supplierCode ? (
                      <span className="font-mono text-zinc-500"> · {line.supplierCode}</span>
                    ) : null}
                  </p>
                  {line.supplierEmail && (
                    <p className="mt-0.5 text-[10px] text-zinc-500">{line.supplierEmail}</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3 text-[11px] text-muted">
                    <div>Forecast ({line.leadTimeBusinessDays}bd)</div>
                    <div className="font-mono text-foreground">{line.forecastDemand}</div>
                    <div>MAPE</div>
                    <div className="font-mono text-foreground">{line.mapePct}%</div>
                    <div>Safety</div>
                    <div className="font-mono text-foreground">{line.safetyStock}</div>
                    <div>Open PO</div>
                    <div className="font-mono text-foreground">{line.openPoQty}</div>
                    <div>Rec (raw)</div>
                    <div className="font-mono text-foreground">{line.recommendedRaw}</div>
                    <div>Possible</div>
                    <div className="font-mono text-emerald-200/90">{line.possibleQty}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Possible (AI)
                      </p>
                      <p className="mt-0.5 font-mono text-base tabular-nums text-zinc-100">
                        {line.suggestedOrderQty}{" "}
                        <span className="text-xs font-sans text-muted">{line.inventoryUnit}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Supervisor qty
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.approvedQty}
                        onChange={(e) => updateApprovedQty(line.ingredientId, e.target.value)}
                        className="mt-1 h-9"
                        disabled={line.disapproved}
                      />
                      <p className="mt-1 text-[10px] text-muted">{line.inventoryUnit}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-muted">
                    <span className="font-mono text-[10px] text-zinc-500">AI note · </span>
                    {line.aiNote}
                  </div>
                  <div className="mt-2 rounded-lg bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-muted">
                    <span className="font-mono text-[10px] text-zinc-500">Summary · </span>
                    {line.reason}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => approveSingleLine(line)}
                      disabled={Boolean(line.disapproved)}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto text-amber-200"
                      onClick={() => disapproveLine(line.ingredientId)}
                      disabled={Boolean(line.disapproved)}
                    >
                      <ThumbsDown className="h-4 w-4" aria-hidden />
                      Disapprove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

          </>
        )}
      </Card>
      {approvedLines.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Approved order lines</CardTitle>
              <CardDescription>
                Lines generated as PO are removed from draft and listed here.
              </CardDescription>
            </CardHeader>
          </div>
          <div className="grid grid-cols-1 gap-3 px-4 pb-5 pt-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredApprovedLines.map((line) => (
              <div
                key={`${line.ingredientId}-${line.poNumber}-${line.approvedAt}`}
                className="rounded-xl border border-white/[0.1] bg-zinc-950/50 p-4 shadow-sm shadow-black/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      PO {line.poNumber}
                    </p>
                    <p className="mt-1 font-medium leading-snug text-foreground">{line.name}</p>
                    <p className="mt-1 text-xs text-muted">{line.vendorName ?? "Vendor —"}</p>
                  </div>
                  <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    Approved
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">SKU</p>
                    <p className="mt-1 font-mono text-xs text-zinc-300">{line.internalNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Approved qty
                    </p>
                    <p className="mt-1 font-mono tabular-nums text-foreground">
                      {line.approvedQty}{" "}
                      <span className="font-sans text-xs text-muted">{line.inventoryUnit}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-muted">
                  Approved{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(line.approvedAt))}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
