# AI Restaurant Inventory — Milestone 1

Web dashboard (React + Vite + Tailwind v4 + shadcn-style UI + TanStack Table + Framer Motion) and API (Express + Prisma + PostgreSQL). Seeded fake data matches the client’s spreadsheet structure (menu M001–M005, recipes, PAR, vendors).

## Client / stakeholder meeting

For a **plain-English summary of what was delivered**, a **suggested demo order**, **questions to ask**, and **what is not in scope**, see **[`CLIENT_MEETING.md`](./CLIENT_MEETING.md)**.

## Prerequisites

- Node 20+
- A Postgres URL (e.g. Supabase **Project Settings → Database → URI**). Use the **direct** `5432` connection for `prisma db push` if the pooler causes issues.

## Setup

1. From the repo root:

   ```bash
   npm install
   ```

2. Create `server/.env` (copy from `server/.env.example`). For **Supabase**:

   - If you see **`Can't reach database server`** or Vite shows **`ECONNREFUSED`** to `/api`, the API is not running — usually because **PostgreSQL is unreachable**.
   - **Resume** the project in the Supabase dashboard if it’s **paused** (free tier).
   - Prefer the **Session / Transaction pooler** connection string (**port 6543**, `pgbouncer=true`) from **Connect**, not only `db.*.supabase.co:5432` — direct `5432` is often blocked or flaky from some networks.
   - Add **`?sslmode=require`** if the host requires it.

   ```env
   DATABASE_URL="postgresql://..."
   PORT=4000
   CLIENT_ORIGIN=http://localhost:5173
   ```

3. Push schema and seed (from repo root):

   ```bash
   npm run db:push
   npm run db:seed
   ```

   `server/.env` needs **`DATABASE_URL`** (pooler) and **`DIRECT_URL`** (direct `db.*.supabase.co:5432`) so Prisma can run migrations. If `db push` fails with **P1001** on the direct host, open Supabase **SQL Editor**, paste `server/prisma/init.sql`, run it, then run **`npm run db:seed`** only.

4. If the API returns **P2021** (“table does not exist”), the schema was never applied — run step 3 again.

5. Run **both** the API and the web app (from the **repo root**, not only `client/`):

   ```bash
   npm run dev
   ```

   - UI: [http://localhost:5173](http://localhost:5173)  
   - API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

   If you only run `npm run dev` inside `client/`, Vite will start but **`/api` requests will fail** (`ECONNREFUSED` / proxy error) because nothing is listening on port **4000**. Either use `npm run dev` at the root, or open **two terminals**: `npm run dev:api` and `npm run dev:web`.

## Milestone 1 scope (delivered here)

- Dashboard with stats + below-PAR preview  
- Sales simulation (recipe-based stock deduction)  
- Inventory grid with PAR status + manual save  
- Recipes / BOM view  
- **AI PO suggestions** (PAR gap + moving-average forecast from recent sales, min order / pack rounding)

Milestone 2 (not in this repo scope): supervisor approval, supplier email, partial confirmations, receiving.

## Database export

Use standard Postgres tools (`pg_dump`) against the same `DATABASE_URL` to hand off a full SQL dump if the client moves hosting.
