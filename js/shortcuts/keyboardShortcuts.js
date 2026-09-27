class KeyboardShortcuts {
  constructor({ files, navigateDetails, playback, settings, toggleSearchMode }) {
    Object.assign(this, { files, navigateDetails, playback, settings, toggleSearchMode });
    this.isInitialized = false;
    this.hotkeyInputs = {};
    this.inputHandlers = {};
    this.globalHotkeyHandler = null;
  }

  initialize() {
    if (this.isInitialized) return;

    this.setupHotkeyInputs();
    this.setupGlobalHotkeys();
    this.isInitialized = true;
  }

  setupHotkeyInputs() {
    const hotkeyTypes = ["switchSearchMode", "downloadJson", "playPause", "cycleRadioMode", "prev", "next"];
    const elementIds = {
      switchSearchMode: "shortcut-search-mode-input",
      downloadJson: "shortcut-download-json-input",
      playPause: "shortcut-play-pause-input",
      cycleRadioMode: "shortcut-radio-mode-input",
      prev: "shortcut-previous-song-input",
      next: "shortcut-next-song-input"
    };

    hotkeyTypes.forEach(keyName => {
      const element = document.getElementById(elementIds[keyName]);
      if (!element) return;

      element.value = this.formatCombo(this.settings.get("hotkeys")[keyName]);

      const handler = e => this.captureHotkey(e, element, keyName);
      element.addEventListener("keydown", handler);

      this.hotkeyInputs[keyName] = element;
      this.inputHandlers[keyName] = handler;
    });
  }

  setupGlobalHotkeys() {
    this.globalHotkeyHandler = e => this.handleGlobalHotkeys(e);
    document.addEventListener("keydown", this.globalHotkeyHandler);
  }

  captureHotkey(e, element, keyName) {
    // Keep keyboard focus navigation available while assigning a shortcut.
    if (e.key === "Tab") return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") return;

    if (["Backspace", "Delete"].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      this.clearHotkey(keyName, element);
      return;
    }

    const combo = this.normalizeCombo(e);
    if (!combo) return;

    if (this.hasConflict(keyName, combo)) {
      this.showConflictError(element);
      return;
    }

    this.saveHotkey(keyName, combo, element);
  }

  clearHotkey(keyName, element) {
    const hotkeys = { ...this.settings.get("hotkeys") };
    hotkeys[keyName] = "";
    this.settings.set("hotkeys", hotkeys);
    element.value = "";
  }

  hasConflict(keyName, combo) {
    const hotkeys = this.settings.get("hotkeys");
    for (const [k, v] of Object.entries(hotkeys)) {
      if (k !== keyName && v && v === combo) {
        return true;
      }
    }
    return false;
  }

  showConflictError(element) {
    element.classList.add("is-invalid");
    setTimeout(() => element.classList.remove("is-invalid"), 600);
  }

  saveHotkey(keyName, combo, element) {
    const hotkeys = { ...this.settings.get("hotkeys") };
    hotkeys[keyName] = combo;
    this.settings.set("hotkeys", hotkeys);
    element.value = this.formatCombo(combo);
  }

  formatCombo(combo) {
    return (combo || "").replaceAll("+", " + ");
  }

  normalizeCombo(e) {
    const key = (e.key || "").toUpperCase();

    if (["SHIFT", "CONTROL", "ALT", "META"].includes(key)) return "";

    const parts = [];

    if (e.ctrlKey) parts.push("CTRL");
    if (e.metaKey) parts.push("META");
    if (e.altKey) parts.push("ALT");
    if (e.shiftKey) parts.push("SHIFT");

    let normalizedKey = key;
    if (normalizedKey === " ") normalizedKey = "SPACE";
    if (normalizedKey.startsWith("ARROW")) {
      normalizedKey = normalizedKey.replace("ARROW", "");
    }

    parts.push(normalizedKey);
    return parts.join("+");
  }

  handleGlobalHotkeys(e) {
    const target = e.target instanceof Element ? e.target : document.activeElement;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;

    if (this.handleInfoModalNavigation(e)) return;

    if (e.repeat) return;
    const combo = this.normalizeCombo(e);
    if (!combo) return;

    this.executeHotkey(combo, e);
  }

  handleInfoModalNavigation(e) {
    const modal = document.getElementById("song-info-modal");
    if (!modal || !modal.classList.contains("show")) return false;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;

    const key = (e.key || "").toUpperCase();
    if (!["ARROWLEFT", "ARROWRIGHT", "ARROWUP", "ARROWDOWN"].includes(key)) return false;

    e.preventDefault();

    switch (key) {
      case "ARROWLEFT":
      case "ARROWUP":
        this.navigateDetails("prev");
        return true;
      case "ARROWRIGHT":
      case "ARROWDOWN":
        this.navigateDetails("next");
        return true;
    }

    return false;
  }

  executeHotkey(combo, e) {
    const hotkeys = this.settings.get("hotkeys");
    const keyName = Object.keys(this.hotkeyInputs).find(key => hotkeys[key] && hotkeys[key] === combo);
    if (!keyName) return false;

    e.preventDefault();
    switch (keyName) {
      case "switchSearchMode": this.toggleSearchMode(); break;
      case "downloadJson": this.files.exportResults("json"); break;
      case "playPause": this.playback.togglePlayPause(); break;
      case "cycleRadioMode": this.playback.cycleRadioMode(); break;
      case "prev": this.playback.previous(); break;
      case "next": this.playback.next(); break;
    }
    return true;
  }

  refreshHotkeyInputs() {
    const hotkeys = this.settings.get("hotkeys");

    Object.entries(this.hotkeyInputs).forEach(([keyName, element]) => {
      if (element) {
        element.value = this.formatCombo(hotkeys[keyName]);
      }
    });
  }

  destroy() {
    if (this.globalHotkeyHandler) {
      document.removeEventListener("keydown", this.globalHotkeyHandler);
      this.globalHotkeyHandler = null;
    }

    Object.entries(this.hotkeyInputs).forEach(([keyName, element]) => {
      element.removeEventListener("keydown", this.inputHandlers[keyName]);
    });

    this.hotkeyInputs = {};
    this.inputHandlers = {};
    this.isInitialized = false;
  }
}
