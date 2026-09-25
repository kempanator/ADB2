// SettingsManager handles application settings: loading from and saving to localStorage,
// merging with defaults, and providing get/set methods for accessing and updating settings.
class SettingsManager {
  constructor(defaults, storageKey) {
    this.defaults = structuredClone(defaults);
    this.storageKey = storageKey;
    this.settings = this.load();
    this.applyTheme();
  }

  // Load settings from localStorage and merge with defaults
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const stored = raw ? JSON.parse(raw) : {};
      const base = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      const merged = {
        ...structuredClone(this.defaults),
        ...base,
        hotkeys: { ...this.defaults.hotkeys, ...(base.hotkeys || {}) }
      };
      const settings = this.sanitize(merged);
      if (raw && JSON.stringify(stored) !== JSON.stringify(settings)) {
        try { localStorage.setItem(this.storageKey, JSON.stringify(settings)); } catch { /* Use the normalized settings in memory. */ }
      }
      return settings;
    } catch {
      return structuredClone(this.defaults);
    }
  }

  // Save current settings to localStorage
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (error) {
      console.error("SettingsManager.save: Failed to save settings to localStorage", error);
    }
  }

  // Get a setting value
  get(key) {
    if (!key || typeof key !== "string") {
      console.error("SettingsManager.get: Invalid key provided");
      return undefined;
    }
    if (!(key in this.settings)) {
      console.warn(`SettingsManager.get: Unknown setting key "${key}"`);
      return this.defaults[key];
    }
    return this.settings[key];
  }

  // All settings changes, including reset and import, use this path.
  set(key, value, autoSave = true) {
    if (!Object.hasOwn(this.defaults, key)) {
      console.warn(`SettingsManager.set: Unknown setting key "${key}"`);
      return;
    }
    this.update({ [key]: value }, autoSave);
  }

  update(updates, autoSave = true, { replace = false } = {}) {
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      throw new Error("Settings must be an object.");
    }
    const source = replace ? this.defaults : this.settings;
    const next = this.sanitize({ ...source, ...updates });
    const changed = Object.keys(this.defaults).filter(key => replace ||
      JSON.stringify(this.settings[key]) !== JSON.stringify(next[key]));
    this.settings = next;
    if (autoSave) this.save();
    if (!changed.length) return;

    if (changed.includes("theme")) {
      this.applyTheme();
      eventBus.emit("settings:theme-changed", next.theme);
    }
    if (changed.includes("columnOrder")) eventBus.emit("ui:column-order-changed");
    if (changed.includes("visibleColumns")) eventBus.emit("ui:column-visibility-changed");
    if (changed.includes("columnOrder") || changed.includes("language")) {
      eventBus.emit("settings:table-layout-changed");
    }
    if (changed.includes("language")) eventBus.emit("settings:language-changed", next.language);
    if (changed.includes("radioMode")) eventBus.emit("settings:radio-changed", next.radioMode);
    if (changed.includes("fileHost")) eventBus.emit("settings:fileHost-changed", next.fileHost);
    if (changed.includes("zebraStripe")) eventBus.emit("settings:zebraStripe-changed", next.zebraStripe);
    if (changed.includes("defaultAudioVolume")) {
      eventBus.emit("settings:defaultAudioVolume-changed", next.defaultAudioVolume);
    }
    const changedValues = Object.fromEntries(changed.map(key => [key, next[key]]));
    eventBus.emit("settings:changed", {
      key: changed.length === 1 ? changed[0] : undefined,
      value: changed.length === 1 ? next[changed[0]] : undefined,
      updates: changedValues
    });
  }

  reset() {
    this.update(structuredClone(this.defaults), true, { replace: true });
  }

  // Reset all settings to defaults and apply to UI
  resetAllSettings() {
    this.reset();

    showAlert("All settings have been reset to defaults", "success");
  }

  resetColumnOrderToDefault() {
    this.set("columnOrder", [...DefaultColumnOrder]);
  }

  // Export current settings as a JSON file
  exportSettings() {
    const data = {
      type: "settings",
      timestamp: new Date().toISOString(),
      data: this.settings
    };

    ioManager.downloadFile(JSON.stringify(data, null, 2),
      `adb2_settings_${new Date().toISOString().slice(0, 10)}.json`, "application/json");

    showAlert("Settings exported successfully", "success");
  }

  // Handle file import for settings or playlists
  async onImportFile(evt) {
    const file = evt.target.files?.[0];
    evt.target.value = ""; // Reset file input

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed?.type === "settings" && parsed.data) {
        this.update(parsed.data, true, { replace: true });
        showAlert("Settings imported successfully", "success");

      } else if ((parsed?.type === "playlists" || parsed?.type === "playlist") && parsed.data) {
        const imported = playlistManager.importPlaylists(parsed.data);

        // Show appropriate success message
        if (parsed.type === "playlist") {
          const playlistName = imported[0]?.name || "Unknown";
          showAlert(`Playlist "${playlistName}" imported successfully`, "success");
        } else {
          showAlert("Playlists imported successfully", "success");
        }

      } else if (parsed && typeof parsed.name === "string" && Array.isArray(parsed.annSongIds)) {
        const playlist = playlistManager.importExternalPlaylist(parsed);
        showAlert(`Playlist "${playlist.name}" imported successfully`, "success");
      } else {
        throw new Error("Unsupported JSON file. Choose a settings or playlist export.");
      }

    } catch (err) {
      showAlert(`Import failed: ${err.message}`, "danger");
    }
  }

  // Validate and sanitize settings object with fallbacks to defaults
  sanitize(s) {
    const out = structuredClone(this.defaults);
    for (const key of Object.keys(this.defaults)) {
      if (Object.hasOwn(s, key)) out[key] = s[key];
    }

    const validTheme = new Set(["dark", "light"]);
    const validRadio = new Set(["none", "repeat", "loopAll"]);
    const validHost = new Set(["eudist", "nawdist", "naedist"]);
    const validLang = new Set(["english", "romaji"]);
    const validSearchMode = new Set(["simple", "advanced"]);

    if (!validTheme.has(out.theme)) out.theme = this.defaults.theme;
    if (!validRadio.has(out.radioMode)) out.radioMode = this.defaults.radioMode;
    if (!validHost.has(out.fileHost)) out.fileHost = this.defaults.fileHost;
    if (!validLang.has(out.language)) out.language = this.defaults.language;
    if (!validSearchMode.has(out.searchMode)) out.searchMode = this.defaults.searchMode;
    if (typeof out.loadRandomSongsOnStartup !== "boolean") {
      out.loadRandomSongsOnStartup = this.defaults.loadRandomSongsOnStartup;
    }
    if (typeof out.zebraStripe !== "boolean") out.zebraStripe = this.defaults.zebraStripe;

    let defVol = Number(out.defaultAudioVolume);
    if (!Number.isFinite(defVol)) defVol = this.defaults.defaultAudioVolume;
    out.defaultAudioVolume = Math.max(0, Math.min(100, Math.round(defVol)));

    if (!out.hotkeys || typeof out.hotkeys !== "object" || Array.isArray(out.hotkeys)) {
      out.hotkeys = { ...this.defaults.hotkeys };
    } else {
      out.hotkeys = Object.fromEntries(Object.keys(this.defaults.hotkeys).map(key => [
        key, typeof out.hotkeys[key] === "string" ? out.hotkeys[key] : this.defaults.hotkeys[key]
      ]));
    }

    if (!out.visibleColumns || typeof out.visibleColumns !== "object" || Array.isArray(out.visibleColumns)) {
      out.visibleColumns = { ...this.defaults.visibleColumns };
    } else {
      out.visibleColumns = Object.fromEntries(Object.keys(this.defaults.visibleColumns).map(key => [
        key, typeof out.visibleColumns[key] === "boolean" ? out.visibleColumns[key] : this.defaults.visibleColumns[key]
      ]));
    }

    const validColumns = new Set(this.defaults.columnOrder);
    if (!Array.isArray(out.columnOrder) || out.columnOrder.some(col => !validColumns.has(col))) {
      out.columnOrder = [...this.defaults.columnOrder];
    } else {
      const filteredOrder = [...new Set(out.columnOrder)];

      // Add any missing columns from defaults
      const missingColumns = this.defaults.columnOrder.filter(col => !filteredOrder.includes(col));
      out.columnOrder = [...filteredOrder, ...missingColumns];
    }

    return out;
  }

  // Apply theme to document
  applyTheme() {
    document.documentElement.setAttribute("data-theme", this.settings.theme === "dark" ? "dark" : "light");
  }

  // Reset column visibility to defaults
  resetColumnVisibilityToDefault() {
    this.set("visibleColumns", { ...this.defaults.visibleColumns });
  }
}

const settingsManager = new SettingsManager(DefaultSettings, SETTINGS_KEY);
