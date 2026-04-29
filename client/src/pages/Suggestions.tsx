import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "../lib/utils";

type Line = {
  ingredientId: string;
  supplierId: string | null;
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
  /** Master sheet lead (business days). */
  leadTimeBusinessDays: number;
  supplierLeadTimeDays?: number;
  /** Business days summed for demand (short for daily suppliers; longer for scheduled). */
  forecastCoverBusinessDays?: number;
  forecastModel?: "daily_short" | "scheduled_long";
  orderingDaysNote?: string | null;
  deliveryDaysNote?: string | null;
  weekendsNote?: string | null;
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
  forecastHorizonDays: number | null;
  forecastHorizonNote?: string;
  engine?: string;
  lines: Line[];
};

type DraftLine = Line & { approvedQty: string; disapproved?: boolean };

type PoCreated = {
  poNumber: string;
  approvedAt: string;
  lineCount: number;
  supplierName: string | null;
  supplierCode: string | null;
  portalUrl: string;
  email: { sent: boolean; to: string; mode: string; error?: string | null };
  totalEstimated: string;
  pdfLines: {
    sku: string;
    ingredient: string;
    vendor: string | null;
    suggestedQty: string;
    approvedQty: string;
    unit: string;
    unitCost: string | null;
  }[];
};

type ApproveRes = {
  pos: PoCreated[];
  poCount: number;
  lineCount: number;
  vendorCount: number;
  poNumber?: string;
  approvedAt?: string;
  totalEstimated: string;
  status: string;
};

type ApprovedLine = {
  id: string;
  ingredientId: string;
  name: string;
  internalNumber: string;
  vendorName: string | null;
  inventoryUnit: string;
  suggestedQty: string;
  approvedQty: string;
  supplierConfirmedQty: string | null;
  supplierLineNote: string | null;
  receivedQty: string | null;
  receivingNote: string | null;
  unitCost: string | null;
  poNumber: string;
  poStatus: string;
  approvedAt: string;
  sentAt: string | null;
  supplierApprovedAt: string | null;
  supplierDeclinedAt: string | null;
  supplierPoNote: string | null;
  supplierCode: string | null;
  supplierName: string | null;
};

function supplierGroupKey(line: DraftLine): string {
  return line.supplierId ?? "__none__";
}

function supplierGroupLabel(lines: DraftLine[]): string {
  const first = lines[0];
  if (!first) return "Supplier";
  if (first.supplierCode) return `${first.supplierCode} · ${first.vendorName ?? "Supplier"}`;
  return first.vendorName ?? "No linked supplier";
}

