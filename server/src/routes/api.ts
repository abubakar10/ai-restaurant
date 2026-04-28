import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { recordSale } from "../lib/salesService.js";
import { buildPoSuggestions } from "../lib/suggestions.js";
import { Decimal } from "@prisma/client/runtime/library";
import {
  resolveSupplierPoRecipients,
  sendSupplierPoEmail,
} from "../lib/mailer.js";

export const apiRouter = Router();

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("does not exist") || error.message.includes("P2021");
}

function clientWebOrigin(): string {
  const raw = process.env.CLIENT_ORIGIN?.trim()?.split(",")[0]?.replace(/\/$/, "");
  return raw || "http://localhost:5173";
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

apiRouter.get("/suppliers", async (_req, res) => {
  try {
    const rows = await prisma.supplier.findMany({
      orderBy: { code: "asc" },
    });
    res.json(rows);
  } catch (error) {
    if (isMissingTableError(error)) {
      res.json([]);
      return;
    }
    throw error;
  }
});

apiRouter.get("/item-masters", async (_req, res) => {
  try {
    const rows = await prisma.itemMaster.findMany({
      orderBy: { itemId: "asc" },
    });
    res.json(rows);
  } catch (error) {
    if (isMissingTableError(error)) {
      res.json([]);
      return;
    }
    throw error;
  }
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

  const approvedLines = parsed.data.lines.filter((line) => line.approvedQty > 0);
  if (approvedLines.length === 0) {
    res.status(400).json({ error: "At least one line needs approved quantity > 0" });
    return;
  }

  const ingredientIds = [...new Set(approvedLines.map((l) => l.ingredientId))];
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, supplierId: true },
  });
  const supplierIdByIngredient = new Map(
    ingredients.map((i) => [i.id, i.supplierId] as const)
  );

  const groups = new Map<string, typeof approvedLines>();
  for (const line of approvedLines) {
    const sid = supplierIdByIngredient.get(line.ingredientId) ?? null;
    const key = sid ?? "__none__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(line);
  }

  const supplierIds = [...groups.keys()].filter((k) => k !== "__none__");
  const suppliers =
    supplierIds.length > 0
      ? await prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
        })
      : [];
  const supplierById = new Map(suppliers.map((s) => [s.id, s] as const));

  const baseStamp = Date.now();
  let groupIndex = 0;
  const posOut: {
    poNumber: string;
    approvedAt: string;
    lineCount: number;
    supplierName: string | null;
    supplierCode: string | null;
    portalUrl: string;
    email: { sent: boolean; to: string; mode: "smtp" | "simulated"; error?: string | null };
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
  }[] = [];

  try {
    for (const [supplierKey, lines] of groups) {
      groupIndex += 1;
      const poNumber = `PO-${baseStamp}-${groupIndex}`;
      const token = randomUUID();
      const approvedAtDate = new Date();
      const supplierId = supplierKey === "__none__" ? null : supplierKey;
      const supplier = supplierId ? supplierById.get(supplierId) ?? null : null;

      const totalEstimated = lines.reduce((sum, line) => {
        if (line.unitCost == null) return sum;
        return sum + line.approvedQty * line.unitCost;
      }, 0);

      await prisma.purchaseOrder.create({
        data: {
          poNumber,
          approvedAt: approvedAtDate,
          sentAt: approvedAtDate,
          status: "SENT_TO_SUPPLIER",
          supplierPortalToken: token,
          supplierId,
          lines: {
            create: lines.map((line) => ({
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
      });

      const portalUrl = `${clientWebOrigin()}/po/supplier/${token}`;
      const recipients = resolveSupplierPoRecipients({
        supplierCode: supplier?.code ?? null,
        supplierName: supplier?.name ?? "Supplier",
        contactEmail: supplier?.contactEmail ?? null,
      });

      const emailResult = await sendSupplierPoEmail({
        poNumber,
        supplierName: supplier?.name ?? "Supplier",
        supplierCode: supplier?.code ?? null,
        approvedAtIso: approvedAtDate.toISOString(),
        totalEstimated,
        portalUrl,
        to: recipients,
        lines: lines.map((line) => ({
          sku: line.internalNumber,
          name: line.name,
          vendorName: line.vendorName,
          qty: line.approvedQty,
          unit: line.inventoryUnit,
          unitCost: line.unitCost,
        })),
      });

      posOut.push({
        poNumber,
        approvedAt: approvedAtDate.toISOString(),
        lineCount: lines.length,
        supplierName: supplier?.name ?? null,
        supplierCode: supplier?.code ?? null,
        portalUrl,
        email: {
          sent: emailResult.sent,
          to: emailResult.to,
          mode: emailResult.mode,
          error: emailResult.error ?? null,
        },
        totalEstimated: totalEstimated.toFixed(2),
        pdfLines: lines.map((line) => ({
          sku: line.internalNumber,
          ingredient: line.name,
          vendor: line.vendorName ?? null,
          suggestedQty: String(line.suggestedQty),
          approvedQty: String(line.approvedQty),
          unit: line.inventoryUnit,
          unitCost: line.unitCost == null ? null : String(line.unitCost),
        })),
      });
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
    res.status(503).json({ error: "Purchase order storage not available (run db push)." });
    return;
  }

  const first = posOut[0];
  res.status(201).json({
    pos: posOut,
    poCount: posOut.length,
    lineCount: approvedLines.length,
    vendorCount: groups.size,
    poNumber: first?.poNumber,
    approvedAt: first?.approvedAt,
    totalEstimated: posOut.reduce((s, p) => s + Number.parseFloat(p.totalEstimated), 0).toFixed(2),
    status: "sent_to_suppliers",
  });
});

apiRouter.get("/suggestions/po/approved", async (_req, res) => {
  try {
    const rows = await prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          status: {
            in: [
              "APPROVED",
              "SENT_TO_SUPPLIER",
              "SUPPLIER_APPROVED",
              "RECEIVED",
              "SUPPLIER_DECLINED",
            ],
          },
        },
      },
      include: {
        purchaseOrder: {
          select: {
            poNumber: true,
            approvedAt: true,
            sentAt: true,
            status: true,
            supplierApprovedAt: true,
            supplierDeclinedAt: true,
            supplierPoNote: true,
            supplier: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: [{ purchaseOrder: { approvedAt: "desc" } }, { createdAt: "desc" }],
      take: 300,
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
        supplierConfirmedQty: line.supplierConfirmedQty?.toString() ?? null,
        supplierLineNote: line.supplierLineNote,
        receivedQty: line.receivedQty?.toString() ?? null,
        receivingNote: line.receivingNote,
        unitCost: line.unitCost?.toString() ?? null,
        poNumber: line.purchaseOrder.poNumber,
        poStatus: line.purchaseOrder.status,
        approvedAt: line.purchaseOrder.approvedAt.toISOString(),
        sentAt: line.purchaseOrder.sentAt?.toISOString() ?? null,
        supplierApprovedAt: line.purchaseOrder.supplierApprovedAt?.toISOString() ?? null,
        supplierDeclinedAt: line.purchaseOrder.supplierDeclinedAt?.toISOString() ?? null,
        supplierPoNote: line.purchaseOrder.supplierPoNote,
        supplierCode: line.purchaseOrder.supplier?.code ?? null,
        supplierName: line.purchaseOrder.supplier?.name ?? null,
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

apiRouter.get("/purchase-orders", async (_req, res) => {
  try {
    const rows = await prisma.purchaseOrder.findMany({
      orderBy: { approvedAt: "desc" },
      take: 120,
      include: {
        supplier: { select: { code: true, name: true, contactEmail: true } },
        lines: {
          select: {
            id: true,
            name: true,
            internalNumber: true,
            suggestedQty: true,
            approvedQty: true,
            supplierConfirmedQty: true,
            supplierLineNote: true,
            receivedQty: true,
            receivingNote: true,
            inventoryUnit: true,
          },
        },
      },
    });
    res.json(
      rows.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        status: po.status,
        approvedAt: po.approvedAt.toISOString(),
        sentAt: po.sentAt?.toISOString() ?? null,
        supplierApprovedAt: po.supplierApprovedAt?.toISOString() ?? null,
        supplierDeclinedAt: po.supplierDeclinedAt?.toISOString() ?? null,
        supplierPoNote: po.supplierPoNote,
        supplier: po.supplier,
        lineCount: po.lines.length,
        lines: po.lines.map((l) => ({
          id: l.id,
          name: l.name,
          internalNumber: l.internalNumber,
          suggestedQty: l.suggestedQty.toString(),
          approvedQty: l.approvedQty.toString(),
          supplierConfirmedQty: l.supplierConfirmedQty?.toString() ?? null,
          supplierLineNote: l.supplierLineNote,
          receivedQty: l.receivedQty?.toString() ?? null,
          receivingNote: l.receivingNote,
          inventoryUnit: l.inventoryUnit,
        })),
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

const receiveBody = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        receivedQty: z.number().nonnegative(),
        receivingNote: z.string().max(2000).optional(),
      })
    )
    .min(1),
});

apiRouter.post("/purchase-orders/:id/receive", async (req, res) => {
  const parsed = receiveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const poId = req.params.id;
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true },
    });
    if (!po) {
      res.status(404).json({ error: "PO not found" });
      return;
    }
    if (po.status === "RECEIVED" || po.status === "CANCELLED") {
      res.status(400).json({ error: "PO cannot be received in this state" });
      return;
    }
    if (po.status === "SUPPLIER_DECLINED") {
      res.status(400).json({ error: "Declined PO cannot be received" });
      return;
    }

    const lineIds = new Set(po.lines.map((l) => l.id));
    for (const l of parsed.data.lines) {
      if (!lineIds.has(l.lineId)) {
        res.status(400).json({ error: "Unknown line on this PO" });
        return;
      }
    }
    if (parsed.data.lines.length !== po.lines.length) {
      res.status(400).json({ error: "Provide received quantities for every line on the PO" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const upd of parsed.data.lines) {
        const line = po.lines.find((x) => x.id === upd.lineId)!;
        await tx.purchaseOrderLine.update({
          where: { id: upd.lineId },
          data: {
            receivedQty: new Decimal(upd.receivedQty),
            receivingNote: upd.receivingNote?.trim() || null,
          },
        });
        const ing = await tx.ingredient.findUnique({
          where: { id: line.ingredientId },
          select: { onHand: true },
        });
        if (ing) {
          await tx.ingredient.update({
            where: { id: line.ingredientId },
            data: { onHand: ing.onHand.add(new Decimal(upd.receivedQty)) },
          });
        }
      }
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: "RECEIVED" },
      });
    });

    res.json({ ok: true, status: "RECEIVED" });
  } catch (error) {
    if (isMissingTableError(error)) {
      res.status(503).json({ error: "Database schema out of date" });
      return;
    }
    throw error;
  }
});

