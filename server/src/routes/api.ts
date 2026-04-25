import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { recordSale } from "../lib/salesService.js";
import { buildPoSuggestions } from "../lib/suggestions.js";
import { Decimal } from "@prisma/client/runtime/library";
import { sendApprovedPoEmail } from "../lib/mailer.js";

export const apiRouter = Router();

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("does not exist") || error.message.includes("P2021");
}

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ai-restaurant-api" });
});

apiRouter.get("/menu-items", async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      colorHex: true,
    },
  });
  res.json(items);
});

apiRouter.get("/ingredients", async (_req, res) => {
  const rows = await prisma.ingredient.findMany({
    orderBy: { internalNumber: "asc" },
  });
  res.json(rows);
});

const patchIng = z.object({
  onHand: z.number().nonnegative(),
});

const createIng = z.object({
  internalNumber: z.string().min(1),
  name: z.string().min(1),
  class: z.string().min(1),
  type: z.string().min(1).default("Food"),
  parLevel: z.number().nonnegative(),
  onHand: z.number().nonnegative(),
  inventoryUnit: z.enum(["KG", "EACH"]),
  vendorName: z.string().nullable().optional(),
  supplierSku: z.string().nullable().optional(),
  minOrder: z.number().nonnegative().nullable().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
  orderPackAmount: z.number().nonnegative().nullable().optional(),
  orderPackLabel: z.string().nullable().optional(),
});

apiRouter.post("/ingredients", async (req, res) => {
  const parsed = createIng.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const d = parsed.data;
    const created = await prisma.ingredient.create({
      data: {
        internalNumber: d.internalNumber.trim(),
        name: d.name.trim(),
        class: d.class.trim(),
        type: d.type,
        parLevel: new Decimal(d.parLevel),
        onHand: new Decimal(d.onHand),
        inventoryUnit: d.inventoryUnit,
        vendorName: d.vendorName?.trim() || null,
        supplierSku: d.supplierSku?.trim() || null,
        minOrder: d.minOrder == null ? null : new Decimal(d.minOrder),
        unitCost: d.unitCost == null ? null : new Decimal(d.unitCost),
        orderPackAmount:
          d.orderPackAmount == null ? null : new Decimal(d.orderPackAmount),
        orderPackLabel: d.orderPackLabel?.trim() || null,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes("Unique constraint")
        ? "SKU already exists"
        : "Failed to create ingredient";
    res.status(400).json({ error: msg });
  }
});

apiRouter.patch("/ingredients/:id", async (req, res) => {
  const parsed = patchIng.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await prisma.ingredient.update({
      where: { id: req.params.id },
      data: { onHand: new Decimal(parsed.data.onHand) },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

const saleBody = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

apiRouter.post("/sales", async (req, res) => {
  const parsed = saleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    await recordSale(parsed.data.menuItemId, parsed.data.quantity);
    res.status(201).json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    res.status(400).json({ error: msg });
  }
});

apiRouter.get("/sales", async (_req, res) => {
  const rows = await prisma.salesEntry.findMany({
    orderBy: { soldAt: "desc" },
    take: 100,
    include: { menuItem: { select: { code: true, name: true, colorHex: true } } },
  });
  res.json(rows);
});

apiRouter.get("/recipes", async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      recipe: {
        include: { ingredient: { select: { name: true, internalNumber: true } } },
      },
    },
  });
  res.json(items);
});

apiRouter.get("/suggestions/po", async (_req, res) => {
  const data = await buildPoSuggestions();
  res.json(data);
});

const approvePoBody = z.object({
  lines: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        name: z.string().min(1),
        internalNumber: z.string().min(1),
        inventoryUnit: z.string().min(1),
        suggestedQty: z.number().nonnegative(),
        approvedQty: z.number().nonnegative(),
        unitCost: z.number().nonnegative().nullable(),
        vendorName: z.string().nullable(),
      })
    )
    .min(1),
});

