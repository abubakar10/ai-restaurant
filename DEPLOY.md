# Deploying to production

The app is a **monorepo**: **React (Vite)** in `client/` and **Express + Prisma** in `server/`.

- **Frontend:** Vercel with **Root Directory `client`** (see [§2](#2-deploy-the-frontend-on-vercel)).
- **Backend:** Deploy **`server/`** on **Vercel** (Express preset) **or** Railway / Render / Fly. The API **`export default app`** and only calls **`app.listen()` when not on Vercel (`VERCEL` unset).

### Vercel UI checklist (server project)

| Setting | Value |
|--------|--------|
| Repository | `abubakar10/ai-restaurant` (or yours) |
| Root Directory | **`server`** |
| Framework Preset | **Express** |
| Branch | `master` (or default) |
| Environment Variables | See table below — expand **Environment Variables** and add them for **Production** (and **Preview** if you want preview URLs to work with the API). |

If **`npm install` fails** because of the monorepo layout, try **Root Directory** = repo root and set **Build Command** to `npm run build -w server` (from [`package.json`](./package.json) workspaces), or see your host’s docs for npm workspaces.

---

## Environment variables — `server` (production)

Set these in **Vercel → Project → Settings → Environment Variables** (or your host’s env UI).

| Name | Required | Example / notes |
|------|----------|-------------------|
| **`DATABASE_URL`** | **Yes** | Supabase **pooler** URL (`…pooler…:6543…?pgbouncer=true&sslmode=require`). Used at runtime by Prisma. |
| **`DIRECT_URL`** | Optional at runtime | Direct Postgres URL (`db.*.supabase.co:5432`). Needed for `prisma migrate` / `db push` from your laptop or CI — **not** required for the API process to answer HTTP requests if the schema is already applied. |
| **`CLIENT_ORIGIN`** | **Yes** (for browser) | Comma-separated origins where the **React app** is hosted — **not** the API URL. Example: `https://ai-restaurant-client.vercel.app,http://localhost:5173`. Wrong value (e.g. `https://…-server.vercel.app`) causes **CORS** to block the browser. Trailing slashes are OK; they are normalized. |
| **`PORT`** | No | Set automatically on Vercel; local default `4000`. |

**Do not commit** real secrets — set them only in the hosting dashboard.

**After the first deploy**, open **`https://<your-server>.vercel.app/api/health`** — you should see JSON like `{ "ok": true, ... }`.  
Opening **`/`** alone shows a short JSON message (this is an **API** project, not a website). If you see **“Cannot GET /”** on an older deploy, redeploy after pulling the latest code (we added a root handler).  
If you get CORS errors from the browser, add that page’s **origin** to `CLIENT_ORIGIN` and redeploy the API.

---

## 1. Deploy the API (example: Railway)

1. Create a project and deploy from the same GitHub repo, or connect the repo and set **Root directory** to `server`.
2. Set environment variables (mirror `server/.env.example`):

   - `DATABASE_URL` — Supabase pooler URL (or any Postgres URL).
   - `DIRECT_URL` — direct Postgres URL for Prisma migrations (if you run `prisma migrate` from CI).
   - `PORT` — often set automatically by the platform (Railway injects `PORT`).
   - **`CLIENT_ORIGIN`** — your Vercel URL once it exists, e.g. `https://your-app.vercel.app`  
     You can add multiple origins separated by commas: `https://app.vercel.app,https://www.client.com`

3. **Build / start** (adjust to your host’s UI):

   - Install: `npm install` (from `server` or monorepo root with workspaces).
   - Generate client: `npx prisma generate`
   - Build: `npm run build` in `server` if a build script exists, or `tsc` as configured.
   - Start: `node dist/index.js` or `npm start` — match what’s in `server/package.json`.

4. Run migrations / schema on the production database once:

   - `DATABASE_URL` / `DIRECT_URL` pointing at production DB, then `npx prisma db push` or `migrate deploy` from your machine or CI.

5. Copy the **public HTTPS URL** of the API (e.g. `https://ai-restaurant-api.up.railway.app`).

---

## 2. Deploy the frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import **`abubakar10/ai-restaurant`** (or your repo).
2. **Root Directory**: set to **`client`** (important).
3. Framework: **Vite** (auto-detected). Build command: `npm run build`, output: **`dist`**.
4. **Environment variables** (add for **Production** and **Preview** if you use preview URLs):

   | Name | Value |
   |------|--------|
   | `VITE_API_BASE_URL` | Your API **origin only**: `https://ai-restaurant-server.vercel.app` (no `/api`, no trailing slash). Use your real server URL. |

5. **Deploy**, then after any env change: **Redeploy** (or “Redeploy with existing Build Cache” off). Vite bakes `VITE_*` in at **build** time — if this variable was missing during the build, the app will call `/api/...` on the **frontend** domain and you’ll get **404** until you redeploy with the variable set.

6. Your site will be `https://<project>.vercel.app`.

7. **CORS**: On the **server** Vercel project, set **`CLIENT_ORIGIN`** to your **frontend** URL(s), comma-separated, e.g. `https://ai-restaurant-client.vercel.app,https://ai-restaurant-client-xxx-abubakar10s-projects.vercel.app` — include **preview** URLs if you test previews. Redeploy the **API** after changing `CLIENT_ORIGIN`.

---

## 3. Local check before shipping

```bash
cd client
npm run build
npx vite preview
```

With `VITE_API_BASE_URL` unset, preview still uses relative `/api` — so for a **production-like** check, run the API locally and use a tool that sets env, or test only after Vercel + API URLs are wired.

---

## 4. Troubleshooting

| Issue | What to check |
|--------|----------------|
| Blank page / 404 on refresh | `client/vercel.json` rewrites should send all routes to `index.html`. |
| CORS errors in browser | `CLIENT_ORIGIN` on API must match the exact Vercel URL (scheme + host). |
| API calls fail / wrong host | `VITE_API_BASE_URL` must be the API **origin** only; client code appends `/api/...`. |
| Database errors | `DATABASE_URL` on API host; Supabase project not paused; SSL params. |

---

## Summary

1. Deploy **`server`** → get `https://api.example.com`.  
2. Set **`CLIENT_ORIGIN`** on API → include `https://yoursite.vercel.app`.  
3. Deploy **`client`** on Vercel with **`VITE_API_BASE_URL=https://api.example.com`**.  