const supplierSubmitBody = z.object({
  action: z.enum(["approve", "decline"]),
  poNote: z.string().max(4000).optional(),
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        supplierConfirmedQty: z.number().nonnegative(),
        supplierLineNote: z.string().max(2000).optional(),
      })
    )
    .optional(),
});

apiRouter.get("/public/po/:token", async (req, res) => {
  const token = req.params.token;
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { supplierPortalToken: token },
      include: {
        supplier: { select: { code: true, name: true } },
        lines: { orderBy: { internalNumber: "asc" } },
      },
    });
    if (!po) {
      res.status(404).json({ error: "Invalid or expired link" });
      return;
    }
    res.json({
      poNumber: po.poNumber,
      status: po.status,
      supplierName: po.supplier?.name ?? null,
      supplierCode: po.supplier?.code ?? null,
      approvedAt: po.approvedAt.toISOString(),
      sentAt: po.sentAt?.toISOString() ?? null,
      supplierApprovedAt: po.supplierApprovedAt?.toISOString() ?? null,
      supplierDeclinedAt: po.supplierDeclinedAt?.toISOString() ?? null,
      supplierPoNote: po.supplierPoNote,
      lines: po.lines.map((l) => ({
        id: l.id,
        name: l.name,
        internalNumber: l.internalNumber,
        inventoryUnit: l.inventoryUnit,
        suggestedQty: l.suggestedQty.toString(),
        approvedQty: l.approvedQty.toString(),
        supplierConfirmedQty: l.supplierConfirmedQty?.toString() ?? null,
        supplierLineNote: l.supplierLineNote,
        readOnly: po.status !== "SENT_TO_SUPPLIER",
      })),
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      res.status(503).json({ error: "Unavailable" });
      return;
    }
    throw error;
  }
});

