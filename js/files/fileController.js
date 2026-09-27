class FileController {
  constructor({ notify, playlists, results, settings, songFileFormats }) {
    Object.assign(this, { notify, playlists, results, settings, songFileFormats });
  }

  exportResults(format) {
    const rows = this.results.model.getDisplayData();
    if (!rows.length) return this.notify("No data to export", "warning");
    const content = format === "csv" ? this.songFileFormats.serializeCSV(rows) : JSON.stringify(rows, null, 2);
    downloadFile(content, `adb2_songs_${new Date().toISOString().slice(0, 10)}.${format}`,
      format === "csv" ? "text/csv" : "application/json");
  }

  exportSettings() {
    const data = {
      type: "settings",
      timestamp: new Date().toISOString(),
      data: this.settings.settings
    };

    downloadFile(JSON.stringify(data, null, 2),
      `adb2_settings_${new Date().toISOString().slice(0, 10)}.json`, "application/json");

    this.notify("Settings exported successfully", "success");
  }

  async importPreferences(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed?.type === "settings" && parsed.data) {
        this.settings.update(parsed.data, true, { replace: true });
        this.notify("Settings imported successfully", "success");

      } else if ((parsed?.type === "playlists" || parsed?.type === "playlist") && parsed.data) {
        const imported = this.playlists.importPlaylists(parsed.data);

        if (parsed.type === "playlist") {
          const playlistName = imported[0]?.name || "Unknown";
          this.notify(`Playlist "${playlistName}" imported successfully`, "success");
        } else {
          this.notify("Playlists imported successfully", "success");
        }

      } else if (parsed && typeof parsed.name === "string" && Array.isArray(parsed.annSongIds)) {
        const playlist = this.playlists.importExternalPlaylist(parsed);
        this.notify(`Playlist "${playlist.name}" imported successfully`, "success");
      } else {
        throw new Error("Unsupported JSON file. Choose a settings or playlist export.");
      }

    } catch (err) {
      this.notify(`Import failed: ${err.message}`, "danger");
    }
  }

  async importSongs(file) {
    if (!file) return;
    const isAppend = this.results.resultMode === "append";
    this.results.invalidatePendingWork();
    const generation = this.results.revision;
    try {
      const text = await file.text();
      if (generation !== this.results.revision) return;

      const result = this.songFileFormats.parseUploadText({ name: file.name, type: file.type }, text);
      if (result.kind === "error") {
        this.notify(result.message || "Invalid file format.", "danger");
        return;
      }
      if (result.kind === "playlist") {
        return this.playlists.loadSongIds(result.ids, isAppend, result.name || "playlist");
      } else if (result.kind === "rows") {
        if (isAppend) this.results.appendData(result.rows); else this.results.loadData(result.rows);
      }
    } catch (err) {
      if (generation !== this.results.revision) return;
      this.notify(`Upload failed: ${err.message || err}`, "danger");
    }
  }
}
