import { PrismaClient } from "@prisma/client";
import { buildPoSuggestions } from "../src/lib/suggestions.js";

const prisma = new PrismaClient();

async function main() {
  const beforeSales = await prisma.salesEntry.count();
  const beforeSuggestions = (await buildPoSuggestions()).lines.length;

  const menu = await prisma.menuItem.findMany({
    select: { id: true, code: true },
  });
  const byCode = new Map(menu.map((m) => [m.code, m.id]));

  const required = ["M001", "M002", "M003", "M004", "M005"] as const;
  for (const code of required) {
    if (!byCode.get(code)) {
      throw new Error(`Menu item ${code} not found in DB`);
    }
  }

  // Add 10 days of stronger recent demand so AI PO suggests more replenishment.
  const rows: { menuItemId: string; quantity: number; soldAt: Date }[] = [];
  const now = new Date();
  for (let d = 0; d < 10; d++) {
    const soldAt = new Date(now);
    soldAt.setDate(now.getDate() - d);
    const dow = soldAt.getDay(); // 0 Sun ... 6 Sat
    rows.push(
      {
        menuItemId: byCode.get("M001")!,
        quantity: dow === 6 ? 95 : dow === 0 ? 60 : 72,
        soldAt,
      },
      {
        menuItemId: byCode.get("M002")!,
        quantity: dow === 5 ? 42 : 35,
        soldAt,
      },
      {
        menuItemId: byCode.get("M003")!,
        quantity: dow === 1 ? 68 : 47,
        soldAt,
      },
      {
        menuItemId: byCode.get("M004")!,
        quantity: dow >= 4 ? 52 : 40,
        soldAt,
      },
      {
        menuItemId: byCode.get("M005")!,
        quantity: dow >= 4 ? 50 : 38,
        soldAt,
      }
    );
  }

  await prisma.salesEntry.createMany({ data: rows });

  const afterSales = await prisma.salesEntry.count();
  const afterSuggestions = (await buildPoSuggestions()).lines.length;

  console.log(
    JSON.stringify(
      {
        addedRows: rows.length,
        salesCount: { before: beforeSales, after: afterSales },
        suggestionLines: { before: beforeSuggestions, after: afterSuggestions },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