export function Suggestions() {
  const queryClient = useQueryClient();
  const draftTableScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; startX: number; startLeft: number }>({
    active: false,
    startX: 0,
    startLeft: 0,
  });
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
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
            .filter(
              (line) => !line.disapproved && selectedLineIds.includes(line.ingredientId)
            )
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
      const pos = res.pos ?? [];
      const emailBits = pos
        .map(
          (p) =>
            `${p.poNumber}: ${p.email.sent ? "sent" : "not sent"} → ${p.email.to}${
              p.email.error ? ` (${p.email.error})` : ""
            }`
        )
        .join(" · ");
      setMessage(
        `Created ${res.poCount} PO(s) for ${res.vendorCount} supplier group(s), ${res.lineCount} line(s). Est. total ${res.totalEstimated}. ${emailBits}`
      );
      setDraftLines([]);
      setSelectedLineIds([]);
      void queryClient.invalidateQueries({ queryKey: qk.approvedPoLines });
      void queryClient.invalidateQueries({ queryKey: qk.purchaseOrders });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
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
    setSelectedLineIds(data.lines.map((line) => line.ingredientId));
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
    setSelectedLineIds((prev) => prev.filter((id) => id !== ingredientId));
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

  const toggleLineSelection = (ingredientId: string) => {
    setSelectedLineIds((prev) =>
      prev.includes(ingredientId) ? prev.filter((id) => id !== ingredientId) : [...prev, ingredientId]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleSelectable = filteredDraftLines
      .filter((l) => !l.disapproved)
      .map((l) => l.ingredientId);
    const allSelected =
      visibleSelectable.length > 0 &&
      visibleSelectable.every((id) => selectedLineIds.includes(id));
    if (allSelected) {
      setSelectedLineIds((prev) => prev.filter((id) => !visibleSelectable.includes(id)));
    } else {
      setSelectedLineIds((prev) => Array.from(new Set([...prev, ...visibleSelectable])));
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

  const draftGroups = useMemo(() => {
    const map = new Map<string, DraftLine[]>();
    for (const line of filteredDraftLines) {
      const k = supplierGroupKey(line);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(line);
    }
    const entries = [...map.entries()];
    entries.sort((a, b) =>
      supplierGroupLabel(a[1]).localeCompare(supplierGroupLabel(b[1]), undefined, {
        sensitivity: "base",
      })
    );
    return entries;
  }, [filteredDraftLines]);

  const filteredApprovedLines = useMemo(() => {
    if (!searchQuery) return approvedLines;
    return approvedLines.filter((line) => {
      const haystack = [line.internalNumber, line.name, line.vendorName ?? "", line.poNumber]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [approvedLines, searchQuery]);
  const selectedCount = useMemo(
    () =>
      draftLines.filter(
        (l) => !l.disapproved && selectedLineIds.includes(l.ingredientId) && Number(l.approvedQty) > 0
      ).length,
    [draftLines, selectedLineIds]
  );

  const startDragScroll = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = draftTableScrollRef.current;
    if (!container) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, button, select, textarea, a, label")) return;
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startLeft: container.scrollLeft,
    };
    container.classList.add("drag-scroll-active");
  };

  const onDragScroll = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = draftTableScrollRef.current;
    if (!container || !dragStateRef.current.active) return;
    const dx = e.clientX - dragStateRef.current.startX;
    container.scrollLeft = dragStateRef.current.startLeft - dx;
  };

  const stopDragScroll = () => {
    const container = draftTableScrollRef.current;
    dragStateRef.current.active = false;
    if (container) container.classList.remove("drag-scroll-active");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement"
        title="AI purchase suggestions"
        description="Forecast + MAPE, open PO netting, and pack-rounded “Possible” qty. One PO per supplier on approve."
        meta={
          <div className="flex max-w-xl flex-col items-stretch gap-2.5 sm:max-w-none sm:items-end">
            <details className="rounded-lg border border-white/[0.08] bg-zinc-950/40 px-3 py-2 text-left text-[11px] text-muted sm:text-right">
              <summary className="cursor-pointer list-none font-medium text-foreground/90 outline-none [&::-webkit-details-marker]:hidden">
                How daily vs scheduled forecast works
              </summary>
              <p className="mt-2 leading-relaxed">
                Short cover uses supplier lead days only when ordering <strong>and</strong> delivery are both
                marked Daily. Otherwise the engine sums demand over a longer business-day window (weekends
                excluded). Same rules as the supplier master sheet.
              </p>
            </details>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="warning" className="uppercase">
                Supervisor
              </Badge>
              <Button
                size="sm"
                onClick={generateSuggestions}
                disabled={isRefetching}
                className="min-w-40 shrink-0"
              >
                <WandSparkles className="h-4 w-4" aria-hidden />
                {isRefetching ? "Running…" : "Generate recommendations"}
              </Button>
            </div>
            {generatedStr && data && (
              <div className="rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-left text-[11px] text-muted sm:text-right">
                <span className="font-medium text-foreground">{generatedStr}</span>
                <span className="mt-1 block text-zinc-500">
                  Lookback {data.forecastWindowDays}d
                  {data.forecastHorizonDays != null
                    ? ` · default ${data.forecastHorizonDays} bd`
                    : " · cover varies by supplier"}
                  {data.engine ? ` · ${data.engine}` : ""}
                </span>
                {data.forecastHorizonNote && (
                  <details className="mt-2 text-left">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Full engine note
                    </summary>
                    <p className="mt-1.5 max-h-28 overflow-y-auto leading-snug">{data.forecastHorizonNote}</p>
                  </details>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-950/50 px-3 py-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>
                {updatedLabel ? (
                  <>
                    Synced{" "}
                    <span className="font-medium text-foreground">{updatedLabel}</span>
                    {isFetching ? " · …" : ""}
                  </>
                ) : (
                  "Run Generate to load the draft table"
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
              Table view grouped by supplier — approving sends one consolidated PO per supplier. Quantities are
              editable; remove lines with disapprove before approval.
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
              <div className="min-w-0">
                <span className="font-semibold text-zinc-300">{filteredDraftLines.length}</span> lines · est.{" "}
                <span className="font-semibold text-zinc-300">
                  {Number.isFinite(totalEstimate) ? totalEstimate.toFixed(2) : "—"}
                </span>
                <span className="ml-1.5 text-[11px] text-zinc-500">(qty × unit cost)</span>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
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
                    selectedCount === 0 || hasInvalidQty || approveMutation.isPending
                  }
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {approveMutation.isPending ? "Approving..." : `Approve selected (${selectedCount})`}
                </Button>
              </div>
            </div>
            <div className="px-4 pb-2 text-[11px] text-zinc-500 lg:px-5">
              Tip: select multiple items first, then approve once to keep one consolidated PO per supplier.
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

            <div
              ref={draftTableScrollRef}
              className="drag-scroll no-scrollbar overflow-x-auto scroll-smooth px-2 pb-5 pt-2 lg:px-4 touch-pan-x"
              onMouseDown={startDragScroll}
              onMouseMove={onDragScroll}
              onMouseUp={stopDragScroll}
              onMouseLeave={stopDragScroll}
            >
              <table className="w-full min-w-[980px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-5 w-5 cursor-pointer accent-violet-500"
                        checked={
                          filteredDraftLines.filter((l) => !l.disapproved).length > 0 &&
                          filteredDraftLines
                            .filter((l) => !l.disapproved)
                            .every((l) => selectedLineIds.includes(l.ingredientId))
                        }
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all visible lines"
                      />
                    </th>
                    <th className="px-2 py-2 whitespace-nowrap">SKU</th>
                    <th className="px-2 py-2 whitespace-nowrap">Item</th>
                    <th className="px-2 py-2 whitespace-nowrap">Vendor</th>
                    <th className="px-2 py-2 whitespace-nowrap">Schedule</th>
                    <th className="px-2 py-2 whitespace-nowrap">Lead time</th>
                    <th className="px-2 py-2 whitespace-nowrap">Model</th>
                    <th className="px-2 py-2 whitespace-nowrap">Forecast</th>
                    <th className="px-2 py-2 whitespace-nowrap">MAPE</th>
                    <th className="px-2 py-2 whitespace-nowrap">Open PO</th>
                    <th className="px-2 py-2 whitespace-nowrap">Possible</th>
                    <th className="px-2 py-2 whitespace-nowrap">Qty</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">Act</th>
                  </tr>
                </thead>
                <tbody>
                  {draftGroups.map(([key, groupLines]) => (
                    <Fragment key={key}>
                      <tr className="bg-white/[0.06]">
                        <td colSpan={13} className="px-2 py-2 text-[11px] font-semibold text-foreground">
                          <span className="text-muted">Supplier group · </span>
                          {supplierGroupLabel(groupLines)}
                          <span className="ml-2 font-normal text-zinc-500">
                            ({groupLines.length} line{groupLines.length === 1 ? "" : "s"} → one PO)
                          </span>
                        </td>
                      </tr>
                      {groupLines.map((line) => (
                        <tr
                          key={line.ingredientId}
                          className={cn(
                            "border-b border-white/[0.05] align-top odd:bg-transparent even:bg-white/[0.015]",
                            line.disapproved && "opacity-45 grayscale"
                          )}
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              className="h-5 w-5 cursor-pointer accent-violet-500"
                              checked={selectedLineIds.includes(line.ingredientId)}
                              onChange={() => toggleLineSelection(line.ingredientId)}
                              disabled={Boolean(line.disapproved)}
                              aria-label={`Select ${line.name}`}
                            />
                          </td>
                          <td className="px-2 py-2 font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                            {line.internalNumber}
                          </td>
                          <td className="px-2 py-2 leading-snug text-foreground">
                            <span className="line-clamp-2">{line.name}</span>
                          </td>
                          <td
                            className="px-2 py-2 align-top text-muted"
                            title={
                              [line.vendorName, line.supplierEmail].filter(Boolean).join(" · ") || undefined
                            }
                          >
                            <span className="line-clamp-2 leading-snug">{line.vendorName ?? "—"}</span>
                          </td>
                          <td
                            className="px-1.5 py-1.5 align-top text-[10px] leading-snug text-muted"
                            title={[
                              line.orderingDaysNote,
                              line.deliveryDaysNote,
                              line.weekendsNote ? `Weekends: ${line.weekendsNote}` : "",
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          >
                            <span className="text-zinc-500">Ord:</span> {line.orderingDaysNote ?? "—"}
                            <br />
                            <span className="text-zinc-500">Del:</span> {line.deliveryDaysNote ?? "—"}
                            <br />
                            <span className="text-zinc-500">Wk:</span> {line.weekendsNote ?? "—"}
                          </td>
                          <td className="px-1.5 py-1.5 text-center font-mono tabular-nums text-muted">
                            {line.supplierLeadTimeDays ?? line.leadTimeBusinessDays}
                          </td>
                          <td className="px-1.5 py-1.5 text-center">
                            <span
                              className={cn(
                                "inline-flex rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                                line.forecastModel === "daily_short"
                                  ? "bg-emerald-500/15 text-emerald-200"
                                  : "bg-amber-500/15 text-amber-100"
                              )}
                              title={
                                line.forecastModel === "daily_short"
                                  ? "Short business-day cover (daily supplier)"
                                  : "Extended business-day cover"
                              }
                            >
                              {line.forecastModel === "daily_short" ? "Daily" : "Extended"}
                            </span>
                          </td>
                          <td className="px-1.5 py-1.5 text-muted" title="Demand over forecast window">
                            <div className="font-mono text-[10px] leading-tight">{line.forecastDemand}</div>
                            <div className="mt-0.5 font-mono text-[9px] text-zinc-500">
                              {line.forecastCoverBusinessDays ?? line.leadTimeBusinessDays} business days
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5 text-center font-mono text-[10px] text-muted">
                            {line.mapePct}
                          </td>
                          <td className="px-1.5 py-1.5 text-center font-mono text-[10px] text-muted">
                            {line.openPoQty}
                          </td>
                          <td className="px-1.5 py-1.5 text-center font-mono text-[10px] text-emerald-200/90">
                            {line.possibleQty}
                          </td>
                          <td className="px-1.5 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.approvedQty}
                              onChange={(e) => updateApprovedQty(line.ingredientId, e.target.value)}
                              className="h-7 w-full min-w-0 max-w-[5.5rem] px-1.5 font-mono text-[11px]"
                              disabled={line.disapproved}
                            />
                            <span className="mt-0.5 block text-center text-[9px] text-muted">
                              {line.inventoryUnit}
                            </span>
                          </td>
                          <td className="px-1.5 py-1.5 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-full max-w-[5.5rem] px-1 text-[10px] text-amber-200"
                                onClick={() => disapproveLine(line.ingredientId)}
                                disabled={Boolean(line.disapproved)}
                              >
                                <ThumbsDown className="mr-0.5 inline h-3 w-3" aria-hidden />
                                Drop
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {approvedLines.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Recent PO lines</CardTitle>
              <CardDescription>
                Lines tied to sent / approved / received POs (supplier portal and receiving update these).
              </CardDescription>
            </CardHeader>
          </div>
          <div className="overflow-x-auto px-2 pb-5 pt-2">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-2 py-2">PO</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Supplier</th>
                  <th className="px-2 py-2">Supervisor qty</th>
                  <th className="px-2 py-2">Supplier qty</th>
                  <th className="px-2 py-2">Sent / approved</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovedLines.map((line) => (
                  <tr
                    key={`${line.id}-${line.poNumber}`}
                    className="border-b border-white/[0.05] odd:bg-transparent even:bg-white/[0.015]"
                  >
                    <td className="px-2 py-2 font-mono text-zinc-300">{line.poNumber}</td>
                    <td className="px-2 py-2 text-muted">{line.poStatus}</td>
                    <td className="px-2 py-2">
                      <span className="font-medium text-foreground">{line.name}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-zinc-500">
                        {line.internalNumber}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted">{line.supplierName ?? line.vendorName ?? "—"}</td>
                    <td className="px-2 py-2 font-mono tabular-nums text-foreground">
                      {line.approvedQty} <span className="text-muted">{line.inventoryUnit}</span>
                    </td>
                    <td className="px-2 py-2 font-mono tabular-nums text-muted">
                      {line.supplierConfirmedQty ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-muted">
                      <div>Sent {line.sentAt ? new Date(line.sentAt).toLocaleString() : "—"}</div>
                      <div className="mt-0.5">
                        Supplier{" "}
                        {line.supplierApprovedAt
                          ? new Date(line.supplierApprovedAt).toLocaleString()
                          : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