apiRouter.post("/suggestions/po/approve", async (req, res) => {
  const parsed = approvePoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const totalEstimated = parsed.data.lines.reduce((sum, line) => {
    if (line.unitCost == null) return sum;
    return sum + line.approvedQty * line.unitCost;
  }, 0);

  const vendorCount = new Set(
    parsed.data.lines.map((l) => l.vendorName).filter((v): v is string => Boolean(v))
  ).size;

  const poNumber = `PO-${Date.now().toString().slice(-6)}`;
  const approvedAt = new Date().toISOString();
  const approvedLines = parsed.data.lines.filter((line) => line.approvedQty > 0);
  let lineCount = approvedLines.length;
  try {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        approvedAt,
        status: "APPROVED",
        lines: {
          create: approvedLines.map((line) => ({
              ingredientId: line.ingredientId,
              name: line.name,
              internalNumber: line.internalNumber,
              vendorName: line.vendorName,
              inventoryUnit: line.inventoryUnit === "KG" ? "KG" : "EACH",
              suggestedQty: new Decimal(line.suggestedQty),
              approvedQty: new Decimal(line.approvedQty),
              unitCost: line.unitCost == null ? null : new Decimal(line.unitCost),
            })),
        },
      },
      include: { lines: true },
    });
    lineCount = po.lines.length;
  } catch (error) {
    // Backward compatibility before PO table migration is applied.
    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  const emailResult = await sendApprovedPoEmail({
    poNumber,
    approvedAtIso: approvedAt,
    totalEstimated,
    lines: approvedLines.map((line) => ({
      sku: line.internalNumber,
      name: line.name,
      vendorName: line.vendorName,
      qty: line.approvedQty,
      unit: line.inventoryUnit,
      unitCost: line.unitCost,
    })),
  });

  res.status(201).json({
    poNumber,
    approvedAt,
    lineCount,
    vendorCount,
    totalEstimated: totalEstimated.toFixed(2),
    status: "approved_for_supplier",
    email: {
      sent: emailResult.sent,
      to: emailResult.to,
      mode: emailResult.mode,
      error: emailResult.error ?? null,
    },
  });
});

apiRouter.get("/suggestions/po/approved", async (_req, res) => {
  try {
    const rows = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: "APPROVED" } },
      include: {
        purchaseOrder: {
          select: { poNumber: true, approvedAt: true },
        },
      },
      orderBy: [{ purchaseOrder: { approvedAt: "desc" } }, { createdAt: "desc" }],
    });
    res.json(
      rows.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        name: line.name,
        internalNumber: line.internalNumber,
        vendorName: line.vendorName,
        inventoryUnit: line.inventoryUnit,
        suggestedQty: line.suggestedQty.toString(),
        approvedQty: line.approvedQty.toString(),
        unitCost: line.unitCost?.toString() ?? null,
        poNumber: line.purchaseOrder.poNumber,
        approvedAt: line.purchaseOrder.approvedAt.toISOString(),
      }))
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      res.json([]);
      return;
    }
    throw error;
  }
});

apiRouter.get("/dashboard", async (_req, res) => {
  // Run both queries in parallel — sequential doubles RTT to Supabase (often 100–400ms each hop).
  const [[counts], preview] = await Promise.all([
    prisma.$queryRaw<
      [
        {
          ingredients: bigint;
          below_par: bigint;
          sales: bigint;
          menus: bigint;
        },
      ]
    >`
      SELECT
        (SELECT COUNT(*)::bigint FROM "Ingredient") AS ingredients,
        (SELECT COUNT(*)::bigint FROM "Ingredient" WHERE "onHand" < "parLevel") AS below_par,
        (SELECT COUNT(*)::bigint FROM "SalesEntry") AS sales,
        (SELECT COUNT(*)::bigint FROM "MenuItem") AS menus
    `,
    prisma.$queryRaw<
      { id: string; name: string; onHand: unknown; parLevel: unknown }[]
    >`
      SELECT id, name, "onHand", "parLevel"
      FROM "Ingredient"
      WHERE "onHand" < "parLevel"
      ORDER BY name ASC
      LIMIT 8
    `,
  ]);

  res.json({
    stats: {
      ingredients: Number(counts.ingredients),
      belowPar: Number(counts.below_par),
      salesEntries: Number(counts.sales),
      menuItems: Number(counts.menus),
    },
    belowParPreview: preview.map((i) => ({
      id: i.id,
      name: i.name,
      onHand: String(i.onHand),
      parLevel: String(i.parLevel),
    })),
  });
});
