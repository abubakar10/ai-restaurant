import { InventoryUnit, RecipeUnit } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/** Consumption of one ingredient for `saleQty` menu items sold */
export function consumptionAmount(
  saleQty: number,
  amount: Decimal,
  recipeUnit: RecipeUnit,
  inventoryUnit: InventoryUnit
): Decimal {
  const a = amount.toNumber();
  let consumed = 0;
  switch (recipeUnit) {
    case "GRAM":
      if (inventoryUnit === "KG") consumed = (a * saleQty) / 1000;
      else consumed = a * saleQty;
      break;
    case "KG":
      consumed = a * saleQty;
      break;
    case "EACH":
      consumed = a * saleQty;
      break;
    default:
      consumed = a * saleQty;
  }
  return new Decimal(Math.max(0, consumed));
}