apiRouter.post("/public/po/:token/submit", async (req, res) => {
  const parsed = supplierSubmitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const token = req.params.token;
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { supplierPortalToken: token },
      include: { lines: true },
    });
    if (!po) {
      res.status(404).json({ error: "Invalid or expired link" });
      return;
    }
    if (po.status !== "SENT_TO_SUPPLIER") {
      res.status(400).json({ error: "This PO is no longer open for supplier edits" });
      return;
    }

    const now = new Date();
    if (parsed.data.action === "decline") {
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: "SUPPLIER_DECLINED",
          supplierDeclinedAt: now,
          supplierPoNote: parsed.data.poNote?.trim() || null,
        },
      });
      res.json({ ok: true, status: "SUPPLIER_DECLINED" });
      return;
    }

    const linePayload = parsed.data.lines ?? [];
    if (linePayload.length !== po.lines.length) {
      res.status(400).json({ error: "Submit a row for every line on the PO" });
      return;
    }
    const ids = new Set(po.lines.map((l) => l.id));
    for (const row of linePayload) {
      if (!ids.has(row.lineId)) {
        res.status(400).json({ error: "Unknown line id" });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const row of linePayload) {
        await tx.purchaseOrderLine.update({
          where: { id: row.lineId },
          data: {
            supplierConfirmedQty: new Decimal(row.supplierConfirmedQty),
            supplierLineNote: row.supplierLineNote?.trim() || null,
          },
        });
      }
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: "SUPPLIER_APPROVED",
          supplierApprovedAt: now,
          supplierPoNote: parsed.data.poNote?.trim() || null,
        },
      });
    });

    res.json({ ok: true, status: "SUPPLIER_APPROVED" });
  } catch (error) {
    if (isMissingTableError(error)) {
      res.status(503).json({ error: "Unavailable" });
      return;
    }
    throw error;
  }
});

apiRouter.get("/dashboard", async (_req, res) => {
  const [[counts], preview] = await Promise.all([
    prisma.$queryRaw<
      [
        {
          ingredients: bigint;
          menus: bigint;
          approvedPoCount: bigint;
        },
      ]
    >`
      SELECT
        (SELECT COUNT(*)::bigint FROM "Ingredient") AS ingredients,
        (SELECT COUNT(*)::bigint FROM "MenuItem") AS menus,
        (
          SELECT COUNT(*)::bigint
          FROM "PurchaseOrder"
          WHERE status IN ('SENT_TO_SUPPLIER', 'SUPPLIER_APPROVED', 'APPROVED')
        ) AS "approvedPoCount"
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
      menuItems: Number(counts.menus),
      approvedPoCount: Number(counts.approvedPoCount),
    },
    belowParPreview: preview.map((i) => ({
      id: i.id,
      name: i.name,
      onHand: String(i.onHand),
      parLevel: String(i.parLevel),
    })),
  });
});
