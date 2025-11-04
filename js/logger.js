import { api } from "./api.js";
import { getPlays, setPlays, getLastBackfillTs, setLastBackfillTs } from "./storage.js";

export function renderTop(targetEl) {
  const plays = getPlays();
  const lines = Object.entries(plays)
    .sort((a,b)=>b[1].count - a[1].count)
    .slice(0, 30)
    .map(([id,p]) => `${p.count} × ${p.name} — ${p.artist}`);
  targetEl.textContent = lines.length ? lines.join("\n") : "(no data yet)";
}

function incrementPlay(item) {
  const plays = getPlays();
  const id = item.track.id;
  if (!id) return;
  const prev = plays[id] || {
    count: 0,
    lastPlayedAt: 0,
    name: item.track.name,
    artist: item.track.artists?.map(a=>a.name).join(", ")
  };
  prev.count += 1;
  prev.lastPlayedAt = Date.parse(item.played_at || new Date().toISOString());
  plays[id] = prev;
  setPlays(plays);
}

let lastCounted = null;
function shouldCount(current) {
  if (!current || !current.item) return false;
  const id = current.item.id;
  const dur = current.item.duration_ms || 0;
  const prog = current.progress_ms || 0;
  const passed = (prog >= 30000) || (dur && prog / dur >= 0.5);
  const changed = lastCounted !== id;
  return passed && changed && !current.currently_playing_type?.includes("ad");
}

export async function backfill(logEl) {
  try {
    const since = getLastBackfillTs();
    const params = since ? { after: since, limit: 50 } : { limit: 50 };
    const data = await api("/me/player/recently-played", { params });
    const items = data?.items || [];
    items.forEach(incrementPlay);
    if (items.length) {
      const newest = items[0].played_at ? Date.parse(items[0].played_at) : Date.now();
      setLastBackfillTs(newest);
      logEl.textContent += (logEl.textContent.trim()? "\n":"") + `Backfilled ${items.length} plays.`;
    }
  } catch (e) {
    logEl.textContent += (logEl.textContent.trim()? "\n":"") + ("Backfill error: " + e.message);
  }
}

export async function pollCurrent(logEl) {
  try {
    const cur = await api("/me/player/currently-playing");
    if (cur && shouldCount(cur)) {
      lastCounted = cur.item.id;
      incrementPlay({ track: cur.item, played_at: new Date().toISOString() });
      logEl.textContent += (logEl.textContent.trim()? "\n":"") +
        `Counted: ${cur.item.name} — ${cur.item.artists.map(a=>a.name).join(", ")}`;
    }
  } catch (e) {
    logEl.textContent += (logEl.textContent.trim()? "\n":"") + ("Poll error: " + e.message);
  }
}

export function downloadCSV(filename = "spotify_plays.csv") {
  const plays = getPlays();
  const rows = [["track_id","name","artist","count","lastPlayedAtIso"]];
  for (const [id, p] of Object.entries(plays)) {
    rows.push([id, p.name ?? "", p.artist ?? "", p.count ?? 0,
      p.lastPlayedAt ? new Date(p.lastPlayedAt).toISOString() : ""]);
  }
  const csv = rows.map(row => row.map(s => {
    if (s == null) return "";
    s = String(s);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


import { api } from "./api.js";

export async function renderSpotifyTopN(targetEl, n = 10, range = "medium_term") {
  const data = await api("/me/top/tracks", { params: { limit: n, time_range: range } });
  const tracks = data.items || [];

  if (!tracks.length) {
    targetEl.innerHTML = `<p class="small">(no data returned)</p>`;
    return;
  }

  const rows = tracks.map((tr, i) => {
    const image = tr.album?.images?.[2]?.url || tr.album?.images?.[1]?.url || "";
    const artist = tr.artists.map(a=>a.name).join(", ");
    return `
      <div class="topitem">
        <div>${i+1}.</div>
        ${image ? `<img src="${image}" alt="">` : ""}
        <div class="topmeta">
          <a class="name" href="${tr.external_urls.spotify}" target="_blank" rel="noopener">${tr.name}</a>
          <div class="artist">${artist}</div>
        </div>
        <div class="topcount">🎧</div>
      </div>`;
  }).join("");

  targetEl.innerHTML = `<div class="toplist">${rows}</div>`;
}

