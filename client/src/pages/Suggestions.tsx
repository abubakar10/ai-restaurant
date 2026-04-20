import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, FileDown, Trash2, WandSparkles } from "lucide-react";
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
  vendorName: string | null;
  supplierSku: string | null;
  unitCost: string | null;
  inventoryUnit: string;
  onHand: string;
  parLevel: string;
  gapVsPar: string;
  forecastedUse: string;
  suggestedOrderQty: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

type PoRes = {
  generatedAt: string;
  forecastWindowDays: number;
  forecastHorizonDays: number;
  lines: Line[];
};

type DraftLine = Line & { approvedQty: string };

type ApproveRes = {
  poNumber: string;
  approvedAt: string;
  lineCount: number;
  vendorCount: number;
  totalEstimated: string;
  status: string;
};

function priorityBadgeVariant(p: Line["priority"]) {
  return p === "high" ? "danger" : p === "medium" ? "warning" : "muted";
}

export function Suggestions() {
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data, error, dataUpdatedAt, isFetching, refetch, isRefetching } = useQuery({
    queryKey: qk.suggestionsPo,
    queryFn: () => api<PoRes>("/suggestions/po"),
    enabled: false,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      api<ApproveRes>("/suggestions/po/approve", {
        method: "POST",
        body: JSON.stringify({
          lines: draftLines.map((line) => ({
            ingredientId: line.ingredientId,
            name: line.name,
            inventoryUnit: line.inventoryUnit,
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
      setMessage(
        `PO ${res.poNumber} approved with ${res.lineCount} lines across ${res.vendorCount} vendor(s). Estimated total ${res.totalEstimated}. Approved ${approvedAt}.`
      );
    },
  });

  useEffect(() => {
    if (!data) return;
    setDraftLines(
      data.lines.map((line) => ({
        ...line,
        approvedQty: line.suggestedOrderQty,
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

  const deleteLine = (ingredientId: string) => {
    setDraftLines((prev) => prev.filter((line) => line.ingredientId !== ingredientId));
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

  const downloadSingleLinePo = (line: DraftLine) => {
    if (Number(line.approvedQty) <= 0) {
      setMessage("Approved quantity must be greater than zero to generate a PO PDF.");
      return;
    }
    downloadPoPdf({
      poNumber: `PO-${line.internalNumber}-${Date.now().toString().slice(-4)}`,
      title: "Single Item Purchase Order",
      lines: [
        {
          sku: line.internalNumber,
          ingredient: line.name,
          vendor: line.vendorName,
          suggestedQty: line.suggestedOrderQty,
          approvedQty: line.approvedQty,
          unit: line.inventoryUnit,
          unitCost: line.unitCost,
        },
      ],
    });
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="AI purchase suggestions"
        description="Supervisor mode: generate AI recommendations, edit quantities, remove lines, then approve the PO draft for supplier handoff."
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
                  Window {data.forecastWindowDays}d · horizon {data.forecastHorizonDays}d
                </span>
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
              <span className="mt-1 block lg:hidden">
                On smaller screens, each line is shown as a card.
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
                <span className="font-semibold text-zinc-300">{draftLines.length}</span> line(s) in
                draft · est. total{" "}
                <span className="font-semibold text-zinc-300">
                  {Number.isFinite(totalEstimate) ? totalEstimate.toFixed(2) : "—"}
                </span>
                <span className="ml-2 text-[11px] text-zinc-500">
                  (approved qty x est. unit cost)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={downloadFullDraftPo}
                  disabled={draftLines.length === 0}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download draft PDF
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={draftLines.length === 0 || hasInvalidQty || approveMutation.isPending}
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

            <div className="space-y-3 px-4 pb-5 pt-2 lg:hidden">
              {draftLines.map((line) => (
                <div
                  key={line.ingredientId}
                  className="rounded-xl border border-white/[0.1] bg-zinc-950/50 p-4 shadow-sm shadow-black/20"
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
                    {line.vendorName ?? "Vendor —"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Suggested qty
                      </p>
                      <p className="mt-0.5 font-mono text-base tabular-nums text-zinc-100">
                        {line.suggestedOrderQty}{" "}
                        <span className="text-xs font-sans text-muted">{line.inventoryUnit}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Approved qty
                      </p>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.approvedQty}
                        onChange={(e) => updateApprovedQty(line.ingredientId, e.target.value)}
                        className="mt-1 h-9"
                      />
                      <p className="mt-1 text-[10px] text-muted">{line.inventoryUnit}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-muted">
                    <span className="font-mono text-[10px] text-zinc-500">Rationale · </span>
                    {line.reason}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => downloadSingleLinePo(line)}
                    >
                      <FileDown className="h-4 w-4" aria-hidden />
                      Generate PO PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-300 hover:text-rose-200"
                      onClick={() => deleteLine(line.ingredientId)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-medium">Priority</th>
                    <th className="px-4 py-2.5 font-medium">SKU</th>
                    <th className="px-4 py-2.5 font-medium">Ingredient</th>
                    <th className="px-4 py-2.5 font-medium">Vendor</th>
                    <th className="px-4 py-2.5 font-medium">Suggested qty</th>
                    <th className="px-4 py-2.5 font-medium">Approved qty</th>
                    <th className="px-4 py-2.5 font-medium">Est. unit cost</th>
                    <th className="px-4 py-2.5 font-medium">Rationale</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((line) => (
                    <tr
                      key={line.ingredientId}
                      className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-2.5 align-top">
                        <Badge variant={priorityBadgeVariant(line.priority)} className="uppercase">
                          {line.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="font-mono text-xs text-zinc-300">{line.internalNumber}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">{line.name}</td>
                      <td className="px-4 py-2.5 align-top">{line.vendorName ?? "—"}</td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="font-mono text-sm tabular-nums text-zinc-200">
                          {line.suggestedOrderQty}{" "}
                          <span className="text-xs text-muted">{line.inventoryUnit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="max-w-28">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.approvedQty}
                            onChange={(e) => updateApprovedQty(line.ingredientId, e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-top tabular-nums">{line.unitCost ?? "—"}</td>
                      <td className="max-w-[320px] px-4 py-2.5 align-top text-muted">{line.reason}</td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => downloadSingleLinePo(line)}
                        >
                          <FileDown className="h-4 w-4" aria-hidden />
                          Generate PO
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-300 hover:text-rose-200"
                          onClick={() => deleteLine(line.ingredientId)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Delete
                        </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
