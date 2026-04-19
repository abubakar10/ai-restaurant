import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { recordSale } from "../lib/salesService.js";
import { buildPoSuggestions } from "../lib/suggestions.js";
import { Decimal } from "@prisma/client/runtime/library";

export const apiRouter = Router();

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
