class SettingsDialog {
  constructor({ events, files, notify, playlists, settings, shortcuts, ui }) {
    Object.assign(this, { events, files, notify, playlists, settings, shortcuts, ui });
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
    this.tableFullWidth = document.querySelector("#settings-table-full-width-checkbox");
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

  showColumns() {
    this.ui.showModal(this.modal);
    this.ui.activateTab(this.tableTab);
    this.tableTab.focus();
  }

  wireEvents() {
    this.events.on("settings:changed", () => this.applyToUI());

    this.events.on("settings:visibleColumns-changed", () => this.renderColumnOrderList());
    this.events.on("settings:columnOrder-changed", () => {
      if (this.savingDraggedColumnOrder) {
        this.updateColumnMoveButtons();
        return;
      }
      this.renderColumnOrderList();
      this.initColumnReordering();
    });

    this.modal.addEventListener("shown.ui.modal", () => {
      this.renderColumnOrderList();
      this.initColumnReordering();
    });

    this.bindSegment(this.theme, "theme");

    this.bindSegment(this.radio, "radioMode");

    this.bindSegment(this.fileHost, "fileHost");

    this.bindSegment(this.lang, "language");

    this.resetColsOrder.addEventListener("click", () => {
      this.settings.resetColumnOrderToDefault();
    });

    this.resetColsVisibility.addEventListener("click", () => {
      this.settings.resetColumnVisibilityToDefault();
    });

    this.zebraStripe.addEventListener("change", (e) => {
      this.settings.set("zebraStripe", e.target.checked);
    });

    this.tableFullWidth.addEventListener("change", (event) => {
      this.settings.set("tableFullWidth", event.target.checked);
    });

    this.randomSongsOnLoad.addEventListener("change", (event) => {
      this.settings.set("loadRandomSongsOnStartup", event.target.checked);
    });

    this.defaultAudioVolume.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      this.settings.set("defaultAudioVolume", v);
      this.defaultAudioVolumeValue.textContent = `${v}%`;
    });

    this.importSettings.addEventListener("click", () => this.settingsFileInput.click());
    this.exportSettings.addEventListener("click", () => this.files.exportSettings());
    this.exportPlaylists.addEventListener("click", () => this.playlists.exportAllPlaylists());
    this.settingsFileInput.addEventListener("change", event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      this.files.importPreferences(file);
    });
    this.resetAllSettings.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all settings to defaults? This action cannot be undone.")) {
        this.settings.reset();
        this.notify("All settings have been reset to defaults", "success");
      }
    });
    this.deleteAllPlaylists.addEventListener("click", () => {
      if (confirm("Are you sure you want to delete all playlists? This action cannot be undone.")) {
        this.playlists.deleteAllPlaylists();
      }
    });
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
      if (segment && container.contains(segment)) this.settings.set(key, segment.dataset.value);
    });
  }

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

    setSegmentedSwitchSafe("settings-theme-control", this.settings.get("theme"), this.settings.defaults.theme);
    setSegmentedSwitchSafe("settings-radio-mode-control", this.settings.get("radioMode"), this.settings.defaults.radioMode);
    setSegmentedSwitchSafe("settings-file-host-control", this.settings.get("fileHost"), this.settings.defaults.fileHost);
    setSegmentedSwitchSafe("settings-language-control", this.settings.get("language"), this.settings.defaults.language);

    this.zebraStripe.checked = this.settings.get("zebraStripe");
    this.tableFullWidth.checked = this.settings.get("tableFullWidth");
    this.randomSongsOnLoad.checked = this.settings.get("loadRandomSongsOnStartup");

    const defVol = this.settings.get("defaultAudioVolume");
    this.defaultAudioVolume.value = defVol;
    this.defaultAudioVolumeValue.textContent = `${defVol}%`;

    this.shortcuts.refreshHotkeyInputs();
  }

  renderColumnOrderList() {
    const columnOrder = this.settings.get("columnOrder");
    const visibleColumns = this.settings.get("visibleColumns");
    const label = key => ResultColumns[key]?.settingsLabel || ResultColumns[key]?.label || key;
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
    if (!ResultColumns[key]) return;
    this.settings.set("visibleColumns", { ...this.settings.get("visibleColumns"), [key]: show });
    this.columnOrderList.querySelector(`input[data-column="${key}"]`)?.focus();
  }

  moveColumn(key, direction) {
    const order = this.settings.get("columnOrder");
    const index = order.indexOf(key);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    const reordered = [...order];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    this.settings.set("columnOrder", reordered);
  }

  updateColumnMoveButtons() {
    const rows = [...this.columnOrderList.querySelectorAll(".settings-column-row[data-column]")];
    rows.forEach((row, index) => {
      row.querySelector('[data-move="-1"]').disabled = index === 0;
      row.querySelector('[data-move="1"]').disabled = index === rows.length - 1;
    });
  }

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
          this.settings.set("columnOrder", columnOrder);
        } finally {
          this.savingDraggedColumnOrder = false;
        }
      }
    });
  }
}
