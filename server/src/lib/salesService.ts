import { prisma } from "../prisma.js";
import { consumptionAmount } from "./units.js";
import { Decimal } from "@prisma/client/runtime/library";

export async function recordSale(menuItemId: string, quantity: number) {
  if (quantity < 1 || !Number.isFinite(quantity)) {
    throw new Error("quantity must be a positive integer");
  }

  const lines = await prisma.recipeLine.findMany({
    where: { menuItemId },
    include: { ingredient: true },
  });

  if (lines.length === 0) {
    throw new Error("Menu item has no recipe");
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesEntry.create({
      data: { menuItemId, quantity },
    });

    for (const line of lines) {
      const use = consumptionAmount(
        quantity,
        line.amount,
        line.unit,
        line.ingredient.inventoryUnit
      );
      const next = line.ingredient.onHand.sub(use);
      if (next.lt(0)) {
        throw new Error(
          `Insufficient stock for ${line.ingredient.name}. Need ${use.toFixed(3)}, have ${line.ingredient.onHand.toString()}.`
        );
      }
      await tx.ingredient.update({
        where: { id: line.ingredientId },
        data: { onHand: next },
      });
    }
  });

  return { ok: true };
}
