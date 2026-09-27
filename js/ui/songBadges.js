function songTypeBadgesHTML(type, row) {
  const kind = type.startsWith("OP") ? "op" : type.startsWith("ED") ? "ed" : type.startsWith("IN") ? "in" : "other";
  return [
    type ? `<span class="song-type-badge song-type-${kind}">${escapeHtml(type)}</span>` : "",
    songBoolean(row.isDub) ? '<span class="song-type-badge song-type-dub" title="Dub">D</span>' : "",
    songBoolean(row.isRebroadcast) ? '<span class="song-type-badge song-type-rebroadcast" title="Rebroadcast">R</span>' : ""
  ].filter(Boolean).join(" ");
}

