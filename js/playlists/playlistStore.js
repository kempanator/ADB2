class PlaylistStore {
  constructor({ storageKey }) {
    Object.assign(this, { storageKey });
  }

  songRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const annSongId = optionalSongNumber(value.annSongId);
    if (!Number.isSafeInteger(annSongId) || annSongId <= 0) return null;
    return {
      annSongId,
      songName: typeof value.songName === "string" ? value.songName.trim() : "",
      songArtist: typeof value.songArtist === "string" ? value.songArtist.trim() : ""
    };
  }

  createPlaylistId(playlists) {
    let id;
    do {
      id = `playlist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    } while (Object.hasOwn(playlists, id));
    return id;
  }

  loadAllPlaylists() {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) return Object.create(null);
      const playlists = Object.assign(Object.create(null), Object.fromEntries(Object.entries(value)
        .map(([id, playlist]) => [id, this.normalizePlaylist(playlist)])
        .filter(([, playlist]) => playlist)));
      if (Object.entries(value).some(([id, playlist]) => playlists[id] && !Array.isArray(playlist.songs))) {
        try { this.saveAllPlaylists(playlists); } catch { /* Keep legacy playlists readable if storage is unavailable. */ }
      }
      return playlists;
    } catch {
      return Object.create(null);
    }
  }

  normalizePlaylist(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (!name) return null;
    const source = Array.isArray(value.songs) ? value.songs
      : Array.isArray(value.annSongIds) ? value.annSongIds.map(annSongId => ({ annSongId })) : null;
    if (!source) return null;
    const songs = source.map(song => this.songRecord(song));
    if (songs.some(song => !song)) return null;
    const validDate = date => typeof date === "string" && Number.isFinite(Date.parse(date));
    const playlist = {
      name,
      songs,
      songCount: songs.length,
      createdAt: validDate(value.createdAt) ? value.createdAt
        : validDate(value.createdOn) ? value.createdOn : new Date().toISOString()
    };
    if (validDate(value.updatedAt)) playlist.updatedAt = value.updatedAt;
    return playlist;
  }

  saveAllPlaylists(playlists) {
    const normalized = Object.create(null);
    for (const [id, value] of Object.entries(playlists)) {
      const playlist = this.normalizePlaylist(value);
      if (!playlist) throw new Error(`Invalid playlist: ${id}`);
      normalized[id] = playlist;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(normalized));
  }

  loadPlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    return playlists[playlistId] || null;
  }

  clear() {
    localStorage.removeItem(this.storageKey);
  }
}
