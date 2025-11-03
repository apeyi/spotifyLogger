const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const g = (k, d=null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function getPlays() { return g("plays", {}); }
export function setPlays(obj) { s("plays", obj); }
export function getLastBackfillTs() { return g("last_backfill_ts", 0); }
export function setLastBackfillTs(ts) { s("last_backfill_ts", ts); }
