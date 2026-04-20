import jsPDF from "jspdf";

export type PoPdfLine = {
  sku: string;
  ingredient: string;
  vendor: string | null;
  suggestedQty: string;
  approvedQty: string;
  unit: string;
  unitCost: string | null;
};

type BuildPoPdfParams = {
  poNumber: string;
  approvedAt?: string;
  lines: PoPdfLine[];
  title?: string;
};

export function downloadPoPdf(params: BuildPoPdfParams): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(params.title ?? "Purchase Order", left, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`PO Number: ${params.poNumber}`, left, y);
  y += 14;
  doc.text(
    `Generated: ${params.approvedAt ?? new Date().toLocaleString()}`,
    left,
    y
  );
  y += 18;

  doc.setDrawColor(90, 90, 90);
  doc.line(left, y, 555, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.text("SKU", left, y);
  doc.text("Ingredient", 110, y);
  doc.text("Vendor", 255, y);
  doc.text("Qty", 375, y);
  doc.text("Unit", 425, y);
  doc.text("Unit Cost", 470, y);
  y += 10;
  doc.line(left, y, 555, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  const pageBottom = 790;
  let totalEstimated = 0;

  for (const line of params.lines) {
    if (y > pageBottom) {
      doc.addPage();
      y = 48;
    }

    const qty = Number(line.approvedQty);
    const unitCost = line.unitCost == null ? NaN : Number(line.unitCost);
    if (Number.isFinite(qty) && Number.isFinite(unitCost)) {
      totalEstimated += qty * unitCost;
    }

    doc.text(line.sku, left, y);
    doc.text(line.ingredient.slice(0, 24), 110, y);
    doc.text((line.vendor ?? "-").slice(0, 18), 255, y);
    doc.text(line.approvedQty, 375, y);
    doc.text(line.unit, 425, y);
    doc.text(line.unitCost ?? "-", 470, y);
    y += 14;
  }

  y += 10;
  if (y > pageBottom) {
    doc.addPage();
    y = 48;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Estimated Total: ${totalEstimated.toFixed(2)}`, left, y);

  const filenameSafe = params.poNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  doc.save(`${filenameSafe}.pdf`);
}
