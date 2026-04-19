import { PrismaClient, InventoryUnit, RecipeUnit } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.salesEntry.deleteMany();
  await prisma.recipeLine.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.location.deleteMany();

  await prisma.location.create({
    data: { id: "loc-1", name: "CDM Restaurant (Phase 1)" },
  });

  const m001 = await prisma.menuItem.create({
    data: {
      code: "M001",
      name: "Bagel w/ Cream Cheese & Salmon",
      colorHex: "#f97316",
      sortOrder: 1,
    },
  });
  const m002 = await prisma.menuItem.create({
    data: {
      code: "M002",
      name: "Croissant w/ Pistachio Cream",
      colorHex: "#3b82f6",
      sortOrder: 2,
    },
  });
  const m003 = await prisma.menuItem.create({
    data: {
      code: "M003",
      name: "Croissant w/ Egg, Bacon & Avocado",
      colorHex: "#ec4899",
      sortOrder: 3,
    },
  });
  const m004 = await prisma.menuItem.create({
    data: {
      code: "M004",
      name: "Croissant w/ Ham & Gouda",
      colorHex: "#d97706",
      sortOrder: 4,
    },
  });
  const m005 = await prisma.menuItem.create({
    data: {
      code: "M005",
      name: "Croissant w/ Egg, Bacon & Gouda",
      colorHex: "#22c55e",
      sortOrder: 5,
    },
  });

  const ing = async (data: {
    internalNumber: string;
    name: string;
    class: string;
    parLevel: number;
    onHand: number;
    inventoryUnit: InventoryUnit;
    vendorName?: string;
    supplierSku?: string;
    minOrder?: number;
    unitCost?: number;
    orderPackAmount?: number;
    orderPackLabel?: string;
  }) =>
    prisma.ingredient.create({
      data: {
        internalNumber: data.internalNumber,
        name: data.name,
        class: data.class,
        parLevel: data.parLevel,
        onHand: data.onHand,
        inventoryUnit: data.inventoryUnit,
        vendorName: data.vendorName,
        supplierSku: data.supplierSku,
        minOrder: data.minOrder ?? null,
        unitCost: data.unitCost ?? null,
        orderPackAmount: data.orderPackAmount ?? null,
        orderPackLabel: data.orderPackLabel ?? null,
      },
    });

  const bagel = await ing({
    internalNumber: "1001",
    name: "Plain Bagel 120g",
    class: "Bakery",
    parLevel: 180,
    onHand: 140,
    inventoryUnit: InventoryUnit.EACH,
    vendorName: "Santos Production",
    supplierSku: "BAG-120-CBS",
    minOrder: 100,
    unitCost: 0.85,
    orderPackAmount: 1,
    orderPackLabel: "each",
  });
  const croissant = await ing({
    internalNumber: "1002",
    name: "Butter Croissant 80g",
    class: "Bakery",
    parLevel: 250,
    onHand: 210,
    inventoryUnit: InventoryUnit.EACH,
    vendorName: "Santos Production",
    supplierSku: "CRO-80-CBS",
    minOrder: 120,
    unitCost: 0.85,
    orderPackAmount: 1,
    orderPackLabel: "each",
  });
  const creamCheese = await ing({
    internalNumber: "2001",
    name: "Cream Cheese Block 2kg",
    class: "Dairy",
    parLevel: 12,
    onHand: 8,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Island Dairy Co",
    supplierSku: "CC-2KG-IDC",
    minOrder: 2,
    unitCost: 18,
    orderPackAmount: 2,
    orderPackLabel: "kg per pack",
  });
  const salmon = await ing({
    internalNumber: "3001",
    name: "Smoked Salmon Fillet",
    class: "Seafood",
    parLevel: 10,
    onHand: 6,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Fresh Ocean Seafood",
    supplierSku: "SAL-ATL-FOC",
    minOrder: 1,
    unitCost: 42,
    orderPackAmount: 1,
    orderPackLabel: "kg",
  });
  const capers = await ing({
    internalNumber: "4001",
    name: "Capers Jar 1kg",
    class: "Pantry",
    parLevel: 2,
    onHand: 1.2,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Global Food Supply",
    supplierSku: "CAP-1KG-GFS",
    minOrder: 2,
    unitCost: 9.5,
    orderPackAmount: 1,
    orderPackLabel: "kg",
  });
  const pistachioCream = await ing({
    internalNumber: "5001",
    name: "Pistachio Cream 3kg Tub",
    class: "Bakery",
    parLevel: 5,
    onHand: 5,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Global Food Supply",
    supplierSku: "PST-3KG-GFS",
    minOrder: 1,
    unitCost: 36,
    orderPackAmount: 3,
    orderPackLabel: "kg per tub",
  });
  const powderedSugar = await ing({
    internalNumber: "4002",
    name: "Powdered Sugar 2kg",
    class: "Pantry",
    parLevel: 3,
    onHand: 3,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Global Food Supply",
    supplierSku: "SUG-2KG-GFS",
    minOrder: 2,
    unitCost: 6,
    orderPackAmount: 2,
    orderPackLabel: "kg per bag",
  });
  const choppedPistachio = await ing({
    internalNumber: "4003",
    name: "Chopped Pistachio 1kg",
    class: "Pantry",
    parLevel: 2,
    onHand: 2,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Global Food Supply",
    supplierSku: "PST-1KG-GFS",
    minOrder: 2,
    unitCost: 28,
    orderPackAmount: 1,
    orderPackLabel: "kg",
  });
  const bacon = await ing({
    internalNumber: "6001",
    name: "Bacon Strip Pack 5kg",
    class: "Meat",
    parLevel: 12,
    onHand: 9,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Island Dairy Co",
    supplierSku: "BAC-5KG-IDC",
    minOrder: 1,
    unitCost: 55,
    orderPackAmount: 5,
    orderPackLabel: "kg per pack",
  });
  const egg = await ing({
    internalNumber: "2002",
    name: "Premade Egg Patty (60ct case)",
    class: "Dairy",
    parLevel: 120,
    onHand: 120,
    inventoryUnit: InventoryUnit.EACH,
    vendorName: "Island Dairy Co",
    supplierSku: "EGG-PREM-IDC",
    minOrder: 1,
    unitCost: 48,
    orderPackAmount: 60,
    orderPackLabel: "units per case",
  });
  const avocado = await ing({
    internalNumber: "7001",
    name: "Fresh Avocado Box 5kg",
    class: "Produce",
    parLevel: 20,
    onHand: 7,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Tropic Produce Farms",
    supplierSku: "AVO-BOX-TPF",
    minOrder: 1,
    unitCost: 20,
    orderPackAmount: 5,
    orderPackLabel: "kg per box",
  });
  const ham = await ing({
    internalNumber: "6002",
    name: "Sliced Ham 2kg",
    class: "Meat",
    parLevel: 6,
    onHand: 6,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Island Dairy Co",
    supplierSku: "HAM-2KG-IDC",
    minOrder: 2,
    unitCost: 24,
    orderPackAmount: 2,
    orderPackLabel: "kg per pack",
  });
  const gouda = await ing({
    internalNumber: "2003",
    name: "Gouda Cheese Block 3kg",
    class: "Dairy",
    parLevel: 15,
    onHand: 10,
    inventoryUnit: InventoryUnit.KG,
    vendorName: "Island Dairy Co",
    supplierSku: "GOU-3KG-IDC",
    minOrder: 2,
    unitCost: 31,
    orderPackAmount: 3,
    orderPackLabel: "kg per block",
  });

  const R = RecipeUnit;
  const lines: { menuId: string; ingredientId: string; amount: number; unit: RecipeUnit }[] = [
    { menuId: m001.id, ingredientId: bagel.id, amount: 1, unit: R.EACH },
    { menuId: m001.id, ingredientId: creamCheese.id, amount: 57, unit: R.GRAM },
    { menuId: m001.id, ingredientId: salmon.id, amount: 92, unit: R.GRAM },
    { menuId: m001.id, ingredientId: capers.id, amount: 20, unit: R.GRAM },
    { menuId: m002.id, ingredientId: croissant.id, amount: 1, unit: R.EACH },
    { menuId: m002.id, ingredientId: pistachioCream.id, amount: 90, unit: R.GRAM },
    { menuId: m002.id, ingredientId: powderedSugar.id, amount: 5, unit: R.GRAM },
    { menuId: m002.id, ingredientId: choppedPistachio.id, amount: 10, unit: R.GRAM },
    { menuId: m003.id, ingredientId: croissant.id, amount: 1, unit: R.EACH },
    { menuId: m003.id, ingredientId: bacon.id, amount: 50, unit: R.GRAM },
    { menuId: m003.id, ingredientId: egg.id, amount: 1, unit: R.EACH },
    { menuId: m003.id, ingredientId: avocado.id, amount: 58, unit: R.GRAM },
    { menuId: m004.id, ingredientId: croissant.id, amount: 1, unit: R.EACH },
    { menuId: m004.id, ingredientId: ham.id, amount: 52, unit: R.GRAM },
    { menuId: m004.id, ingredientId: gouda.id, amount: 52, unit: R.GRAM },
    { menuId: m005.id, ingredientId: croissant.id, amount: 1, unit: R.EACH },
    { menuId: m005.id, ingredientId: bacon.id, amount: 50, unit: R.GRAM },
    { menuId: m005.id, ingredientId: egg.id, amount: 1, unit: R.EACH },
    { menuId: m005.id, ingredientId: gouda.id, amount: 50, unit: R.GRAM },
  ];

  await prisma.recipeLine.createMany({
    data: lines.map((l) => ({
      menuItemId: l.menuId,
      ingredientId: l.ingredientId,
      amount: l.amount,
      unit: l.unit,
    })),
  });

  console.log("Seed complete: menu, ingredients, recipes.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
