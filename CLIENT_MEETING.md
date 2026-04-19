# Client meeting — AI Restaurant Inventory (Milestone 1)

Use this as a **talk track**, **demo order**, and **question list**. Technical setup stays in the root [`README.md`](./README.md).

---

## 1. What we built (plain language)

A **single web application** that helps the kitchen team see **stock health**, **simulate sales**, **adjust inventory**, view **recipes (bill of materials)**, and get **draft purchase suggestions** driven by **PAR levels** and a **simple sales forecast**.

| Area | What it does |
|------|----------------|
| **Dashboard** | High-level counts (ingredients, below PAR, sales logged, menu items) and a **PAR exposure** list (worst coverage first). On phones/tablets this appears as **cards**; on large screens as a **table**. |
| **Sales** | Record “units sold” for a menu SKU. The system **reduces ingredient stock** using each item’s **recipe** (BOM), with unit math handled on the server. |
| **Inventory** | Full ingredient list with **on-hand** editable fields, **PAR** comparison, and **save per line**. Same **card layout on small screens** for easier editing. |
| **Recipes** | Each menu item shows its **components and quantities** per portion (BOM view). |
| **AI PO** | **Suggested order quantities** combining (1) gap to PAR and (2) a **moving-average style forecast** from recent (simulated) sales, plus **minimum order / pack** logic where seeded. |

**Milestone 1 is feature-complete** for this scope. What is **not** built yet is listed under [Out of scope](#4-out-of-scope-milestone-2--future) — use that to steer “what’s next” conversations.

---

## 2. What you can say technically (if they ask)

- **Frontend:** React, TypeScript, Vite, Tailwind — responsive UI tuned for **operations use** (dense data, readable on mobile).
- **Backend:** Node.js (Express), **Prisma** ORM, **PostgreSQL** (works well with **Supabase** for hosting).
- **Data:** Demo data is **seeded in the repo** (`server/prisma/seed.ts`), structured like a **menu + recipes + PAR + vendors** model. It is **not automatically the same as every cell** in an external Excel unless you explicitly imported or matched it.
- **Branding:** The product name shown in the UI (e.g. **“Nexus Kitchen”**) is a **placeholder** unless the client asked for a specific name.

---

## 3. Suggested demo flow (5–10 minutes)

1. **Dashboard** — Show KPIs and PAR exposure; mention **last sync** time if you’re online.
2. **Inventory** — Show one ingredient **below PAR**, optionally adjust a number (or explain you’d do that after a count).
3. **Sales** — Log **1–2 units** of a menu item; return to **Dashboard / Inventory** to show **stock moved**.
4. **Recipes** — Open one menu item and walk through **BOM lines** (why sales depleted those ingredients).
5. **AI PO** — Show **suggested lines**, **priority**, and **rationale**; clarify these are **draft** lines for buyers, not sent to suppliers yet.

---

## 4. Out of scope (Milestone 2 / future)

Not implemented in this codebase unless you add it later:

- **Supervisor approval** workflow for POs  
- **Email** to suppliers / automated ordering  
- **Partial shipments** and **receiving** workflows  
- **Multi-location** / **multi-user roles** (unless you extend the schema)  
- **Direct POS integration** (e.g. live feed from REVEL) — menu codes are represented; live sync is a separate project  

---

## 5. Questions worth asking the client

### Product & data

- **Branding:** Final **business name** and **logo** for the app header and browser title?
- **Data source of truth:** Should the system **import from their Excel** (or Google Sheets) on a schedule, or will **PostgreSQL** be the master after migration?
- **Parity:** Do they need **byte-for-byte** match with the current spreadsheet, or is **structural parity** (same SKUs, recipes, PAR) enough for Milestone 1?

### Operations

- **Locations:** One kitchen only for now, or **multiple sites** soon?
- **Users:** Who uses the tool (manager, buyer, HQ)? Any need for **roles** (view vs edit vs approve)?
- **Ordering:** Who **approves** orders before money is committed? (Sets up Milestone 2 scope.)

### Integrations & hosting

- **POS:** Is **REVEL** (or another system) the long-term source of **sales**, or will sales stay **manual / uploaded** for a while?
- **Hosting:** Preference for **cloud** (e.g. Supabase DB + app on Vercel/Railway) vs **on-premise**?
- **Budget / uptime:** Free-tier Supabase **pauses** when idle — acceptable for pilot or not?

### Security & compliance

- Who **owns** database credentials and **Supabase** (or hosting) accounts?
- Any requirements for **audit logs**, **backups**, or **data residency**?

---

## 6. Honest limitations to mention (builds trust)

- **Forecast** is intentionally **simple** (moving average–style); it is a **starting point**, not a full demand-planning suite.
- **AI PO** suggestions are **rules + forecast**, not a black-box ML product unless you extend it.
- **Seeded demo data** is for **development and demos**; production needs their **real** catalog, PAR, vendors, and counts.

---

## 7. After the meeting — typical next steps

1. Confirm **Milestone 2** priorities (approval, email, receiving, etc.).  
2. Decide **branding** and whether to **import** their real sheet.  
3. Choose **hosting** and who **administers** the database.  
4. Schedule **user acceptance** on a **staging** environment with real or anonymized data.

---

*Document version: aligned with Milestone 1 as implemented in this repository.*
