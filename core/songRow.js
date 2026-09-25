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

function shortSongType(value) {
  const type = String(value || "").trim();
  const upper = type.toUpperCase();
  const digits = [...type].filter(char => char >= "0" && char <= "9").join("");
  if (upper.startsWith("OPENING") || upper.startsWith("OP")) return `OP${digits}`;
  if (upper.startsWith("ENDING") || upper.startsWith("ED")) return `ED${digits}`;
  if (upper.startsWith("INSERT") || upper.startsWith("IN")) return "IN";
  return type;
}

function songTypeBadgesHTML(type, row) {
  const kind = type.startsWith("OP") ? "op" : type.startsWith("ED") ? "ed" : type.startsWith("IN") ? "in" : "other";
  return [
    type ? `<span class="song-type-badge song-type-${kind}">${escapeHtml(type)}</span>` : "",
    songBoolean(row.isDub) ? '<span class="song-type-badge song-type-dub" title="Dub">D</span>' : "",
    songBoolean(row.isRebroadcast) ? '<span class="song-type-badge song-type-rebroadcast" title="Rebroadcast">R</span>' : ""
  ].filter(Boolean).join(" ");
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
