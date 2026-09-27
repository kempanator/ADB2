class PlaylistController {
  constructor({ api, choosePlaylist, closePlaylistSelection, events, notify, playlistStore, results, resultsLoader }) {
    Object.assign(this, { api, choosePlaylist, closePlaylistSelection, events, notify, playlistStore, results, resultsLoader });
    this.autoAddPlaylistId = null;
    this.lastSelectedPlaylistId = "";
    this.metadataRequests = new Map();
    this.attemptedMetadataIds = new Map();
  }

  addFromResults(rowKey) {
    const songData = this.results.model.getRow(rowKey);

    if (!songData || !songData.annSongId) {
      if (!this.autoAddPlaylistId) this.notify("Cannot add song to playlist - missing ANN Song ID", "warning");
      return;
    }

    const autoAddPlaylist = this.getAutoAddPlaylist();
    if (autoAddPlaylist) {
      this.toggleSongInPlaylist(autoAddPlaylist.id, songData);
      return;
    }

    this.choosePlaylist(songData);
  }

  savePlaylist(name, songRows) {
    const records = this.playlistStore.loadAllPlaylists();
    const playlistId = this.playlistStore.createPlaylistId(records);
    const songs = (Array.isArray(songRows) ? songRows : []).map(row => this.playlistStore.songRecord(row)).filter(Boolean);

    const playlist = {
      name: name,
      songs,
      songCount: songs.length,
      createdAt: new Date().toISOString()
    };

    records[playlistId] = playlist;
    this.playlistStore.saveAllPlaylists(records);
    this.events.emit("playlists:changed", { selectedPlaylistId: playlistId });

    return playlistId;
  }

  replacePlaylist(playlistId) {
    const records = this.playlistStore.loadAllPlaylists();
    const playlist = records[playlistId];

    if (!playlist) {
      this.notify("Playlist not found", "error");
      return;
    }

    const songs = this.results.model.getDisplayData().map(row => this.playlistStore.songRecord(row)).filter(Boolean);

    if (songs.length === 0) {
      this.notify("No valid songs in current table to save", "warning");
      return;
    }

    playlist.songs = songs;
    playlist.songCount = songs.length;
    playlist.updatedAt = new Date().toISOString();

    this.playlistStore.saveAllPlaylists(records);
    if (this.autoAddPlaylistId === playlistId) this.publishAutoAddState();

    this.events.emit("playlists:changed");

    this.notify(`Playlist "${playlist.name}" replaced with ${songs.length} songs`, "success");
  }

  importPlaylists(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Playlist import must contain a playlist object.");
    }
    const imported = Object.create(null);
    for (const [id, value] of Object.entries(data)) {
      const playlist = this.playlistStore.normalizePlaylist(value);
      if (!id || !playlist) throw new Error(`Invalid imported playlist: ${id || "missing ID"}`);
      imported[id] = playlist;
    }
    this.playlistStore.saveAllPlaylists({ ...this.playlistStore.loadAllPlaylists(), ...imported });
    for (const id of Object.keys(imported)) this.attemptedMetadataIds.delete(id);
    if (this.autoAddPlaylistId && Object.hasOwn(imported, this.autoAddPlaylistId)) this.publishAutoAddState();
    this.events.emit("playlists:changed");
    return Object.values(imported);
  }

  // The AnisongDB frontend exports one playlist without a type/data wrapper.
  importExternalPlaylist(value) {
    const playlist = this.playlistStore.normalizePlaylist(value);
    if (!playlist) throw new Error("Invalid playlist export.");
    const records = this.playlistStore.loadAllPlaylists();
    const id = this.playlistStore.createPlaylistId(records);
    records[id] = playlist;
    this.playlistStore.saveAllPlaylists(records);
    this.events.emit("playlists:changed", { selectedPlaylistId: id });
    return playlist;
  }

  deletePlaylist(playlistId) {
    const records = this.playlistStore.loadAllPlaylists();
    if (!Object.hasOwn(records, playlistId)) return;
    delete records[playlistId];
    this.attemptedMetadataIds.delete(playlistId);
    this.playlistStore.saveAllPlaylists(records);

    if (this.autoAddPlaylistId === playlistId) {
      this.autoAddPlaylistId = null;
      this.publishAutoAddState();
    }
    this.events.emit("playlists:changed");
  }

  renamePlaylist(playlistId, newName) {
    const records = this.playlistStore.loadAllPlaylists();
    if (records[playlistId]) {
      records[playlistId].name = newName;
      this.playlistStore.saveAllPlaylists(records);
      this.events.emit("playlists:changed");
    }
  }

  changePlaylistSong(playlistId, songData, mode) {
    const records = this.playlistStore.loadAllPlaylists();
    const playlist = records[playlistId];
    if (!playlist) return { status: "missing" };
    const song = this.playlistStore.songRecord(songData);
    if (!song) return { status: "invalid" };

    const songIndex = playlist.songs.findIndex(item => item.annSongId === song.annSongId);
    if (songIndex !== -1 && mode === "add") return { status: "already", playlist };
    if (songIndex === -1) playlist.songs.push(song);
    else playlist.songs = playlist.songs.filter(item => item.annSongId !== song.annSongId);
    playlist.songCount = playlist.songs.length;
    playlist.updatedAt = new Date().toISOString();
    this.playlistStore.saveAllPlaylists(records);

    if (this.autoAddPlaylistId === playlistId) this.publishAutoAddState();
    this.events.emit("playlists:changed");
    return { status: songIndex === -1 ? "added" : "removed", playlist };
  }

  addSongToPlaylist(playlistId, songData) {
    const { status, playlist } = this.changePlaylistSong(playlistId, songData, "add");
    if (status === "missing") return this.notify("Playlist not found", "error");
    if (status === "invalid") return this.notify("Cannot add song to playlist - missing ANN Song ID", "warning");
    if (status === "already") return this.notify("Song is already in this playlist", "warning");

    this.closePlaylistSelection();
    this.notify(`Song added to playlist "${playlist.name}"`, "success");
  }

  toggleSongInPlaylist(playlistId, songData) {
    const { status } = this.changePlaylistSong(playlistId, songData, "toggle");
    if (status === "missing") this.publishAutoAddState();
  }

  getAutoAddPlaylist() {
    if (!this.autoAddPlaylistId) return null;
    const records = this.playlistStore.loadAllPlaylists();
    const playlist = records[this.autoAddPlaylistId];
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
    this.events.emit("playlist:auto-add-state-changed", active?.songs.map(song => song.annSongId) ?? null);
  }

  toggleAutoAddPlaylist(playlistId) {
    const records = this.playlistStore.loadAllPlaylists();
    if (!records[playlistId]) return;

    this.autoAddPlaylistId = this.autoAddPlaylistId === playlistId ? null : playlistId;

    this.publishAutoAddState();
    this.events.emit("playlists:changed");
  }

  loadPlaylistResults(playlistId) {
    const playlist = this.playlistStore.loadPlaylist(playlistId);
    if (!playlist) {
      this.notify("Playlist not found", "error");
      return;
    }

    return this.loadSongIds(playlist.songs.map(song => song.annSongId), false, playlist.name);
  }

  // Fill display metadata in legacy playlists without changing their order or edit date.
  hydratePlaylistMetadata(playlistId, { retry = false } = {}) {
    if (this.metadataRequests.has(playlistId)) return this.metadataRequests.get(playlistId);
    const playlist = this.playlistStore.loadPlaylist(playlistId);
    if (!playlist) return Promise.resolve(null);
    const attempted = this.attemptedMetadataIds.get(playlistId) || new Set();
    this.attemptedMetadataIds.set(playlistId, attempted);
    const ids = [...new Set(playlist.songs
      .filter(song => (!song.songName || !song.songArtist) && (retry || !attempted.has(song.annSongId)))
      .map(song => song.annSongId))];
    if (!ids.length) return Promise.resolve(playlist);

    const request = (async () => {
      try {
        const rows = await this.api.getSongsByAnnIds(ids);
        ids.forEach(id => attempted.add(id));
        const byId = new Map(rows.map(row => [Number(row.annSongId), this.playlistStore.songRecord(row)]));
        const records = this.playlistStore.loadAllPlaylists();
        const current = records[playlistId];
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
          this.playlistStore.saveAllPlaylists(records);
          this.events.emit("playlists:changed");
        }
        return current;
      } catch {
        // An offline API should not prevent using or exporting a saved playlist.
        return this.playlistStore.loadPlaylist(playlistId);
      } finally {
        this.metadataRequests.delete(playlistId);
      }
    })();
    this.metadataRequests.set(playlistId, request);
    return request;
  }

  loadSongIds(annSongIds, isAppend = false, name = "playlist") {
    const ids = Array.isArray(annSongIds) ? annSongIds.map(n => Number(n)).filter(id => Number.isSafeInteger(id) && id > 0) : [];
    if (ids.length === 0) {
      this.notify("No ANN Song IDs to load", "warning");
      return;
    }

    return this.resultsLoader.run(signal => this.api.getSongsByAnnIds(ids, signal), isAppend, {
      onSuccess: rows => {
        const label = name ? `\"${name}\"` : "playlist";
        this.notify(`Loaded ${rows.length} song${rows.length === 1 ? "" : "s"} from ${label}`, "success");
      }
    });
  }

  async exportPlaylist(playlistId) {
    await this.hydratePlaylistMetadata(playlistId, { retry: true });
    const playlist = this.playlistStore.loadPlaylist(playlistId);
    if (!playlist) {
      this.notify("Playlist not found", "error");
      return;
    }

    const exportData = {
      type: "playlist",
      data: {
        [playlistId]: playlist
      }
    };

    const filename = `${playlist.name.replace(/[^a-z0-9 _.-]+/gi, "")}_playlist.json`;
    downloadFile(JSON.stringify(exportData, null, 2), filename, "application/json");

    this.notify(`Playlist "${playlist.name}" exported successfully`, "success");
  }

  async exportAllPlaylists() {
    for (const id of Object.keys(this.playlistStore.loadAllPlaylists())) {
      await this.hydratePlaylistMetadata(id, { retry: true });
    }
    const records = this.playlistStore.loadAllPlaylists();
    if (Object.keys(records).length === 0) {
      this.notify("No playlists to export", "warning");
      return;
    }

    const exportData = {
      type: "playlists",
      data: records
    };

    const filename = `adb2_playlists_${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(JSON.stringify(exportData, null, 2), filename, "application/json");

    this.notify(`Exported ${Object.keys(records).length} playlists successfully`, "success");
  }

  // Confirmation belongs to the calling view.
  deleteAllPlaylists() {
    this.playlistStore.clear();
    this.attemptedMetadataIds.clear();
    this.autoAddPlaylistId = null;
    this.publishAutoAddState();
    this.events.emit("playlists:changed");
    this.notify("All playlists have been deleted", "success");
  }
}
