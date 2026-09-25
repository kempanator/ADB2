class PlaylistManager {
  // Playlists are persisted in one place; callers always read the current copy.
  constructor() {
    this.storageKey = PLAYLIST_STORAGE_KEY;
    this.autoAddPlaylistId = null;
    this.lastSelectedPlaylistId = "";
    this.metadataRequests = new Map();
    this.attemptedMetadataIds = new Set();

    // Listen for events from EventBus
    eventBus.on("playlist:add-song", (data) => {
      const songData = tableManager.model.getRow(data.songId);

      if (!songData || !songData.annSongId) {
        if (!this.autoAddPlaylistId) showAlert("Cannot add song to playlist - missing ANN Song ID", "warning");
        return;
      }

      // Check for auto-add playlists first
      const autoAddPlaylist = this.getAutoAddPlaylist();
      if (autoAddPlaylist) {
        this.toggleSongInPlaylist(autoAddPlaylist.id, songData);
        return;
      }

      eventBus.emit("playlist:selection-open", songData);
    });
  }

  // Keep only the song fields a playlist needs for display and fetching.
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

  // Create and save a new playlist with ordered song records.
  savePlaylist(name, songRows) {
    const playlists = this.loadAllPlaylists();
    const playlistId = this.createPlaylistId(playlists);
    const songs = (Array.isArray(songRows) ? songRows : []).map(row => this.songRecord(row)).filter(Boolean);

    const playlist = {
      name: name,
      songs,
      songCount: songs.length,
      createdAt: new Date().toISOString()
    };

    playlists[playlistId] = playlist;
    this.saveAllPlaylists(playlists);
    eventBus.emit("playlists:changed", { selectedPlaylistId: playlistId });

    return playlistId;
  }

  // Replace a playlist's contents with current table data
  replacePlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[playlistId];

    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    const songs = tableManager.model.getDisplayData().map(row => this.songRecord(row)).filter(Boolean);

    if (songs.length === 0) {
      showAlert("No valid songs in current table to save", "warning");
      return;
    }

    // Update playlist with new data
    playlist.songs = songs;
    playlist.songCount = songs.length;
    playlist.updatedAt = new Date().toISOString();

    // Save updated playlist
    this.saveAllPlaylists(playlists);
    if (this.autoAddPlaylistId === playlistId) this.publishAutoAddState();

    eventBus.emit("playlists:changed");

    showAlert(`Playlist "${playlist.name}" replaced with ${songs.length} songs`, "success");
  }

  // Load all playlists from localStorage and return as object
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

  importPlaylists(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Playlist import must contain a playlist object.");
    }
    const imported = Object.create(null);
    for (const [id, value] of Object.entries(data)) {
      const playlist = this.normalizePlaylist(value);
      if (!id || !playlist) throw new Error(`Invalid imported playlist: ${id || "missing ID"}`);
      imported[id] = playlist;
    }
    this.saveAllPlaylists({ ...this.loadAllPlaylists(), ...imported });
    if (this.autoAddPlaylistId && Object.hasOwn(imported, this.autoAddPlaylistId)) this.publishAutoAddState();
    eventBus.emit("playlists:changed");
    return Object.values(imported);
  }

  // The AnisongDB frontend exports one playlist without a type/data wrapper.
  importExternalPlaylist(value) {
    const playlist = this.normalizePlaylist(value);
    if (!playlist) throw new Error("Invalid playlist export.");
    const playlists = this.loadAllPlaylists();
    const id = this.createPlaylistId(playlists);
    playlists[id] = playlist;
    this.saveAllPlaylists(playlists);
    eventBus.emit("playlists:changed", { selectedPlaylistId: id });
    return playlist;
  }

  // Load a specific playlist by ID from localStorage
  loadPlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    return playlists[playlistId] || null;
  }

  // Delete a playlist by ID and clear auto-add state if needed
  deletePlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    if (!Object.hasOwn(playlists, playlistId)) return;
    delete playlists[playlistId];
    this.saveAllPlaylists(playlists);

    // If the deleted playlist was the auto-add playlist, clear the auto-add state
    if (this.autoAddPlaylistId === playlistId) {
      this.autoAddPlaylistId = null;
      this.publishAutoAddState();
    }
    eventBus.emit("playlists:changed");
  }

  // Rename a playlist by ID with the new name
  renamePlaylist(playlistId, newName) {
    const playlists = this.loadAllPlaylists();
    if (playlists[playlistId]) {
      playlists[playlistId].name = newName;
      this.saveAllPlaylists(playlists);
      eventBus.emit("playlists:changed");
    }
  }

  // Apply a song membership change once, including its count and update time.
  changePlaylistSong(playlistId, songData, mode) {
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[playlistId];
    if (!playlist) return { status: "missing" };
    const song = this.songRecord(songData);
    if (!song) return { status: "invalid" };

    const songIndex = playlist.songs.findIndex(item => item.annSongId === song.annSongId);
    if (songIndex !== -1 && mode === "add") return { status: "already", playlist };
    if (songIndex === -1) playlist.songs.push(song);
    else playlist.songs.splice(songIndex, 1);
    playlist.songCount = playlist.songs.length;
    playlist.updatedAt = new Date().toISOString();
    this.saveAllPlaylists(playlists);

    if (this.autoAddPlaylistId === playlistId) this.publishAutoAddState();
    eventBus.emit("playlists:changed");
    return { status: songIndex === -1 ? "added" : "removed", playlist };
  }

  // Add a song from the selection modal; duplicates remain a warning.
  addSongToPlaylist(playlistId, songData) {
    const { status, playlist } = this.changePlaylistSong(playlistId, songData, "add");
    if (status === "missing") return showAlert("Playlist not found", "error");
    if (status === "invalid") return showAlert("Cannot add song to playlist - missing ANN Song ID", "warning");
    if (status === "already") return showAlert("Song is already in this playlist", "warning");

    eventBus.emit("playlist:selection-close");
    showAlert(`Song added to playlist "${playlist.name}"`, "success");
  }

  // Auto-add table buttons toggle membership in the active playlist.
  toggleSongInPlaylist(playlistId, songData) {
    const { status } = this.changePlaylistSong(playlistId, songData, "toggle");
    if (status === "missing") this.publishAutoAddState();
  }

  // Get the currently active auto-add playlist or null if none
  getAutoAddPlaylist() {
    if (!this.autoAddPlaylistId) return null;
    const playlists = this.loadAllPlaylists();
    const playlist = playlists[this.autoAddPlaylistId];
    return playlist ? { id: this.autoAddPlaylistId, ...playlist } : null;
  }

  getAutoAddPlaylistId() {
    return this.autoAddPlaylistId;
  }

  getLastSelectedPlaylistId() {
    return this.lastSelectedPlaylistId;
  }

  setLastSelectedPlaylistId(playlistId) {
    this.lastSelectedPlaylistId = playlistId;
  }

  publishAutoAddState() {
    const active = this.getAutoAddPlaylist();
    if (!active) this.autoAddPlaylistId = null;
    eventBus.emit("playlist:auto-add-state-changed", active?.songs.map(song => song.annSongId) ?? null);
  }

  // Toggle auto-add functionality for a specific playlist
  toggleAutoAddPlaylist(playlistId) {
    const playlists = this.loadAllPlaylists();
    if (!playlists[playlistId]) return;

    this.autoAddPlaylistId = this.autoAddPlaylistId === playlistId ? null : playlistId;

    this.publishAutoAddState();
    eventBus.emit("playlists:changed");
  }

  // Load a playlist's songs into the table by fetching song data in chunks
  loadPlaylistIntoTable(playlistId) {
    const playlist = this.loadPlaylist(playlistId);
    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    // Load playlist as a new table
    this.loadAnnSongIdsIntoTable(playlist.songs.map(song => song.annSongId), false, playlist.name);
  }

  // Fill display metadata in legacy playlists without changing their order or edit date.
  hydratePlaylistMetadata(playlistId, { retry = false } = {}) {
    if (this.metadataRequests.has(playlistId)) return this.metadataRequests.get(playlistId);
    const playlist = this.loadPlaylist(playlistId);
    if (!playlist) return Promise.resolve(null);
    const ids = [...new Set(playlist.songs
      .filter(song => (!song.songName || !song.songArtist) && (retry || !this.attemptedMetadataIds.has(song.annSongId)))
      .map(song => song.annSongId))];
    if (!ids.length) return Promise.resolve(playlist);

    const request = (async () => {
      try {
        const rows = await apiClient.fetchRowsByAnnSongIds(ids);
        ids.forEach(id => this.attemptedMetadataIds.add(id));
        const byId = new Map(rows.map(row => [Number(row.annSongId), this.songRecord(row)]));
        const playlists = this.loadAllPlaylists();
        const current = playlists[playlistId];
        if (!current) return null;
        let changed = false;
        for (const song of current.songs) {
          const found = byId.get(song.annSongId);
          if (!found) continue;
          for (const field of ["songName", "songArtist"]) {
            if (!song[field] && found[field]) {
              song[field] = found[field];
              changed = true;
            }
          }
        }
        if (changed) {
          this.saveAllPlaylists(playlists);
          eventBus.emit("playlists:changed");
        }
        return current;
      } catch {
        // An offline API should not prevent using or exporting a saved playlist.
        return this.loadPlaylist(playlistId);
      } finally {
        this.metadataRequests.delete(playlistId);
      }
    })();
    this.metadataRequests.set(playlistId, request);
    return request;
  }

  // Helper: load songs for a list of ANN Song IDs
  loadAnnSongIdsIntoTable(annSongIds, isAppend = false, name = "playlist") {
    const ids = Array.isArray(annSongIds) ? annSongIds.map(n => Number(n)).filter(Number.isFinite) : [];
    if (ids.length === 0) {
      showAlert("No ANN Song IDs to load", "warning");
      return;
    }

    tableRequestManager.run(signal => apiClient.fetchRowsByAnnSongIds(ids, signal), isAppend, {
      onSuccess: rows => {
        const label = name ? `\"${name}\"` : "playlist";
        showAlert(`Loaded ${rows.length} song${rows.length === 1 ? "" : "s"} from ${label}`, "success");
      }
    });
  }

  // Export a single playlist as JSON file with playlist metadata
  async exportPlaylist(playlistId) {
    await this.hydratePlaylistMetadata(playlistId, { retry: true });
    const playlist = this.loadPlaylist(playlistId);
    if (!playlist) {
      showAlert("Playlist not found", "error");
      return;
    }

    // Create export data with playlist info
    const exportData = {
      type: "playlist",
      data: {
        [playlistId]: playlist
      }
    };

    const filename = `${playlist.name.replace(/[^a-z0-9 _.-]+/gi, "")}_playlist.json`;
    ioManager.downloadFile(JSON.stringify(exportData, null, 2), filename, "application/json");

    showAlert(`Playlist "${playlist.name}" exported successfully`, "success");
  }

  // Export all playlists as a single JSON file with metadata
  async exportAllPlaylists() {
    for (const id of Object.keys(this.loadAllPlaylists())) {
      await this.hydratePlaylistMetadata(id, { retry: true });
    }
    const playlists = this.loadAllPlaylists();
    if (Object.keys(playlists).length === 0) {
      showAlert("No playlists to export", "warning");
      return;
    }

    // Create export data with all playlists
    const exportData = {
      type: "playlists",
      data: playlists
    };

    const filename = `adb2_playlists_${new Date().toISOString().slice(0, 10)}.json`;
    ioManager.downloadFile(JSON.stringify(exportData, null, 2), filename, "application/json");

    showAlert(`Exported ${Object.keys(playlists).length} playlists successfully`, "success");
  }

  // Delete all playlists after user confirmation
  deleteAllPlaylists() {
    if (confirm("Are you sure you want to delete all playlists? This action cannot be undone.")) {
      localStorage.removeItem(this.storageKey);
      this.autoAddPlaylistId = null;
      this.publishAutoAddState();
      eventBus.emit("playlists:changed");
      showAlert("All playlists have been deleted", "success");
    }
  }
}

const playlistManager = new PlaylistManager();
