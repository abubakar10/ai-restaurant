# AI Restaurant - Client Update Notes

This file summarizes all major changes implemented in this phase so you can share status with the client.

## 1) Master Data Tabs Added

### Items tab
- New page: `client/src/pages/Items.tsx`
- Uses API: `GET /api/item-masters`
- Fields aligned to the shared sheet:
  - Item_ID, Item Name, Type, Class, BaseUOM, Shelf Life (Days), Trace Batch, Barcode,
  - Is Production Item, Is Recipe Ingredient, Sourcing Mode, Production Capacity Per Day,
  - optional ingredient SKU link.

### Suppliers tab
- New page: `client/src/pages/Suppliers.tsx`
- Uses API: `GET /api/suppliers`
- Fields aligned to sheet:
  - Supplier Type, SupplierID, SupplierName, ContactPerson, Phone, Email,
  - OrderingDay, DeliveryDay, Weekends, LeadTimeDays.

## 2) AI PO View Changes

### Layout and grouping
- AI PO now uses table rows (not cards).
- Lines are grouped by supplier.
- Approving draft creates one PO per supplier group.

### Forecast model rule update
- Requirement implemented: short lead-style forecast applies only when supplier ordering+delivery are both Daily.
- For non-daily suppliers, forecast uses an extended business-day window.
- AI PO table now shows schedule context:
  - Ordering, Delivery, Weekends, Lead, Model, Forecast window.

### Performance improvements for Generate Suggestions
- Heavy forecast computations memoized/cached.
- Menu MAPE precomputed once per menu.
- DB reads parallelized.
- Sales history window reduced from 120 to 56 days for faster run-time.
- Added short server TTL cache (25 seconds) for repeated Generate calls.

## 3) PO Workflow / Supplier Portal

### PO creation and status flow
- Approve endpoint updated: `POST /api/suggestions/po/approve`
- Creates supplier-specific POs with statuses:
  - SENT_TO_SUPPLIER
  - SUPPLIER_APPROVED
  - SUPPLIER_DECLINED
  - RECEIVED
  - CANCELLED
  - plus legacy APPROVED compatibility.

### Supplier portal link in email
- Supplier email now includes portal URL: `/po/supplier/:token`
- Supplier can:
  - confirm/adjust line quantities,
  - add line notes,
  - add PO-level note,
  - approve or decline.
- Discrepancy lock behavior supported:
  - original approved qty remains,
  - supplier-confirmed qty stored separately.

### Santos email override
- For Santos supplier (SUP001 / name includes Santos), PO notifications route to:
  - `anthonys2amartina@gmail.com`
- Non-Santos suppliers use supplier contact email.
- Test recipient behavior remains available via env config.

## 4) Receiving and PO Status Pages

### Receiving tab
- New page: `client/src/pages/Receiving.tsx`
- Uses APIs:
  - `GET /api/purchase-orders`
  - `POST /api/purchase-orders/:id/receive`
- Supports:
  - open PO receiving,
  - received qty per line,
  - discrepancy capture,
  - inventory updates from received quantities,
  - PO status transition to RECEIVED.

### PO Status tab
- New page: `client/src/pages/PoStatus.tsx`
- Uses API: `GET /api/purchase-orders`
- Shows sent POs and lifecycle metadata:
  - supplier pending / approved / declined / received,
  - timestamps,
  - notes and line-level context.

## 5) Inventory / Sales Behavior Changes

### Inventory on-hand edit locked
- Inventory stock sheet is now read-only for existing rows.
- Removed manual per-row on-hand edits and Save actions from Inventory page.
- On-hand is now system-driven (Sales + Receiving + seed).

### Sales can post even if stock is low
- Removed server-side insufficient-stock hard block in `recordSale`.
- Sales now always post; inventory can go negative.
- This supports real-world operations where sales truth is prioritized and stock is reconciled after.

## 6) Navigation and Routing Updates

Added new routes/pages in app navigation:
- `/items`
- `/suppliers`
- `/suggestions` (enhanced)
- `/po-status`
- `/receiving`
- `/po/supplier/:token` (supplier portal)

## 7) Database / Schema / Seed Updates

### Prisma schema updates
- Expanded `Supplier` fields.
- Added `ItemMaster` model.
- Expanded `PurchaseOrder` and `PurchaseOrderLine` for supplier workflow and receiving.

### Seed updates
- Supplier seed data aligned with master schedule fields.
- Item master seed rows added.

## 8) Environment / Startup Notes

Required in `server/.env`:
- `DATABASE_URL`
- `DIRECT_URL`
- `CLIENT_ORIGIN`

Optional for real emails:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `PO_SENDER_EMAIL`
- `PO_TEST_RECIPIENT_EMAIL`

Run sequence:
1. `npm install`
2. `npm run db:push`
3. `npm run db:seed`
4. `npm run dev`

## 9) Known Build Note (Windows)
- One observed intermittent build issue:
  - Prisma generate file rename `EPERM` on Windows due to file lock/antivirus contention.
- TypeScript checks for both server and client passed after changes.

---

If needed, this can be split into a shorter client-facing summary and a separate technical handoff document for developers.
