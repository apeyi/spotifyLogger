import { requireTokenInteractive, logout } from "./auth.js";
import { backfill, pollCurrent, renderTop, downloadCSV } from "./logger.js";
import { createAggregateNow, updateAggregateNow } from "./playlists.js";
import { syncArtistPlaylists, findMissingArtistPlaylists } from "./artistPlaylists.js";
import { renderSpotifyTopN } from "./logger.js";


const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const aggEl = document.getElementById("agglog");
const artistLogEl = document.getElementById("artistlog");
const setStatus = (txt, cls="") => { statusEl.textContent = txt; statusEl.className = "badge " + cls; };

// Buttons (no login button anymore)
document.getElementById("logout").onclick = () => { logout(); setStatus("Logged out", "warn"); location.reload(); };
document.getElementById("downloadCsv").onclick = () => downloadCSV();

document.getElementById("createAggregate").onclick = async () => {
  try { await requireTokenInteractive(); await createAggregateNow(aggEl); }
  catch (e) { aggEl.textContent = "Error: " + e.message; }
};
document.getElementById("updateAggregate").onclick = async () => {
  try { await requireTokenInteractive(); await updateAggregateNow(aggEl, { removeExtras:false }); }
  catch (e) { aggEl.textContent = "Error: " + e.message; }
};
document.getElementById("syncStrict").onclick = async () => {
  try { await requireTokenInteractive(); await updateAggregateNow(aggEl, { removeExtras:true }); }
  catch (e) { aggEl.textContent = "Error: " + e.message; }
};

document.getElementById("syncArtistPlaylists").onclick = async () => {
  try { await requireTokenInteractive(); await syncArtistPlaylists(artistLogEl, 5); }
  catch (e) { artistLogEl.textContent = "Error: " + e.message; }
};
document.getElementById("findMissingArtistPlaylists").onclick = async () => {
  try { await requireTokenInteractive(); await findMissingArtistPlaylists(artistLogEl, 7); }
  catch (e) { artistLogEl.textContent = "Error: " + e.message; }
};

document.getElementById("fetchSpotifyTop10").onclick = async () => {
  try {
    await requireTokenInteractive();
    const range = document.getElementById("topRange").value;
    await renderSpotifyTopN(document.getElementById("spotifyTop10"), 10, range);
  } catch (e) {
    document.getElementById("spotifyTop10").innerHTML = `<p class="small err">${e.message}</p>`;
  }
};


// Boot: immediately require auth; if not logged in, this will redirect to Spotify.
// After returning from Spotify, callback.html stores tokens and sends us back here.
(async function init() {
  try {
    const tok = await requireTokenInteractive(); // redirects if needed
    if (!tok) return; // navigation is happening

    setStatus("Authenticated", "ok");

    await backfill(logEl);
    renderTop(logEl);

    setInterval(async () => {
      await pollCurrent(logEl);
      renderTop(logEl);
    }, 25000);
  } catch (e) {
    // If anything fails before redirect, show a hint
    setStatus("Auth needed", "warn");
  }
})();
