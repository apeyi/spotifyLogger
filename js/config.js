export const CLIENT_ID = "c38d37dff8004817b3261dd5da3c9ab4";
export const REDIRECT_URI = "https://apeyi.github.io/spotifyLogger/"; // must match dashboard exactly
export const SCOPES = [
  "user-read-recently-played",
  "user-read-currently-playing",
  "user-read-playback-state",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public"
];

// App-wide constants
export const AGG_NAME = "All My Songs (Auto)";
export const AGG_DESC = "Automatically aggregated from all playlists I own (no duplicates).";
