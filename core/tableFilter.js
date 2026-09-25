// Build a reusable predicate once per client filter operation.
function createTableMatcher({ field = "Anime", query = "", partial = false, match_case = false }, language) {
  const raw = String(query);
  const normalize = value => match_case ? String(value ?? "") : String(value ?? "").toLowerCase();
  const term = normalize(raw);
  const textMatch = value => partial ? normalize(value).includes(term) : normalize(value) === term;
  const canonicalType = value => {
    const type = String(value || "").toUpperCase().trim();
    if (type.startsWith("OPENING") || type.startsWith("OP")) return "OP";
    if (type.startsWith("ENDING") || type.startsWith("ED")) return "ED";
    if (type.startsWith("INSERT") || type.startsWith("IN")) return "IN";
    return type;
  };
  const range = (() => {
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(raw.trim());
    if (match) return [Math.min(Number(match[1]), Number(match[2])), Math.max(Number(match[1]), Number(match[2]))];
    return /^\d+$/.test(raw.trim()) ? [Number(raw.trim()), Number(raw.trim())] : null;
  })();
  const annIds = new Set(raw.split(",").map(value => value.trim()).filter(value => /^\d+$/.test(value)).map(Number));
  const fieldName = String(field);

  return row => {
    switch (fieldName) {
      case "Anime": return textMatch(tableAnimeTitle(row, language));
      case "Anime Type": return textMatch(row.animeType);
      case "Artist": return textMatch(row.songArtist);
      case "Song": return textMatch(row.songName);
      case "Composer": return textMatch(row.songComposer);
      case "Arranger": return textMatch(row.songArranger);
      case "Season": {
        const vintage = String(row.animeVintage || "");
        const year = vintage.match(/\d{4}/)?.[0];
        const years = /^(\d{4})\s*-\s*(\d{4})$/.exec(raw.trim());
        if (years) return Boolean(year) && Number(year) >= Math.min(Number(years[1]), Number(years[2]))
          && Number(year) <= Math.max(Number(years[1]), Number(years[2]));
        if (/^\d{4}$/.test(raw.trim())) return year === raw.trim();
        return vintage.toLowerCase().includes(raw.trim().toLowerCase());
      }
      case "Song Type": return canonicalType(row.songType) === canonicalType(raw);
      case "Broadcast Type": return broadcastText(row).toLowerCase() === raw.toLowerCase();
      case "Song Category": return String(row.songCategory || "").toLowerCase() === raw.toLowerCase();
      case "ANN ID": return annIds.has(Number(row.annId));
      case "Difficulty":
      case "Length": {
        if (!range) return false;
        const value = fieldName === "Difficulty" ? row.songDifficulty : row.songLength;
        if (value == null || value === "") return false;
        const number = Number(value);
        return Number.isFinite(number) && number >= range[0] && number <= range[1];
      }
      default: return false;
    }
  };
}
