class ResultsToolbar {
  constructor({ events, files, linkChecker, refresher, results, settings, showColumnSettings }) {
    Object.assign(this, { events, files, linkChecker, refresher, results, settings, showColumnSettings });
    this.btnTable = document.querySelector("#results-options-button");
    this.btnExportCSV = document.querySelector("#data-export-csv-button");
    this.btnExportJSON = document.querySelector("#data-export-json-button");
    this.btnImportFile = document.querySelector("#data-import-button");
    this.songListFileInput = document.querySelector("#data-import-file-input");
    this.btnShuffle = document.querySelector("#table-shuffle-button");
    this.btnReverse = document.querySelector("#table-reverse-button");
    this.btnClearTable = document.querySelector("#table-clear-button");
    this.btnCheckLinks = document.querySelector("#table-check-links-button");
    this.btnRebuildTable = document.querySelector("#table-rebuild-button");
    this.btnCheckSongIds = document.querySelector("#table-check-song-ids-button");
    this.quickColumnOptions = document.querySelector("#results-column-options");
    this.btnManageColumns = document.querySelector("#results-manage-columns-button");
    this.resultMode = document.querySelector("#results-mode-control");
    this.cfAction = document.querySelector("#table-filter-action-select");
    this.cfField = document.querySelector("#table-filter-field-select");
    this.cfQuery = document.querySelector("#table-filter-query-input");
    this.cfPartial = document.querySelector("#table-filter-partial-match");
    this.cfMatchCase = document.querySelector("#table-filter-match-case");
    this.btnApplyClientFilter = document.querySelector("#table-filter-apply-button");
    this.wireEvents();
  }

  wireEvents() {
    this.btnExportCSV.addEventListener("click", () => this.files.exportResults("csv"));
    this.btnExportJSON.addEventListener("click", () => this.files.exportResults("json"));
    this.btnImportFile.addEventListener("click", () => this.songListFileInput.click());
    this.songListFileInput.addEventListener("change", event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      this.files.importSongs(file);
    });

    this.btnShuffle.addEventListener("click", () => this.results.shuffle());
    this.btnReverse.addEventListener("click", () => this.results.reverse());
    this.btnClearTable.addEventListener("click", () => this.results.clearData());
    this.btnCheckLinks.addEventListener("click", () => this.linkChecker.toggle());
    this.btnRebuildTable.addEventListener("click", () => this.refresher.toggle());
    this.btnCheckSongIds.addEventListener("click", () => this.results.checkSongIds());
    this.events.on("results:task-state-changed", ({ task, running }) => {
      if (task === "redownload") this.updateRedownloadButtonState(running);
      if (task === "link-check") this.updateCheckLinksButtonState(running);
    });

    this.btnApplyClientFilter.addEventListener("click", () => this.applyClientFilterFromUI());
    this.cfQuery.addEventListener("keydown", (e) => { if (e.key === "Enter") this.applyClientFilterFromUI(); });
    this.quickColumnOptions.addEventListener("change", event => {
      const input = event.target.closest("input[data-column]");
      if (!input || !this.quickColumnOptions.contains(input)) return;
      this.settings.set("visibleColumns", {
        ...this.settings.get("visibleColumns"), [input.dataset.column]: input.checked
      });
    });
    this.events.on("settings:visibleColumns-changed", () => this.renderQuickColumns());
    this.events.on("settings:columnOrder-changed", () => this.renderQuickColumns());
    this.btnManageColumns.addEventListener("click", () => {
      this.showColumnSettings();
    });

