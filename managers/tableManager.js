class TableManager {
  // Initialize table manager with table, settings, and audio player references
  constructor() {
    this.model = new TableModel(settingsManager.get("language"));
    this.table = new TableComponent(this.model);
    this.tableGeneration = 0;
    this.tasks = new TableTasks(this);

    // Listen for events from EventBus
    eventBus.on("song:remove", (songId) => {
      this.removeRow(songId);
    });

    eventBus.on("table:sort", (data) => {
      const col = data.column;
      if (!TableColumns[col]?.sort) return;
      this.bumpTableGeneration();
      this.model.toggleSort(col);
      this.table.render();
    });

    eventBus.on("table:shuffle", () => {
      this.shuffle();
    });

    eventBus.on("table:reverse", () => {
      this.reverse();
    });

    eventBus.on("table:clear", () => {
      this.clearData();
    });
    // Client filter apply: operate on visible rows
    eventBus.on("table:client-filter-apply", (payload) => {
      this.applyClientFilter(payload);
    });

    // React to settings changes
    eventBus.on("settings:table-layout-changed", () => {
      this.model.setLanguage(settingsManager.get("language"));
      this.table.render();
    });
    eventBus.on("ui:column-visibility-changed", () => this.table.applyColumnVisibility());
    eventBus.on("settings:zebraStripe-changed", () => this.table.applyZebraStripe());

    // React to row reorder events from the table component
    eventBus.on("table:reordered", ({ order }) => {
      this.bumpTableGeneration();
      this.model.reorder(order);
      this.table.render();
    });

    eventBus.on("table:move-row", ({ key, direction }) => {
      const order = this.model.getDisplayKeys();
      const index = order.indexOf(key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]];
      this.bumpTableGeneration();
      this.model.reorder(order);
      this.table.render();
    });

    // Link checker start/stop
    eventBus.on("table:check-links-toggle", () => {
      if (this.tasks.linkCheckState.running) {
        this.tasks.stopLinkCheck();
      } else {
        this.tasks.startLinkCheck();
      }
    });

    // Redownload table task start/stop
    eventBus.on("table:redownload-toggle", () => {
      if (this.tasks.redownloadState.running) {
        this.tasks.stopRedownload();
      } else {
        this.tasks.startRedownload();
      }
    });

    // Check Song IDs task
    eventBus.on("table:check-song-ids", () => {
      const visible = this.model.getVisibleData();
      const total = visible.length;
      const idToKeys = new Map();
      let missing = 0;
      // Build map of annSongId -> [rowKey,...]
      visible.forEach(row => {
        const id = row.annSongId;
        if (id == null || id === "") { missing++; return; }
        const k = String(id);
        const arr = idToKeys.get(k) || [];
        arr.push(this.getKeyForRow(row));
        idToKeys.set(k, arr);
      });

      const duplicateKeys = [];
      let duplicateBuckets = 0;
      idToKeys.forEach(keys => {
        if (keys.length > 1) {
          duplicateBuckets++;
          duplicateKeys.push(...keys);
        }
      });
      eventBus.emit("table:duplicate-ids-checked", { keys: duplicateKeys });

      const uniqueCount = idToKeys.size;
      const msg = `ANN Song IDs — Unique: ${uniqueCount}, Duplicates: ${duplicateBuckets}, Missing: ${missing}`;
      const allGood = duplicateBuckets === 0 && missing === 0 && uniqueCount === total;
      showAlert(msg, allGood ? "success" : "warning");
    });
  }

  bumpTableGeneration() {
    this.tableGeneration++;
    eventBus.emit("table:changed");
    this.tasks.cancelAll();
  }

  // Load new data into the table, replacing all existing data
  loadData(data) {
    this.bumpTableGeneration();
    this.model.replace(data);
    this.table.render();
  }

  // Append new data to the existing table data
  appendData(data) {
    this.bumpTableGeneration();
    this.model.add(data);
    this.table.render();
  }

  // Clear all data from the table and reset state
  clearData() {
    this.bumpTableGeneration();
    this.model.clear();
    this.table.render();
  }

  // Apply a client filter to the currently visible rows.
  applyClientFilter(payload) {
    const matches = createTableMatcher(payload, settingsManager.get("language"));
    const removeMatches = String(payload.action || "keep").toLowerCase() === "remove";
    const removed = this.model.removeWhere(row => matches(row) === removeMatches);
    if (!removed.length) return;
    this.bumpTableGeneration();
    this.table.render();
  }

  // Shuffle the table rows and update state to match
  shuffle() {
    this.bumpTableGeneration();
    this.model.shuffle();
    this.table.render();
  }

  // Reverse the table rows and update state to match
  reverse() {
    this.bumpTableGeneration();
    this.model.reverse();
    this.table.render();
  }

  // Export table data in the specified format (csv or json)
  export(format) {
    const data = this.model.getDisplayData();
    if (format === "csv") {
      ioManager.exportAsCSV(data);
    } else if (format === "json") {
      ioManager.exportAsJSON(data);
    }
  }

  // Handle file uploads (JSON, CSV, Playlist) for importing data
  async onSongListUpload(evt) {
    const f = evt.target.files?.[0];
    evt.target.value = ""; // reset
    if (!f) return;
    this.bumpTableGeneration();
    const generation = this.tableGeneration;
    try {
      const text = await f.text();
      if (generation !== this.tableGeneration) return;

      const result = ioManager.parseUploadText({ name: f.name, type: f.type }, text);
      if (result.kind === "error") {
        showAlert(result.message || "Invalid file format.", "danger");
        return;
      }
      const isAppend = appState.getStateSlice("ui.resultMode") === "append";
      if (result.kind === "playlist") {
        playlistManager.loadAnnSongIdsIntoTable(result.ids, isAppend, result.name || "playlist");
      } else if (result.kind === "rows") {
        if (isAppend) this.appendData(result.rows); else this.loadData(result.rows);
      }
    } catch (err) {
      showAlert(`Upload failed: ${err.message || err}`, "danger");
    }
  }

  // Remove a row from both state and table by its unique key
  removeRow(key) {
    if (!this.model.remove(key)) return;
    this.bumpTableGeneration();
    this.table.render();
  }

  // Return the stable key for a given row data object
  getKeyForRow(row) {
    return this.model.getKey(row);
  }

  // Get anime title based on current language preference setting
  getAnimeTitle(row) {
    return tableAnimeTitle(row, settingsManager.get("language"));
  }
}

const tableManager = new TableManager();
