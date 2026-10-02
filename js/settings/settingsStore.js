class SettingsStore {
  constructor({ defaults, storageKey, events }) {
    Object.assign(this, { events });
    this.defaults = structuredClone(defaults);
    this.storageKey = storageKey;
    this.settings = this.load();
  }

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

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (error) {
      console.error("SettingsStore.save: Failed to save settings to localStorage", error);
    }
  }

  get(key) {
    if (!key || typeof key !== "string") {
      console.error("SettingsStore.get: Invalid key provided");
      return undefined;
    }
    if (!(Object.hasOwn(this.settings, key))) {
      console.warn(`SettingsStore.get: Unknown setting key "${key}"`);
      return this.defaults[key];
    }
    return this.settings[key];
  }

  // All settings changes, including reset and import, use this path.
  set(key, value, autoSave = true) {
    if (!Object.hasOwn(this.defaults, key)) {
      console.warn(`SettingsStore.set: Unknown setting key "${key}"`);
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

    for (const key of changed) this.events.emit(`settings:${key}-changed`, next[key]);
    const changedValues = Object.fromEntries(changed.map(key => [key, next[key]]));
    this.events.emit("settings:changed", {
      key: changed.length === 1 ? changed[0] : undefined,
      value: changed.length === 1 ? next[changed[0]] : undefined,
      updates: changedValues
    });
  }

  reset() {
    this.update(structuredClone(this.defaults), true, { replace: true });
  }

  resetColumnOrderToDefault() {
    this.set("columnOrder", [...DefaultColumnOrder]);
  }

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
    const validResultsViewMode = new Set(["auto", "table", "cards"]);

    if (!validTheme.has(out.theme)) out.theme = this.defaults.theme;
    if (!validRadio.has(out.radioMode)) out.radioMode = this.defaults.radioMode;
    if (!validHost.has(out.fileHost)) out.fileHost = this.defaults.fileHost;
    if (!validLang.has(out.language)) out.language = this.defaults.language;
    if (!validSearchMode.has(out.searchMode)) out.searchMode = this.defaults.searchMode;
    if (!validResultsViewMode.has(out.resultsViewMode)) out.resultsViewMode = this.defaults.resultsViewMode;
    if (typeof out.loadRandomSongsOnStartup !== "boolean") {
      out.loadRandomSongsOnStartup = this.defaults.loadRandomSongsOnStartup;
    }
    if (typeof out.zebraStripe !== "boolean") out.zebraStripe = this.defaults.zebraStripe;
    if (typeof out.tableFullWidth !== "boolean") out.tableFullWidth = this.defaults.tableFullWidth;

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

      const missingColumns = this.defaults.columnOrder.filter(col => !filteredOrder.includes(col));
      out.columnOrder = [...filteredOrder, ...missingColumns];
    }

    return out;
  }

  resetColumnVisibilityToDefault() {
    this.set("visibleColumns", { ...this.defaults.visibleColumns });
  }
}
