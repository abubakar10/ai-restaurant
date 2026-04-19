/**
 * Production: set `VITE_API_BASE_URL` in Vercel to your deployed API origin (no trailing slash), e.g.
 * `https://your-api.railway.app`. Dev: leave unset — Vite proxies `/api` to localhost:4000.
 *
 * Important: Vite inlines this at **build** time. After changing env on Vercel, **redeploy** the frontend.
 */
const warnedMissingBase = { current: false };
function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (
    import.meta.env.PROD &&
    !base &&
    !warnedMissingBase.current
  ) {
    warnedMissingBase.current = true;
    console.warn(
      "[api] VITE_API_BASE_URL is not set. Requests go to this site as /api/... and will 404. Add it in Vercel → Environment Variables, then Redeploy."
    );
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base) return `${base}/api${p}`;
  return `/api${p}`;
}

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  // Do not send Content-Type on GET/HEAD — it forces a CORS preflight (OPTIONS) that can fail on some hosts.
  const headers = new Headers(init?.headers);
  if (method !== "GET" && method !== "HEAD") {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    let err = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(err || res.statusText);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
