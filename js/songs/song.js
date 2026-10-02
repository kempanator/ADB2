// Every source (API, CSV, AMQ JSON, and saved rows) enters the table in this shape.
// Keep extra source fields because the details view uses richer API metadata.
function optionalSongNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function songBoolean(value) {
  if (typeof value === "string") return ["true", "1"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function songArtistIds(row) {
  return [...new Set((Array.isArray(row?.artists) ? row.artists : [])
    .map(artist => optionalSongNumber(artist?.id))
    .filter(id => Number.isSafeInteger(id) && id > 0))];
}

function parseSongType(value) {
  const text = String(value ?? "").trim();
  const match = /^(opening|op|ending|ed|insert|in)(?:\s*song)?\s*(\d+)?$/i.exec(text);
  if (!match) return { category: "other", number: 0, label: text, rank: 3 };
  const prefix = match[1].toLowerCase();
  const category = ["opening", "op"].includes(prefix) ? "opening"
    : ["ending", "ed"].includes(prefix) ? "ending" : "insert";
  const rank = { opening: 0, ending: 1, insert: 2 }[category];
  const number = Number(match[2] || 0);
  const label = category === "insert" ? "IN"
    : `${category === "opening" ? "OP" : "ED"}${match[2] || ""}`;
  return { category, number, label, rank };
}

function shortSongType(value) {
  return parseSongType(value).label;
}

function formatDurationSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.floor(Math.round(n) / 60);
  const s = Math.round(n) % 60;
  const ss = String(s).padStart(2, "0");
  return `${m}:${ss}`;
}

function normalizeSongRow(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = { ...value };
  for (const field of ["annId", "annSongId", "amqSongId", "songDifficulty", "songLength"]) {
    row[field] = optionalSongNumber(value[field]);
  }
  for (const field of [
    "animeENName", "animeJPName", "animeType", "animeCategory", "animeVintage",
    "songType", "songName", "songArtist", "songComposer", "songArranger", "songCategory",
    "HQ", "MQ", "audio"
  ]) {
    row[field] = String(value[field] ?? "");
  }
  row.isDub = songBoolean(value.isDub);
  row.isRebroadcast = songBoolean(value.isRebroadcast);

  const ids = value.linked_ids && typeof value.linked_ids === "object" ? value.linked_ids : {};
  row.linked_ids = { ...ids };
  for (const field of ["anilist", "myanimelist", "kitsu", "anidb"]) {
    row.linked_ids[field] = optionalSongNumber(ids[field]);
  }
  return row;
}

function songAnimeTitle(row, language) {
  return language === "romaji"
    ? (row.animeJPName || row.animeENName || "")
    : (row.animeENName || row.animeJPName || "");
}

function broadcastText(d) {
  if (d.isDub && d.isRebroadcast) return "Dub/Rebroadcast";
  if (d.isDub) return "Dub";
  if (d.isRebroadcast) return "Rebroadcast";
  return "Normal";
}
