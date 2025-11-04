import { CLIENT_ID, REDIRECT_URI, SCOPES } from "./config.js";

const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const g = (k, d=null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const del = (k) => localStorage.removeItem(k);

const textEnc = new TextEncoder();
async function sha256(bytes) { return crypto.subtle.digest("SHA-256", bytes); }
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function randVerifier() { return b64url(crypto.getRandomValues(new Uint8Array(32))); }

export function getToken() {
  const t = JSON.parse(localStorage.getItem("spotify_token") || "null");
  return (t && typeof t.access_token === "string" && t.access_token.length > 10) ? t : null;
}

export async function startAuth() {
  const verifier = randVerifier();
  const challenge = b64url(await sha256(textEnc.encode(verifier)));
  s("pkce_verifier", verifier);

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("show_dialog", "true");
  location.href = url.toString();
}

async function tokenPOST(params) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has("code")) return null;
  const code = params.get("code");
  history.replaceState({}, "", REDIRECT_URI);
  const verifier = g("pkce_verifier");
  if (!verifier) throw new Error("Missing PKCE verifier; please log in again.");

  const tok = await tokenPOST({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  });
  s("spotify_token", { ...tok, obtained_at: Date.now() });
  return tok;
}

export async function refreshTokenIfNeeded() {
  let tok = g("spotify_token");
  if (!tok) return null;
  const expiresAt = tok.obtained_at + (tok.expires_in - 60) * 1000;
  if (Date.now() < expiresAt) return tok;
  if (!tok.refresh_token) return null;

  const nt = await tokenPOST({
    grant_type: "refresh_token",
    refresh_token: tok.refresh_token,
    client_id: CLIENT_ID
  });
  tok = { ...tok, ...nt, obtained_at: Date.now() };
  s("spotify_token", tok);
  return tok;
}

export async function requireTokenInteractive() {
  const stored = getToken();
  if (stored?.access_token) return stored;
  await handleRedirect();
  const after = getToken();
  if (after?.access_token) return after;
  await startAuth();
  return null;
}

export function logout() { del("spotify_token"); del("pkce_verifier"); }

export function haveScopes(required) {
  const tok = getToken();
  const granted = new Set((tok?.scope || "").split(" ").filter(Boolean));
  return required.every(s => granted.has(s));
}

export async function ensureScopes(required) {
  if (haveScopes(required)) return true;
  logout();
  await startAuth(); // navigates away
  return false;
}
