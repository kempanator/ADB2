class SearchView {
  constructor({ events, results, search, settings }) {
    Object.assign(this, { events, results, search, settings });
    this.searchQuery = document.querySelector("#search-query-input");
    this.searchAnime = document.querySelector("#search-anime-input");
    this.searchArtist = document.querySelector("#search-artist-input");
    this.searchSong = document.querySelector("#search-song-input");
    this.searchComposer = document.querySelector("#search-composer-input");
    this.simpleSearchMode = document.querySelector("#search-simple-fields");
    this.advancedSearchMode = document.querySelector("#search-advanced-fields");
    this.btnSearch = document.querySelector("#search-submit-button");
    this.searchLoading = document.querySelector("#search-loading-indicator");
    this.searchScope = document.querySelector("#search-scope-select");
    this.btnFilters = document.querySelector("#search-filters-button");
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
    this.btnSearchMode = document.querySelector("#search-mode-button");
    this.filterTypeTool = document.querySelector("#search-filter-type-control");
    this.wireEvents();
  }

  wireEvents() {
    this.btnSearch.addEventListener("click", () => this.emitSearch());
    this.searchQuery.addEventListener("keydown", e => { if (e.key === "Enter") this.emitSearch(); });
    this.advancedSearchMode.addEventListener("keydown", e => {
      if (e.key === "Enter") this.emitSearch();
    });
    document.querySelector("#search-filters-panel").addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.matches("input[type='text'], input[type='number']")) this.emitSearch();
    });
    this.searchScope.addEventListener("change", () => this.updateScopePlaceholder());
    this.updateScopePlaceholder();

    this.events.on("settings:changed", (payload) => {
      const newMode = payload?.key === "searchMode" ? payload.value : this.settings.get("searchMode");
      this.applySearchModeUI(newMode);
    });

    this.events.on("results:loading-changed", ({ loading }) => {
      this.btnSearch.disabled = loading;
      this.searchLoading.classList.toggle("d-none", !loading);
    });

    this.btnSearchMode.addEventListener("click", () => this.toggleSearchMode());

  }

  toggleSearchMode() {
    const newMode = this.settings.get("searchMode") === "simple" ? "advanced" : "simple";
    this.settings.set("searchMode", newMode);
  }

  emitSearch() {
    this.search.submitSearch({
      ...this.getSearchInputs(),
      ...this.getToggleStates(),
      search_mode: this.settings.get("searchMode"),
      result_mode: this.getResultMode()
    });
  }

  getSearchInputs() {
    const mode = this.settings.get("searchMode");
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

  getToggleStates() {
    const isAdvanced = this.settings.get("searchMode") === "advanced";
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

  getResultMode() {
    return this.results.resultMode || "new";
  }

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
}
