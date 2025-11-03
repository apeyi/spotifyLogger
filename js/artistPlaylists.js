import { api } from "./api.js";
import { ensureAggregatePlaylist, getPlaylistTrackUris, getMyOwnedPlaylists, addTracks } from "./playlists.js";
import { ensureScopes, haveScopes } from "./auth.js";

function normalizeArtistName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPlaylistTracksDetailed(playlistId) {
  const tracks = [];
  let next = { limit: 100, offset: 0 };
  while (true) {
    const page = await api(`/playlists/${playlistId}/tracks`, { params: next });
    for (const it of page.items) {
      const tr = it.track;
      if (!tr || it.is_local) continue;
      if (tr.type !== "track") continue;
      tracks.push({
        id: tr.id,
        uri: tr.uri,
        name: tr.name,
        artists: (tr.artists || []).map(a => a.name)
      });
    }
    if (!page.next) break;
    next.offset += next.limit;
  }
  return tracks;
}

async function buildArtistIndexFromAggregate() {
  const agg = await ensureAggregatePlaylist();
  const tracks = await getPlaylistTracksDetailed(agg.id);
  const byArtist = new Map();
  for (const t of tracks) {
    const primary = t.artists?.[0];
    if (!primary) continue;
    const key = normalizeArtistName(primary);
    if (!byArtist.has(key)) byArtist.set(key, { displayName: primary, uris: [] });
    byArtist.get(key).uris.push(t.uri);
  }
  return byArtist;
}

async function mapMyPlaylistsByName() {
  const mine = await getMyOwnedPlaylists();
  const map = new Map();
  for (const p of mine) map.set(normalizeArtistName(p.name), p);
  return map;
}

export async function syncArtistPlaylists(outEl, minCount = 5) {
  const needed = ["playlist-read-private","playlist-modify-private","playlist-modify-public"];
  if (!haveScopes(needed)) { outEl.textContent = "Re-auth needed for playlist modify scopes…"; await ensureScopes(needed); return; }

  outEl.textContent = "Loading All My Songs + your playlists…";
  const [artistIndex, playlistMap] = await Promise.all([
    buildArtistIndexFromAggregate(),
    mapMyPlaylistsByName()
  ]);

  const results = [];
  for (const [nameKey, playlist] of playlistMap.entries()) {
    // skip the aggregate if names collide
    if (/^all my songs \(auto\)$/i.test(playlist.name)) continue;

    const artistData = artistIndex.get(nameKey);
    if (!artistData) {
      results.push(`Skip: “${playlist.name}” — no matching artist found in All My Songs`);
      continue;
    }
    if (artistData.uris.length < minCount) {
      results.push(`Skip: “${playlist.name}” — only ${artistData.uris.length} tracks in All My Songs (< ${minCount})`);
      continue;
    }
    const existingUris = new Set(await getPlaylistTrackUris(playlist.id));
    const toAdd = artistData.uris.filter(u => !existingUris.has(u));
    if (toAdd.length) {
      await addTracks(playlist.id, toAdd);
      results.push(`Updated: “${playlist.name}” — added ${toAdd.length} track(s)`);
    } else {
      results.push(`OK: “${playlist.name}” already has all ${artistData.uris.length} track(s)`);
    }
  }
  outEl.textContent = results.join("\n");
}

export async function findMissingArtistPlaylists(outEl, threshold = 7) {
  outEl.textContent = "Scanning…";
  const [artistIndex, playlistMap] = await Promise.all([
    buildArtistIndexFromAggregate(),
    mapMyPlaylistsByName()
  ]);

  const missing = [];
  for (const [artistKey, data] of artistIndex.entries()) {
    const count = data.uris.length;
    if (count >= threshold && !playlistMap.has(artistKey)) {
      missing.push({ name: data.displayName, count });
    }
  }
  missing.sort((a,b) => b.count - a.count);

  outEl.textContent = missing.length
    ? "Artists with no playlist:\n" + missing.map(m => `• ${m.name} — ${m.count} tracks`).join("\n")
    : `All set: every artist with ≥${threshold} tracks has a playlist.`;
}
