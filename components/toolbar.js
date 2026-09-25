class Toolbar {
  // Initialize toolbar and cache DOM references
  constructor() {
    // Header Buttons
    this.btnPrevSong = document.querySelector("#player-previous-button");
    this.btnNextSong = document.querySelector("#player-next-button");
    // Query Inputs
    this.searchQuery = document.querySelector("#search-query-input");
    this.searchAnime = document.querySelector("#search-anime-input");
    this.searchArtist = document.querySelector("#search-artist-input");
    this.searchSong = document.querySelector("#search-song-input");
    this.searchComposer = document.querySelector("#search-composer-input");
    this.simpleSearchMode = document.querySelector("#search-simple-fields");
    this.advancedSearchMode = document.querySelector("#search-advanced-fields");
    // Buttons
    this.btnSearch = document.querySelector("#search-submit-button");
    this.searchLoading = document.querySelector("#search-loading-indicator");
    this.searchScope = document.querySelector("#search-scope-select");
    this.btnFilters = document.querySelector("#search-filters-button");
    this.btnTable = document.querySelector("#results-options-button");
    // Data Dropdown
    this.btnExportCSV = document.querySelector("#data-export-csv-button");
    this.btnExportJSON = document.querySelector("#data-export-json-button");
    this.btnImportFile = document.querySelector("#data-import-button");
    this.songListFileInput = document.querySelector("#data-import-file-input");
    // Request Filters
    this.chkPartial = document.querySelector("#filter-partial-match");
    this.chkMatchCase = document.querySelector("#filter-match-case");
    this.chkArrangement = document.querySelector("#filter-arrangement");
    this.chkOP = document.querySelector("#filter-song-type-op");
    this.chkED = document.querySelector("#filter-song-type-ed");
    this.chkIN = document.querySelector("#filter-song-type-in");
    this.inpMaxOther = document.querySelector("#filter-max-other-people-input");
    this.inpGroupMin = document.querySelector("#filter-min-group-members-input");
    this.selFilterType = document.querySelector("#search-filter-type-select");
    this.chkIgnoreDup = document.querySelector("#filter-ignore-duplicates");
    this.chkNormal = document.querySelector("#filter-broadcast-normal");
    this.chkDub = document.querySelector("#filter-broadcast-dub");
    this.chkRebroadcast = document.querySelector("#filter-broadcast-rebroadcast");
    this.chkStandard = document.querySelector("#filter-performance-standard");
    this.chkCharacter = document.querySelector("#filter-performance-character");
    this.chkChanting = document.querySelector("#filter-performance-chanting");
    this.chkInstrumental = document.querySelector("#filter-performance-instrumental");
    this.chkTV = document.querySelector("#filter-anime-type-tv");
    this.chkMovie = document.querySelector("#filter-anime-type-movie");
    this.chkOVA = document.querySelector("#filter-anime-type-ova");
    this.chkONA = document.querySelector("#filter-anime-type-ona");
    this.chkSpecial = document.querySelector("#filter-anime-type-special");
    this.chkOther = document.querySelector("#filter-anime-type-other");
    this.inpSeasonRange = document.querySelector("#filter-season-range-input");
    this.inpDifficulty = document.querySelector("#filter-difficulty-input");
    this.inpGenre = document.querySelector("#filter-genre-input");
    this.inpTag = document.querySelector("#filter-tag-input");
    // Table Operations
    this.btnShuffle = document.querySelector("#table-shuffle-button");
    this.btnReverse = document.querySelector("#table-reverse-button");
    this.btnClearTable = document.querySelector("#table-clear-button");
    this.btnCheckLinks = document.querySelector("#table-check-links-button");
    this.btnRebuildTable = document.querySelector("#table-rebuild-button");
    this.btnCheckSongIds = document.querySelector("#table-check-song-ids-button");
    this.btnSearchMode = document.querySelector("#search-mode-button");
    this.filterTypeTool = document.querySelector("#search-filter-type-control");
    this.quickColumnOptions = document.querySelector("#results-column-options");
    this.btnManageColumns = document.querySelector("#results-manage-columns-button");
    this.resultMode = document.querySelector("#results-mode-control");
    // Client Filters
    this.cfAction = document.querySelector("#table-filter-action-select");
    this.cfField = document.querySelector("#table-filter-field-select");
    this.cfQuery = document.querySelector("#table-filter-query-input");
    this.cfPartial = document.querySelector("#table-filter-partial-match");
    this.cfMatchCase = document.querySelector("#table-filter-match-case");
    this.btnApplyClientFilter = document.querySelector("#table-filter-apply-button");

    this.wireEvents();
  }

  // Wire UI events and global event handlers
  wireEvents() {
    // Search UI wiring: trigger submit and manage placeholders
    this.btnSearch.addEventListener("click", () => this.emitSearch());
    this.searchQuery.addEventListener("keydown", e => { if (e.key === "Enter") this.emitSearch(); });
    this.advancedSearchMode.addEventListener("keydown", e => {
      if (e.key === "Enter") this.emitSearch();
    });
    document.querySelector("#search-filters-panel").addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.matches("input[type='text'], input[type='number']")) this.emitSearch();
    });
    this.searchScope.addEventListener("change", () => this.updateScopePlaceholder());
    this.cfField.addEventListener("change", () => this.updateClientFilterUI());
    this.updateScopePlaceholder();
    this.updateClientFilterUI();
    // React to searchMode changes (settings:changed event)
    eventBus.on("settings:changed", (payload) => {
      const newMode = payload?.key === "searchMode" ? payload.value : settingsManager.get("searchMode");
      this.applySearchModeUI(newMode);
    });

    // Data operations
    this.btnExportCSV.addEventListener("click", () => tableManager.export("csv"));
    this.btnExportJSON.addEventListener("click", () => tableManager.export("json"));
    this.btnImportFile.addEventListener("click", () => this.songListFileInput.click());
    this.songListFileInput.addEventListener("change", (event) => tableManager.onSongListUpload(event));

    // Player controls
    this.btnPrevSong.addEventListener("click", () => eventBus.emit("audio:previous"));
    this.btnNextSong.addEventListener("click", () => eventBus.emit("audio:next"));

    // Table operations
    this.btnShuffle.addEventListener("click", () => eventBus.emit("table:shuffle"));
    this.btnReverse.addEventListener("click", () => eventBus.emit("table:reverse"));
    this.btnClearTable.addEventListener("click", () => eventBus.emit("table:clear"));
    this.btnCheckLinks.addEventListener("click", () => eventBus.emit("table:check-links-toggle"));
    this.btnRebuildTable.addEventListener("click", () => eventBus.emit("table:redownload-toggle"));
    this.btnCheckSongIds.addEventListener("click", () => eventBus.emit("table:check-song-ids"));
    eventBus.on("table:task-state-changed", ({ task, running }) => {
      if (task === "redownload") this.updateRedownloadButtonState(running);
      if (task === "link-check") this.updateCheckLinksButtonState(running);
    });
    eventBus.on("table:request-state-changed", ({ loading }) => {
      this.btnSearch.disabled = loading;
      this.searchLoading.classList.toggle("d-none", !loading);
    });

    // Client filter apply
    this.btnApplyClientFilter.addEventListener("click", () => this.applyClientFilterFromUI());
    this.cfQuery.addEventListener("keydown", (e) => { if (e.key === "Enter") this.applyClientFilterFromUI(); });
    this.quickColumnOptions.addEventListener("change", event => {
      const input = event.target.closest("input[data-column]");
      if (!input || !this.quickColumnOptions.contains(input)) return;
      settingsManager.set("visibleColumns", {
        ...settingsManager.get("visibleColumns"), [input.dataset.column]: input.checked
      });
    });
    eventBus.on("ui:column-visibility-changed", () => this.renderQuickColumns());
    eventBus.on("ui:column-order-changed", () => this.renderQuickColumns());
    this.btnManageColumns.addEventListener("click", () => {
      eventBus.emit("settings:open-columns");
    });

    // Search mode toggle
    this.btnSearchMode.addEventListener("click", () => this.toggleSearchMode());
    eventBus.on("search:mode-toggle", () => this.toggleSearchMode());

    // Result mode button group sync to state
    this.resultMode.addEventListener("click", event => {
      const target = event.target.closest(".btn");
      if (!target || !this.resultMode.contains(target)) return;
      const mode = target.dataset.mode || "new";
      this.resultMode.querySelectorAll(".btn").forEach(button => {
        button.classList.toggle("active", button === target);
        button.setAttribute("aria-pressed", String(button === target));
      });
      appState.updateStateSlice("ui.resultMode", () => mode);
    });
  }

  toggleSearchMode() {
    const newMode = settingsManager.get("searchMode") === "simple" ? "advanced" : "simple";
    settingsManager.set("searchMode", newMode);
  }

  emitSearch() {
    eventBus.emit("search:submit", {
      ...this.getSearchInputs(),
      ...this.getToggleStates(),
      search_mode: settingsManager.get("searchMode"),
      result_mode: this.getResultMode()
    });
  }

  // Read current search input values
  getSearchInputs() {
    const mode = settingsManager.get("searchMode");
    if (mode === "advanced") {
      return {
        anime: String(this.searchAnime.value || "").trim(),
        artist: String(this.searchArtist.value || "").trim(),
        song: String(this.searchSong.value || "").trim(),
        composer: String(this.searchComposer.value || "").trim()
      };
    }
    return {
      scope: this.searchScope.value,
      query: String(this.searchQuery.value || "").trim()
    };
  }

  // Read toggle states for building search payloads
  getToggleStates() {
    const isAdvanced = settingsManager.get("searchMode") === "advanced";
    return {
      partial_match: this.chkPartial.checked,
      match_case: this.chkMatchCase.checked,
      arrangement: this.chkArrangement.checked,
      opening_filter: this.chkOP.checked,
      ending_filter: this.chkED.checked,
      insert_filter: this.chkIN.checked,
      max_other_artist: parseInt(this.inpMaxOther.value, 10) || 0,
      group_granularity: parseInt(this.inpGroupMin.value, 10) || 0,
      and_logic: isAdvanced ? this.selFilterType.value === "intersection" : false,
      ignore_duplicate: this.chkIgnoreDup.checked,
      normal_broadcast: this.chkNormal.checked,
      dub: this.chkDub.checked,
      rebroadcast: this.chkRebroadcast.checked,
      standard: this.chkStandard.checked,
      character: this.chkCharacter.checked,
      chanting: this.chkChanting.checked,
      instrumental: this.chkInstrumental.checked,
      tv_filter: this.chkTV.checked,
      movie_filter: this.chkMovie.checked,
      ova_filter: this.chkOVA.checked,
      ona_filter: this.chkONA.checked,
      special_filter: this.chkSpecial.checked,
      other_filter: this.chkOther.checked,
      season_range: String(this.inpSeasonRange.value || "").trim(),
      difficulty: String(this.inpDifficulty.value || "").trim(),
      genres: String(this.inpGenre.value || "").trim(),
      tags: String(this.inpTag.value || "").trim()
    };
  }

  // Switch UI between simple and multi-field search modes
  applySearchModeUI(mode) {
    const isAdvanced = mode === "advanced";
    this.filterTypeTool.classList.toggle("d-none", !isAdvanced);
    if (isAdvanced) {
      this.simpleSearchMode.classList.add("d-none");
      this.advancedSearchMode.classList.remove("d-none");
      this.selFilterType.disabled = false;
    } else {
      this.advancedSearchMode.classList.add("d-none");
      this.simpleSearchMode.classList.remove("d-none");
      this.selFilterType.disabled = true;
    }
    this.btnSearchMode.title = isAdvanced ? "Switch to simple search" : "Switch to multi-field search";
    this.btnSearchMode.setAttribute("aria-label", this.btnSearchMode.title);
    this.btnSearchMode.setAttribute("aria-pressed", String(isAdvanced));
  }

  renderQuickColumns() {
    const focusedKey = this.quickColumnOptions.contains(document.activeElement)
      ? document.activeElement.dataset.column : null;
    const visible = settingsManager.get("visibleColumns");
    this.quickColumnOptions.innerHTML = settingsManager.get("columnOrder").map(key => `
      <label class="results-column-option"><input type="checkbox" data-column="${key}" ${visible[key] ? "checked" : ""}>
        <span>${TableColumns[key]?.settingsLabel || TableColumns[key]?.label || key}</span></label>
    `).join("");
    if (focusedKey) this.quickColumnOptions.querySelector(`[data-column="${focusedKey}"]`)?.focus();
  }

  // Get the current result mode ("new" or "append")
  getResultMode() {
    return appState.getStateSlice("ui.resultMode") || "new";
  }

  // Update the Check Links button label/icon based on running state
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

  // Update the Redownload button label/icon based on running state
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

  // Emit client filter payload from UI controls
  applyClientFilterFromUI() {
    const payload = {
      action: this.cfAction.value,
      field: this.cfField.value,
      query: String(this.cfQuery.value || ""),
      partial: this.cfPartial.checked,
      match_case: this.cfMatchCase.checked
    };
    eventBus.emit("table:client-filter-apply", payload);
  }

  // Update placeholder for the simple search input based on scope
  updateScopePlaceholder() {
    const scope = this.searchScope.value;
    const placeholderMap = {
      Anime: "Search anime",
      Artist: "Search artist",
      Song: "Search song",
      Composer: "Search composer",
      Season: "e.g. Winter 2024",
      ANN: "Enter ANN ID(s), comma-separated",
      ANN_SONG: "Enter ANN Song ID(s), comma-separated",
      AMQ_SONG: "Enter AMQ Song ID(s), comma-separated",
      ARTIST_ID: "Enter Artist ID(s), comma-separated",
      COMPOSER_ID: "Enter Composer ID(s), comma-separated",
      MAL: "Enter MAL ID(s), comma-separated",
      RANDOM: "Number of random songs (1–500)",
    };
    const placeholder = placeholderMap[scope] || "Search anime, artist, song, composer";
    this.searchQuery.placeholder = placeholder;
  }

  // Update client filter UI based on action
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

const toolbar = new Toolbar();
