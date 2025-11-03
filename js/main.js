import { requireTokenInteractive, logout } from "./auth.js";
import { api } from "./api.js"; // optional import just to confirm connectivity if you want
import { backfill, pollCurrent, renderTop, downloadCSV } from "./logger.js";
import { createAggregateNow, updateAggregateNow } from "./playlists.js";
import { syncArtistPlaylists, findMissingArtistPlaylists } from "./artistPlaylists.js";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const aggEl = document.getElementById("agglog");
const artistLogEl = document.getElementById("artistlog");
const setStatus = (txt, cls="") => { statusEl.textContent = txt; statusEl.className = "badge " + cls; };

// Buttons
document.getElementById("login").onclick = async () => {
  try { await requireTokenInteractive(); } catch (e) { setStatus("Auth error", "err"); alert(e.message); }
};
document.getElementById("logout").onclick = () => { logout(); setStatus("Logged out", "warn"); };
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

// Boot
(async function init(){
  try {
    // handle ?code=... exchange if returning from Spotify
    await requireTokenInteractive(); // will redirect if not logged in
    setStatus("Authenticated", "ok");

    await backfill(logEl);
    renderTop(logEl);

    setInterval(async () => {
      await pollCurrent(logEl);
      renderTop(logEl);
    }, 25000);
  } catch (e) {
    setStatus("Not authenticated");
    // It's okay—user will click Log in.
  }
})();
