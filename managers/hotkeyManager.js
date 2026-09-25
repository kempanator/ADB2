// HotkeyManager handles the initialization, configuration, and global handling of user-defined
// keyboard shortcuts (hotkeys) for various actions in the application.
class HotkeyManager {
  constructor() {
    this.isInitialized = false;
    this.hotkeyInputs = {};
    this.inputHandlers = {};
    this.globalHotkeyHandler = null;
  }

  // Initializes hotkey input fields and sets up global hotkey handling
  initialize() {
    if (this.isInitialized) return;

    this.setupHotkeyInputs();
    this.setupGlobalHotkeys();
    this.isInitialized = true;
  }

  // Sets up hotkey input fields for settings
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

      // Set current value
      element.value = this.formatCombo(settingsManager.get("hotkeys")[keyName]);

      // Add event listener
      const handler = e => this.captureHotkey(e, element, keyName);
      element.addEventListener("keydown", handler);

      // Store reference
      this.hotkeyInputs[keyName] = element;
      this.inputHandlers[keyName] = handler;
    });
  }

  // Sets up global hotkey handling
  setupGlobalHotkeys() {
    this.globalHotkeyHandler = e => this.handleGlobalHotkeys(e);
    document.addEventListener("keydown", this.globalHotkeyHandler);
  }

  // Captures and validates hotkey combinations for settings
  captureHotkey(e, element, keyName) {
    // Keep keyboard focus navigation available while assigning a shortcut.
    if (e.key === "Tab") return;
    e.preventDefault();
    e.stopPropagation();

    // Handle escape key
    if (e.key === "Escape") return;

    // Handle clear keys
    if (["Backspace", "Delete"].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      this.clearHotkey(keyName, element);
      return;
    }

    // Normalize the combination
    const combo = this.normalizeCombo(e);
    if (!combo) return;

    // Check for conflicts
    if (this.hasConflict(keyName, combo)) {
      this.showConflictError(element);
      return;
    }

    // Save the hotkey
    this.saveHotkey(keyName, combo, element);
  }

  // Clears a hotkey
  clearHotkey(keyName, element) {
    const hotkeys = { ...settingsManager.get("hotkeys") };
    hotkeys[keyName] = "";
    settingsManager.set("hotkeys", hotkeys);
    element.value = "";
  }

  // Checks if a hotkey combination conflicts with existing ones
  hasConflict(keyName, combo) {
    const hotkeys = settingsManager.get("hotkeys");
    for (const [k, v] of Object.entries(hotkeys)) {
      if (k !== keyName && v && v === combo) {
        return true;
      }
    }
    return false;
  }

  // Shows conflict error on input element
  showConflictError(element) {
    element.classList.add("is-invalid");
    setTimeout(() => element.classList.remove("is-invalid"), 600);
  }

  // Saves a hotkey combination
  saveHotkey(keyName, combo, element) {
    const hotkeys = { ...settingsManager.get("hotkeys") };
    hotkeys[keyName] = combo;
    settingsManager.set("hotkeys", hotkeys);
    element.value = this.formatCombo(combo);
  }

  formatCombo(combo) {
    return (combo || "").replaceAll("+", " + ");
  }

  // Normalizes keyboard event into a standardized hotkey combination string
  normalizeCombo(e) {
    const key = (e.key || "").toUpperCase();

    // Ignore modifier-only keys
    if (["SHIFT", "CONTROL", "ALT", "META"].includes(key)) return "";

    const parts = [];

    // Add modifiers
    if (e.ctrlKey) parts.push("CTRL");
    if (e.metaKey) parts.push("META");
    if (e.altKey) parts.push("ALT");
    if (e.shiftKey) parts.push("SHIFT");

    // Add the main key
    let normalizedKey = key;
    if (normalizedKey === " ") normalizedKey = "SPACE";
    if (normalizedKey.startsWith("ARROW")) {
      normalizedKey = normalizedKey.replace("ARROW", "");
    }

    parts.push(normalizedKey);
    return parts.join("+");
  }

  // Handles global hotkey events throughout the application
  handleGlobalHotkeys(e) {
    // Don't handle hotkeys in input fields
    const target = e.target instanceof Element ? e.target : document.activeElement;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;

    // Handle info modal navigation
    if (this.handleInfoModalNavigation(e)) return;

    // Handle custom hotkeys
    if (e.repeat) return;
    const combo = this.normalizeCombo(e);
    if (!combo) return;

    this.executeHotkey(combo, e);
  }

  // Handles arrow key navigation in info modal
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
        eventBus.emit("modal:info-prev");
        return true;
      case "ARROWRIGHT":
      case "ARROWDOWN":
        eventBus.emit("modal:info-next");
        return true;
    }

    return false;
  }

  // Executes a hotkey action
  executeHotkey(combo, e) {
    const hotkeys = settingsManager.get("hotkeys");
    const keyName = Object.keys(this.hotkeyInputs).find(key => hotkeys[key] && hotkeys[key] === combo);
    if (!keyName) return false;

    e.preventDefault();
    switch (keyName) {
      case "switchSearchMode": eventBus.emit("search:mode-toggle"); break;
      case "downloadJson": tableManager.export("json"); break;
      case "playPause": eventBus.emit("audio:toggle-play-pause"); break;
      case "cycleRadioMode": eventBus.emit("audio:cycle-radio-mode"); break;
      case "prev": eventBus.emit("audio:previous"); break;
      case "next": eventBus.emit("audio:next"); break;
    }
    return true;
  }

  // Refreshes hotkey input values from settings
  refreshHotkeyInputs() {
    const hotkeys = settingsManager.get("hotkeys");

    Object.entries(this.hotkeyInputs).forEach(([keyName, element]) => {
      if (element) {
        element.value = this.formatCombo(hotkeys[keyName]);
      }
    });
  }

  // Destroys the hotkey manager and removes event listeners
  destroy() {
    if (this.globalHotkeyHandler) {
      document.removeEventListener("keydown", this.globalHotkeyHandler);
      this.globalHotkeyHandler = null;
    }

    // Remove input event listeners
    Object.entries(this.hotkeyInputs).forEach(([keyName, element]) => {
      element.removeEventListener("keydown", this.inputHandlers[keyName]);
    });

    this.hotkeyInputs = {};
    this.inputHandlers = {};
    this.isInitialized = false;
  }
}

const hotkeyManager = new HotkeyManager();