    this.resultMode.addEventListener("click", event => {
      const target = event.target.closest(".btn");
      if (!target || !this.resultMode.contains(target)) return;
      const mode = target.dataset.mode || "new";
      this.resultMode.querySelectorAll(".btn").forEach(button => {
        button.classList.toggle("active", button === target);
        button.setAttribute("aria-pressed", String(button === target));
      });
      this.results.resultMode = mode;
    });
    this.cfField.addEventListener("change", () => this.updateClientFilterUI());
    this.updateClientFilterUI();
  }

  renderQuickColumns() {
    const focusedKey = this.quickColumnOptions.contains(document.activeElement)
      ? document.activeElement.dataset.column : null;
    const visible = this.settings.get("visibleColumns");
    this.quickColumnOptions.innerHTML = this.settings.get("columnOrder").map(key => `
      <label class="results-column-option"><input type="checkbox" data-column="${key}" ${visible[key] ? "checked" : ""}>
        <span>${ResultColumns[key]?.settingsLabel || ResultColumns[key]?.label || key}</span></label>
    `).join("");
    if (focusedKey) this.quickColumnOptions.querySelector(`[data-column="${focusedKey}"]`)?.focus();
  }

  updateCheckLinksButtonState(isRunning) {
    if (isRunning) {
      this.btnCheckLinks.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#stop"></use></svg>Click to Stop';
      this.btnCheckLinks.classList.replace("btn-outline-secondary", "btn-outline-danger");
      this.btnCheckLinks.title = "Click to stop link validation";
    } else {
      this.btnCheckLinks.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#link"></use></svg>Check Links';
      this.btnCheckLinks.classList.replace("btn-outline-danger", "btn-outline-secondary");
      this.btnCheckLinks.title = "Validate links for 720/480/MP3";
    }
  }

  updateRedownloadButtonState(isRunning) {
    if (isRunning) {
      this.btnRebuildTable.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#stop"></use></svg>Click to Stop';
      this.btnRebuildTable.classList.replace("btn-outline-secondary", "btn-outline-danger");
      this.btnRebuildTable.title = "Click to stop redownloading";
    } else {
      this.btnRebuildTable.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#refresh"></use></svg>Rebuild Table';
      this.btnRebuildTable.classList.replace("btn-outline-danger", "btn-outline-secondary");
      this.btnRebuildTable.title = "Redownload the current table by ANN Song IDs";
    }
  }

  applyClientFilterFromUI() {
    const payload = {
      action: this.cfAction.value,
      field: this.cfField.value,
      query: String(this.cfQuery.value || ""),
      partial: this.cfPartial.checked,
      match_case: this.cfMatchCase.checked
    };
    this.results.applyClientFilter(payload);
  }

  updateClientFilterUI() {
    const field = this.cfField.value;

    switch (field) {
      case "Anime":
        this.cfQuery.placeholder = "Enter Anime";
        this.cfPartial.disabled = false;
        this.cfMatchCase.disabled = false;
        break;
      case "Anime Type":
        this.cfQuery.placeholder = "Enter Anime Type (e.g. TV, Movie, OVA)";
        this.cfPartial.disabled = false;
        this.cfMatchCase.disabled = false;
        break;
      case "Artist":
        this.cfQuery.placeholder = "Enter Artist";
        this.cfPartial.disabled = false;
        this.cfMatchCase.disabled = false;
        break;
      case "Song":
        this.cfQuery.placeholder = "Enter Song";
        this.cfPartial.disabled = false;
        this.cfMatchCase.disabled = false;
        break;
      case "Composer":
        this.cfQuery.placeholder = "Enter Composer";
        this.cfPartial.disabled = false;
        this.cfMatchCase.disabled = false;
        break;
      case "Arranger":
        this.cfQuery.placeholder = "Enter Arranger";
        this.cfPartial.disabled = false;
        this.cfMatchCase.disabled = false;
        break;
      case "Season":
        this.cfQuery.placeholder = "Enter Season or Year Range (e.g. Winter 2024, 1999-2000)";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
      case "Song Type":
        this.cfQuery.placeholder = "Enter Song Type (e.g. OP, ED, IN)";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
      case "Broadcast Type":
        this.cfQuery.placeholder = "Enter Broadcast Type (e.g. Normal, Dub, Rebroadcast)";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
      case "Song Category":
        this.cfQuery.placeholder = "Enter performance (e.g. Standard, Character, Chanting, Instrumental)";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
      case "ANN ID":
        this.cfQuery.placeholder = "Enter ANN ID(s), comma-separated";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
      case "Difficulty":
        this.cfQuery.placeholder = "Enter Difficulty Range (e.g. 60-100)";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
      case "Length":
        this.cfQuery.placeholder = "Enter Length Range in seconds (e.g. 60-90)";
        this.cfPartial.disabled = true;
        this.cfMatchCase.disabled = true;
        break;
    }
  }
}
