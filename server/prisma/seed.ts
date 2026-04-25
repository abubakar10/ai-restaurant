import {
  PrismaClient,
  InventoryUnit,
  RecipeUnit,
  SupplierKind,
} from "@prisma/client";

const prisma = new PrismaClient();

async function assertSchemaApplied() {
  const rows = await prisma.$queryRaw<{ has_supplier: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'Supplier'
    ) AS has_supplier
  `;
  if (!rows[0]?.has_supplier) {
    console.error(`
[seed] The "Supplier" table is missing (schema not applied to this database).

  1) From the repo root run:
       npm run db:push

  2) If db:push fails with P1001 on db.*.supabase.co:5432, your PC/network often blocks port 5432.
     Supabase can still look "Healthy" in the dashboard — that only means the server is up, not
     that your machine can reach :5432.

     Fix: In server/.env set DIRECT_URL to the SAME "Session pooler" connection string as
     DATABASE_URL (Supabase → Connect → ORMs → Prisma, port 6543), save, then:
       npm run db:push
     Then:
       npm run db:seed
`);
    process.exit(1);
  }
}

async function main() {
  await assertSchemaApplied();

  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.salesEntry.deleteMany();
  await prisma.recipeLine.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.location.deleteMany();

  await prisma.location.create({
    data: { id: "loc-1", name: "CDM Restaurant (LOC001)" },
  });

  const sup = await Promise.all([
    prisma.supplier.create({
      data: {
        code: "SUP001",
        name: "Santos Production",
        kind: SupplierKind.INTERNAL,
        contactEmail: "orders@santos-aruba.example.invalid",
        orderingDaysNote: "Daily",
        deliveryDaysNote: "Daily (no weekend delivery)",
        leadTimeBusinessDays: 2,
      },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP002",
        name: "Island Dairy Co",
        kind: SupplierKind.EXTERNAL,
        contactEmail: "orders+island-test@example.invalid",
        orderingDaysNote: "Mon/Wed order → Tue/Thu delivery (see master sheet)",
        deliveryDaysNote: "Tue/Thu",
        leadTimeBusinessDays: 2,
      },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP003",
        name: "Compra Aruba",
        kind: SupplierKind.EXTERNAL,
        contactEmail: "orders+compra-test@example.invalid",
        orderingDaysNote: "Tue/Wed/Thu",
        deliveryDaysNote: "Wed/Thu",
        leadTimeBusinessDays: 2,
      },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP004",
        name: "Fresh Ocean Seafood",
        kind: SupplierKind.EXTERNAL,
        contactEmail: "orders+ocean-test@example.invalid",
        orderingDaysNote: "Mon–Thu",
        deliveryDaysNote: "Tue–Fri",
        leadTimeBusinessDays: 2,
      },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP005",
        name: "Global Food Supply",
        kind: SupplierKind.EXTERNAL,
        contactEmail: "orders+global-test@example.invalid",
        orderingDaysNote: "Wednesday",
        deliveryDaysNote: "Friday",
        leadTimeBusinessDays: 2,
      },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP006",
        name: "Tropic Produce Farms",
        kind: SupplierKind.EXTERNAL,
        contactEmail: "orders+tropic-test@example.invalid",
        orderingDaysNote: "Monday",
        deliveryDaysNote: "Thursday",
        leadTimeBusinessDays: 2,
      },
    }),
  ]);
  const byCode = Object.fromEntries(sup.map((s) => [s.code, s])) as Record<
    string,
    { id: string }
  >;

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
    supplierCode: string;
    vendorName?: string;
    supplierSku?: string;
    minOrder?: number;
    unitCost?: number;
    orderPackAmount?: number;
    orderPackLabel?: string;
    mapeFallbackPct?: number;
    shelfLifeDays?: number | null;
  }) =>
    prisma.ingredient.create({
      data: {
        internalNumber: data.internalNumber,
        name: data.name,
        class: data.class,
        parLevel: data.parLevel,
        onHand: data.onHand,
        inventoryUnit: data.inventoryUnit,
        supplierId: byCode[data.supplierCode]!.id,
        vendorName: data.vendorName,
        supplierSku: data.supplierSku,
        minOrder: data.minOrder ?? null,
        unitCost: data.unitCost ?? null,
        orderPackAmount: data.orderPackAmount ?? null,
        orderPackLabel: data.orderPackLabel ?? null,
        mapeFallbackPct: data.mapeFallbackPct ?? null,
        shelfLifeDays: data.shelfLifeDays ?? null,
      },
    });

  const bagel = await ing({
    internalNumber: "ITM001",
    name: "Plain Bagel 120g",
    class: "Bakery",
    parLevel: 180,
    onHand: 85,
    inventoryUnit: InventoryUnit.EACH,
    supplierCode: "SUP001",
    vendorName: "Santos Production",
    supplierSku: "BAG-120-CBS",
    minOrder: 100,
    unitCost: 0.85,
    orderPackAmount: 1,
    orderPackLabel: "each",
    mapeFallbackPct: 0.18,
  });
  const croissant = await ing({
    internalNumber: "ITM002",
    name: "Butter Croissant 80g",
    class: "Bakery",
    parLevel: 250,
    onHand: 140,
    inventoryUnit: InventoryUnit.EACH,
    supplierCode: "SUP001",
    vendorName: "Santos Production",
    supplierSku: "CRO-80-CBS",
    minOrder: 120,
    unitCost: 0.85,
    orderPackAmount: 1,
    orderPackLabel: "each",
    mapeFallbackPct: 0.12,
  });
  const creamCheese = await ing({
    internalNumber: "ITM003",
    name: "Cream Cheese Block 2kg",
    class: "Dairy",
    parLevel: 12,
    onHand: 5.2,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP002",
    vendorName: "Island Dairy Co",
    supplierSku: "CC-2KG-IDC",
    minOrder: 2,
    unitCost: 18,
    orderPackAmount: 2,
    orderPackLabel: "kg per pack",
    mapeFallbackPct: 0.15,
  });
  const salmon = await ing({
    internalNumber: "ITM004",
    name: "Smoked Salmon Fillet",
    class: "Seafood",
    parLevel: 10,
    onHand: 2.1,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP004",
    vendorName: "Fresh Ocean Seafood",
    supplierSku: "SAL-ATL-FOC",
    minOrder: 1,
    unitCost: 42,
    orderPackAmount: 1,
    orderPackLabel: "kg",
    mapeFallbackPct: 0.2,
  });
  const capers = await ing({
    internalNumber: "ITM005",
    name: "Capers Jar 1kg",
    class: "Pantry",
    parLevel: 2,
    onHand: 1.2,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP005",
    vendorName: "Global Food Supply",
    supplierSku: "CAP-1KG-GFS",
    minOrder: 2,
    unitCost: 9.5,
    orderPackAmount: 1,
    orderPackLabel: "kg",
  });
  const pistachioCream = await ing({
    internalNumber: "ITM006",
    name: "Pistachio Cream 3kg Tub",
    class: "Bakery",
    parLevel: 5,
    onHand: 5,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP005",
    vendorName: "Global Food Supply",
    supplierSku: "PST-3KG-GFS",
    minOrder: 1,
    unitCost: 36,
    orderPackAmount: 3,
    orderPackLabel: "kg per tub",
  });
  const powderedSugar = await ing({
    internalNumber: "ITM007",
    name: "Powdered Sugar 2kg",
    class: "Pantry",
    parLevel: 3,
    onHand: 3,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP005",
    vendorName: "Global Food Supply",
    supplierSku: "SUG-2KG-GFS",
    minOrder: 2,
    unitCost: 6,
    orderPackAmount: 2,
    orderPackLabel: "kg per bag",
  });
  const choppedPistachio = await ing({
    internalNumber: "ITM008",
    name: "Chopped Pistachio 1kg",
    class: "Pantry",
    parLevel: 2,
    onHand: 2,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP005",
    vendorName: "Global Food Supply",
    supplierSku: "PST-1KG-GFS",
    minOrder: 2,
    unitCost: 28,
    orderPackAmount: 1,
    orderPackLabel: "kg",
  });
  const bacon = await ing({
    internalNumber: "ITM009",
    name: "Bacon Strip Pack 5kg",
    class: "Meat",
    parLevel: 12,
    onHand: 8,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP002",
    vendorName: "Island Dairy Co",
    supplierSku: "BAC-5KG-IDC",
    minOrder: 1,
    unitCost: 55,
    orderPackAmount: 5,
    orderPackLabel: "kg per pack",
    mapeFallbackPct: 0.14,
  });
  const egg = await ing({
    internalNumber: "ITM010",
    name: "Premade Egg Patty (60ct case)",
    class: "Dairy",
    parLevel: 120,
    onHand: 40,
    inventoryUnit: InventoryUnit.EACH,
    supplierCode: "SUP002",
    vendorName: "Island Dairy Co",
    supplierSku: "EGG-PREM-IDC",
    minOrder: 60,
    unitCost: 48,
    orderPackAmount: 60,
    orderPackLabel: "units per case",
  });
  const avocado = await ing({
    internalNumber: "ITM011",
    name: "Fresh Avocado Box 5kg",
    class: "Produce",
    parLevel: 20,
    onHand: 7,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP006",
    vendorName: "Tropic Produce Farms",
    supplierSku: "AVO-BOX-TPF",
    minOrder: 1,
    unitCost: 20,
    orderPackAmount: 5,
    orderPackLabel: "kg per box",
    mapeFallbackPct: 0.16,
    shelfLifeDays: 3,
  });
  const ham = await ing({
    internalNumber: "ITM012",
    name: "Sliced Ham 2kg",
    class: "Meat",
    parLevel: 6,
    onHand: 6,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP002",
    vendorName: "Island Dairy Co",
    supplierSku: "HAM-2KG-IDC",
    minOrder: 2,
    unitCost: 24,
    orderPackAmount: 2,
    orderPackLabel: "kg per pack",
  });
  const gouda = await ing({
    internalNumber: "ITM013",
    name: "Gouda Cheese Block 3kg",
    class: "Dairy",
    parLevel: 15,
    onHand: 10,
    inventoryUnit: InventoryUnit.KG,
    supplierCode: "SUP002",
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
    { menuId: m003.id, ingredientId: bacon.id, amount: 93, unit: R.GRAM },
    { menuId: m003.id, ingredientId: egg.id, amount: 1, unit: R.EACH },
    { menuId: m003.id, ingredientId: avocado.id, amount: 78, unit: R.GRAM },
    { menuId: m004.id, ingredientId: croissant.id, amount: 1, unit: R.EACH },
    { menuId: m004.id, ingredientId: ham.id, amount: 52, unit: R.GRAM },
    { menuId: m004.id, ingredientId: gouda.id, amount: 72, unit: R.GRAM },
    { menuId: m005.id, ingredientId: croissant.id, amount: 1, unit: R.EACH },
    { menuId: m005.id, ingredientId: bacon.id, amount: 93, unit: R.GRAM },
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

  /** ~45 days of daily totals (Feb–Mar style) for MAPE + weekday spikes. */
  const menus = [m001, m002, m003, m004, m005];
  const salesBatch: { menuItemId: string; quantity: number; soldAt: Date }[] = [];
  const base = new Date(Date.UTC(2026, 0, 18, 12, 0, 0));
  for (let day = 0; day < 45; day++) {
    const soldAt = new Date(base);
    soldAt.setUTCDate(base.getUTCDate() + day);
    const dow = soldAt.getUTCDay();
    const w = Math.floor(day / 7);

    const q = (baseQty: number, spike: number) =>
      Math.max(8, Math.round(baseQty + spike + (day % 4) - (w % 2)));

    const m001Qty =
      dow === 6 ? q(55, 7 + (day % 3)) : dow === 0 ? q(22, 4) : q(30, dow * 0.8);
    const m002Qty = dow === 5 ? q(20, 3) : q(16, 2);
    const m003Qty = dow === 1 ? q(30, 5 + (day % 2)) : q(20, 1);
    const m004Qty = q(22, dow * 0.5);
    const m005Qty = q(21, 1.5);

    const qtys = [m001Qty, m002Qty, m003Qty, m004Qty, m005Qty];
    for (let i = 0; i < menus.length; i++) {
      salesBatch.push({
        menuItemId: menus[i]!.id,
        quantity: qtys[i]!,
        soldAt,
      });
    }
  }
  await prisma.salesEntry.createMany({ data: salesBatch });

  console.log(
    "Seed complete: suppliers, menu, ingredients, recipes, sales history."
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
