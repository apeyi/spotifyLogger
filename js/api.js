import { refreshTokenIfNeeded, getToken } from "./auth.js";

const authHeader = tok => ({ "Authorization": `Bearer ${tok.access_token}` });

export async function api(path, { method="GET", params={}, body=null } = {}) {
  let tok = await refreshTokenIfNeeded();
  tok = tok || getToken();
  if (!tok) throw new Error("Not authenticated.");

  const url = new URL("https://api.spotify.com/v1" + path);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));

  const r = await fetch(url, {
    method,
    headers: { ...authHeader(tok), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null
  });

  if (r.status === 204) return null;
  if (r.status === 429) {
    const retry = Number(r.headers.get("Retry-After") || "5");
    await new Promise(res => setTimeout(res, retry * 1000));
    return api(path, { method, params, body });
  }
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
