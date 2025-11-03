import { api } from "./api.js";
import { AGG_NAME, AGG_DESC } from "./config.js";

const chunk = (arr, n=100) => { const out=[]; for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; };

export async function getMe() { return api("/me"); }

export async function getMyOwnedPlaylists() {
  const me = await getMe();
  const mine = [];
  let next = { limit: 50, offset: 0 };
  while (true) {
    const page = await api("/me/playlists", { params: next });
    for (const p of page.items) if (p.owner?.id === me.id) mine.push(p);
    if (!page.next) break;
    next.offset += next.limit;
  }
  return mine;
}

export async function getPlaylistTrackUris(playlistId) {
  const uris = [];
  let next = { limit: 100, offset: 0 };
  while (true) {
    const page = await api(`/playlists/${playlistId}/tracks`, { params: next });
    for (const it of page.items) {
      const tr = it.track;
      if (!tr || it.is_local) continue;
      if (tr.type !== "track") continue;
      if (!tr.id || !tr.uri) continue;
      uris.push(tr.uri);
    }
    if (!page.next) break;
    next.offset += next.limit;
  }
  return uris;
}

export async function ensureAggregatePlaylist() {
  const key = "aggregate_playlist_id";
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const p = await api(`/playlists/${cached}`);
      if (p && p.name === AGG_NAME) return p;
    } catch {}
  }
  const me = await getMe();
  // find by name
  let found = null, next = { limit: 50, offset: 0 };
  while (true) {
    const page = await api("/me/playlists", { params: next });
    for (const p of page.items) {
      if (p.name === AGG_NAME && p.owner?.id === me.id) { found = p; break; }
    }
    if (found || !page.next) break;
    next.offset += next.limit;
  }
  if (found) { localStorage.setItem(key, found.id); return found; }
  const created = await api(`/users/${me.id}/playlists`, {
    method: "POST",
    body: { name: AGG_NAME, description: AGG_DESC, public: false }
  });
  localStorage.setItem(key, created.id);
  return created;
}

export async function buildDesiredUrisFromOwnedPlaylists() {
  const lists = await getMyOwnedPlaylists();
  const seen = new Set(), desired = [];
  for (const p of lists) {
    const uris = await getPlaylistTrackUris(p.id);
    for (const uri of uris) {
      const id = uri.split(":").pop();
      if (!seen.has(id)) { seen.add(id); desired.push(uri); }
    }
  }
  return desired;
}

export async function getAggregateUris(playlistId) {
  return getPlaylistTrackUris(playlistId);
}

export async function addTracks(playlistId, uris) {
  for (const group of chunk(uris, 100)) {
    await api(`/playlists/${playlistId}/tracks`, { method: "POST", body: { uris: group } });
  }
}
export async function removeTracks(playlistId, uris) {
  for (const group of chunk(uris, 100)) {
    await api(`/playlists/${playlistId}/tracks`, {
      method: "DELETE",
      body: { tracks: group.map(u => ({ uri: u })) }
    });
  }
}

export async function createAggregateNow(aggLogEl) {
  aggLogEl.textContent = "Building list of tracks…";
  const agg = await ensureAggregatePlaylist();
  const desired = await buildDesiredUrisFromOwnedPlaylists();
  const existing = new Set(await getAggregateUris(agg.id));
  const toAdd = desired.filter(u => !existing.has(u));
  aggLogEl.textContent = `Adding ${toAdd.length} tracks…`;
  if (toAdd.length) await addTracks(agg.id, toAdd);
  aggLogEl.textContent = `Done. Aggregate now ~${desired.length} unique tracks.`;
}

export async function updateAggregateNow(aggLogEl, { removeExtras=false } = {}) {
  aggLogEl.textContent = "Collecting playlists and tracks…";
  const agg = await ensureAggregatePlaylist();
  const [desired, current] = await Promise.all([
    buildDesiredUrisFromOwnedPlaylists(),
    getAggregateUris(agg.id)
  ]);
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);
  const toAdd = desired.filter(u => !currentSet.has(u));
  const toRemove = removeExtras ? current.filter(u => !desiredSet.has(u)) : [];
  aggLogEl.textContent = `Syncing: +${toAdd.length}${removeExtras ? ` / -${toRemove.length}` : ""}…`;
  if (toAdd.length) await addTracks(agg.id, toAdd);
  if (toRemove.length) await removeTracks(agg.id, toRemove);
  aggLogEl.textContent = "Update complete.";
}
