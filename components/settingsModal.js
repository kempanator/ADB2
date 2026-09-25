class SettingsModal {
  constructor() {
    this.modal = document.querySelector("#settings-modal");
    this.tableTab = document.querySelector("#settings-table-tab");
    this.columnOrderList = document.querySelector("#settings-column-list");
    this.visibleColumnCount = document.querySelector("#settings-visible-column-count");
    this.theme = document.querySelector("#settings-theme-control");
    this.radio = document.querySelector("#settings-radio-mode-control");
    this.fileHost = document.querySelector("#settings-file-host-control");
    this.lang = document.querySelector("#settings-language-control");
    this.resetColsOrder = document.querySelector("#settings-reset-column-order-button");
    this.resetColsVisibility = document.querySelector("#settings-reset-columns-button");
    this.zebraStripe = document.querySelector("#settings-zebra-stripes-checkbox");
    this.randomSongsOnLoad = document.querySelector("#settings-random-songs-checkbox");
    this.defaultAudioVolume = document.querySelector("#settings-default-volume-input");
    this.defaultAudioVolumeValue = document.querySelector("#settings-default-volume-value");
    this.importSettings = document.querySelector("#settings-import-button");
    this.exportSettings = document.querySelector("#settings-export-button");
    this.exportPlaylists = document.querySelector("#playlists-export-button");
    this.settingsFileInput = document.querySelector("#settings-import-file-input");
    this.resetAllSettings = document.querySelector("#settings-reset-button");
    this.deleteAllPlaylists = document.querySelector("#playlists-delete-all-button");
    this.wireEvents();
  }

  wireEvents() {
    // React to settings changes
    eventBus.on("settings:changed", () => this.applyToUI());

    // Column management events for settings modal UI
    eventBus.on("ui:column-visibility-changed", () => this.renderColumnOrderList());
    eventBus.on("ui:column-order-changed", () => {
      if (this.savingDraggedColumnOrder) {
        this.updateColumnMoveButtons();
        return;
      }
      this.renderColumnOrderList();
      this.initColumnReordering();
    });

    // Initialize column UI each time settings is opened
    this.modal.addEventListener("shown.ui.modal", () => {
      this.renderColumnOrderList();
      this.initColumnReordering();
    });
    eventBus.on("settings:open-columns", () => {
      ui.showModal(this.modal);
      ui.activateTab(this.tableTab);
      this.tableTab.focus();
    });

    // Theme segmented switch
    this.bindSegment(this.theme, "theme");

    // Radio mode segmented switch
    this.bindSegment(this.radio, "radioMode");

    // File host segmented switch
    this.bindSegment(this.fileHost, "fileHost");

    // Language segmented switch
    this.bindSegment(this.lang, "language");

    // Column order reset
    this.resetColsOrder.addEventListener("click", () => {
      settingsManager.resetColumnOrderToDefault();
    });

    // Reset columns button
    this.resetColsVisibility.addEventListener("click", () => {
      settingsManager.resetColumnVisibilityToDefault();
    });

    // Zebra stripe toggle
    this.zebraStripe.addEventListener("change", (e) => {
      settingsManager.set("zebraStripe", e.target.checked);
    });

    this.randomSongsOnLoad.addEventListener("change", (event) => {
      settingsManager.set("loadRandomSongsOnStartup", event.target.checked);
    });

    // Default audio volume input change
    this.defaultAudioVolume.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      settingsManager.set("defaultAudioVolume", v);
      this.defaultAudioVolumeValue.textContent = `${v}%`;
    });

    // Import/Export/Reset actions
    this.importSettings.addEventListener("click", () => this.settingsFileInput.click());
    this.exportSettings.addEventListener("click", () => settingsManager.exportSettings());
    this.exportPlaylists.addEventListener("click", () => playlistManager.exportAllPlaylists());
    this.settingsFileInput.addEventListener("change", (evt) => settingsManager.onImportFile(evt));
    this.resetAllSettings.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all settings to defaults? This action cannot be undone.")) {
        settingsManager.resetAllSettings();
      }
    });
    this.deleteAllPlaylists.addEventListener("click", () => playlistManager.deleteAllPlaylists());
    const onColumnChange = event => {
      const input = event.target.closest(".settings-column-visibility-toggle");
      if (input) this.setColumnVisible(input.dataset.column, input.checked);
    };
    this.columnOrderList.addEventListener("change", onColumnChange);
    this.columnOrderList.addEventListener("click", event => {
      const button = event.target.closest("[data-move]");
      if (button) this.moveColumn(button.dataset.column, Number(button.dataset.move));
    });
  }

  bindSegment(container, key) {
    container.addEventListener("click", event => {
      const segment = event.target.closest(".segment");
      if (segment && container.contains(segment)) settingsManager.set(key, segment.dataset.value);
    });
  }

  // Apply current settings to the UI elements
  applyToUI() {
    const setSegmentedSwitchSafe = (containerId, value, fallback) => {
      const container = document.getElementById(containerId);
      if (!container) return fallback;
      container.querySelectorAll(".segment").forEach(segment => {
        segment.classList.remove("active");
        segment.setAttribute("aria-pressed", "false");
      });
      const target = [...container.querySelectorAll(".segment")]
        .find(segment => segment.dataset.value === value)
        || [...container.querySelectorAll(".segment")].find(segment => segment.dataset.value === fallback);
      target?.classList.add("active");
      target?.setAttribute("aria-pressed", "true");
      return target?.dataset.value || fallback;
    };

    // Ensure defaults are reflected in the UI even with missing/invalid stored values
    setSegmentedSwitchSafe("settings-theme-control", settingsManager.get("theme"), settingsManager.defaults.theme);
    setSegmentedSwitchSafe("settings-radio-mode-control", settingsManager.get("radioMode"), settingsManager.defaults.radioMode);
    setSegmentedSwitchSafe("settings-file-host-control", settingsManager.get("fileHost"), settingsManager.defaults.fileHost);
    setSegmentedSwitchSafe("settings-language-control", settingsManager.get("language"), settingsManager.defaults.language);

    // Initialize zebra stripe toggle
    this.zebraStripe.checked = settingsManager.get("zebraStripe");
    this.randomSongsOnLoad.checked = settingsManager.get("loadRandomSongsOnStartup");

    // Initialize default audio volume
    const defVol = settingsManager.get("defaultAudioVolume");
    this.defaultAudioVolume.value = defVol;
    this.defaultAudioVolumeValue.textContent = `${defVol}%`;

    // Refresh hotkey inputs
    hotkeyManager.refreshHotkeyInputs();
  }

  // Render every column in table order, including hidden columns.
  renderColumnOrderList() {
    const columnOrder = settingsManager.get("columnOrder");
    const visibleColumns = settingsManager.get("visibleColumns");
    const label = key => TableColumns[key]?.settingsLabel || TableColumns[key]?.label || key;
    const visibleCount = columnOrder.filter(key => visibleColumns[key]).length;
    this.visibleColumnCount.textContent = `${visibleCount} of ${columnOrder.length} visible`;
    this.columnOrderList.innerHTML = columnOrder.map((key, index) => `
      <div class="settings-column-row${visibleColumns[key] ? "" : " is-hidden"}" data-column="${key}">
        <button type="button" class="settings-column-grab js-column-grab" aria-label="Drag ${label(key)} to reorder" title="Drag to reorder"><svg class="icon" aria-hidden="true"><use href="#drag_indicator"></use></svg></button>
        <label class="settings-column-checkbox"><input class="settings-column-visibility-toggle" type="checkbox" data-column="${key}" ${visibleColumns[key] ? "checked" : ""}><span>${label(key)}</span></label>
        <button type="button" class="settings-column-move" data-column="${key}" data-move="-1" aria-label="Move ${label(key)} up" title="Move up" ${index === 0 ? "disabled" : ""}><svg class="icon" aria-hidden="true"><use href="#arrow_drop_up"></use></svg></button>
        <button type="button" class="settings-column-move" data-column="${key}" data-move="1" aria-label="Move ${label(key)} down" title="Move down" ${index === columnOrder.length - 1 ? "disabled" : ""}><svg class="icon" aria-hidden="true"><use href="#arrow_drop_down"></use></svg></button>
      </div>`).join("");
  }

  setColumnVisible(key, show) {
    if (!TableColumns[key]) return;
    settingsManager.set("visibleColumns", { ...settingsManager.get("visibleColumns"), [key]: show });
    this.columnOrderList.querySelector(`input[data-column="${key}"]`)?.focus();
  }

  moveColumn(key, direction) {
    const order = settingsManager.get("columnOrder");
    const index = order.indexOf(key);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    const reordered = [...order];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    settingsManager.set("columnOrder", reordered);
  }

  updateColumnMoveButtons() {
    const rows = [...this.columnOrderList.querySelectorAll(".settings-column-row[data-column]")];
    rows.forEach((row, index) => {
      row.querySelector('[data-move="-1"]').disabled = index === 0;
      row.querySelector('[data-move="1"]').disabled = index === rows.length - 1;
    });
  }

  // Initializes drag-and-drop column reordering functionality using Sortable.js
  initColumnReordering() {
    const listEl = this.columnOrderList;
    if (!listEl) return;
    this.columnSortable?.destroy();
    this.columnSortable = new Sortable(listEl, {
      handle: ".js-column-grab",
      animation: 180,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      ghostClass: "is-column-dragging",
      onEnd: () => {
        const columnOrder = [...listEl.querySelectorAll(".settings-column-row[data-column]")].map(el => el.dataset.column);
        this.savingDraggedColumnOrder = true;
        try {
          settingsManager.set("columnOrder", columnOrder);
        } finally {
          this.savingDraggedColumnOrder = false;
        }
      }
    });
  }
}

const settingsModal = new SettingsModal();
