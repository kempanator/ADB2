// Turn either search form into one validated API request without reading the DOM.
class SearchRequestBuilder {
  static ToggleKeys = [
    "partial_match", "match_case", "arrangement", "opening_filter", "ending_filter",
    "insert_filter", "max_other_artist", "group_granularity", "and_logic",
    "ignore_duplicate", "normal_broadcast", "dub", "rebroadcast", "standard",
    "character", "chanting", "instrumental", "tv_filter", "movie_filter",
    "ova_filter", "ona_filter", "special_filter", "other_filter", "season_start",
    "season_end", "season_range", "difficulty", "genres", "tags"
  ];

  // Searches launched from song details or table values use every catalog category.
  relatedSearchPayload(scope, query) {
    return {
      scope, query, result_mode: "new", partial_match: false, match_case: false,
      arrangement: true, opening_filter: true, ending_filter: true, insert_filter: true,
      max_other_artist: 99, group_granularity: 0, and_logic: false,
      ignore_duplicate: false, normal_broadcast: true, dub: true, rebroadcast: true,
      standard: true, character: true, chanting: true, instrumental: true,
      tv_filter: true, movie_filter: true, ova_filter: true, ona_filter: true,
      special_filter: true, other_filter: true
    };
  }

  fromPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid search payload.");
    const toggles = Object.fromEntries(SearchRequestBuilder.ToggleKeys
      .filter(key => payload[key] !== undefined).map(key => [key, payload[key]]));
    const simple = payload.search_mode !== "advanced" && Boolean(payload.scope && Object.hasOwn(payload, "query"));
    const advanced = !simple && (payload.search_mode === "advanced" || ["anime", "artist", "song", "composer"].some(key => payload[key]));
    if (!simple && !advanced) throw new Error("Invalid search payload.");
    const inputs = simple
      ? { scope: payload.scope, query: payload.query }
      : Object.fromEntries(["anime", "artist", "song", "composer"].map(key => [key, payload[key]]));
    return this.build(inputs, toggles, advanced);
  }

  build(inputs, rawToggles, advanced) {
    const toggles = this.normalizeToggles(rawToggles);
    const base = this.baseBody(toggles);
    this.validateFilters(base.filters);
    if (advanced) {
      const terms = Object.fromEntries(["anime", "artist", "song", "composer"]
        .map(key => [key, String(inputs[key] ?? "").trim()]));
      if (!Object.values(terms).some(Boolean)) throw new Error("Please enter at least one search term.");
      const body = { ...base };
      for (const [key, target] of [
        ["anime", "anime_search_filter"], ["artist", "artist_search_filter"],
        ["song", "song_name_search_filter"], ["composer", "composer_search_filter"]
      ]) {
        if (terms[key]) body[target] = this.textFilter(terms[key], toggles, key);
      }
      return { endpoint: "/api/search_request", body };
    }

    const scope = String(inputs.scope || "All");
    const query = String(inputs.query ?? "").trim();
    if (scope === "Season") {
      const season = this.parseSeason(query);
      if (!season) throw new Error("Invalid season. Use e.g. 'Spring 2024'.");
      return { endpoint: "/api/season_request", body: { season, ...base } };
    }
    const idScopes = {
      ANN: ["ANN IDs", "ann_ids", "/api/ann_ids_request"],
      ANN_SONG: ["ANN Song IDs", "ann_song_ids", "/api/ann_song_ids_request"],
      AMQ_SONG: ["AMQ Song IDs", "amq_song_ids", "/api/amq_song_ids_request"],
      MAL: ["MAL IDs", "mal_ids", "/api/mal_ids_request"],
      ARTIST_ID: ["Artist IDs", "artist_ids", "/api/artist_ids_request"],
      COMPOSER_ID: ["Composer IDs", "composer_ids", "/api/composer_ids_request"]
    };
    if (idScopes[scope]) {
      const [label, key, endpoint] = idScopes[scope];
      return { endpoint, body: { [key]: this.parseIdList(query, label), ...base } };
    }
    if (scope === "RANDOM") {
      return { endpoint: "/api/get_n_random_songs", body: { n: this.parseRandomCount(query), ...base } };
    }

    const body = { ...base };
    const targets = { Anime: "anime_search_filter", Song: "song_name_search_filter", Artist: "artist_search_filter", Composer: "composer_search_filter" };
    const fields = targets[scope] ? [scope] : ["Anime", "Song", "Artist", "Composer"];
    for (const field of fields) {
      if (targets[field]) body[targets[field]] = this.textFilter(query, toggles, field.toLowerCase());
    }
    return { endpoint: "/api/search_request", body };
  }

  textFilter(query, toggles, field) {
    const filter = { search: query, partial_match: toggles.partial_match, match_case: toggles.match_case };
    if (field === "artist" || field === "composer") {
      filter.group_granularity = toggles.group_granularity;
      filter.max_other_artist = toggles.max_other_artist;
    }
    if (field === "composer") filter.arrangement = toggles.arrangement;
    return filter;
  }

  baseBody(toggles) {
    const filters = {
      song_types: [["opening_filter", "opening"], ["ending_filter", "ending"], ["insert_filter", "insert"]]
        .filter(([key]) => toggles[key]).map(([, value]) => value),
      broadcasts: [["normal_broadcast", "normal"], ["dub", "dub"], ["rebroadcast", "rebroadcast"]]
        .filter(([key]) => toggles[key]).map(([, value]) => value),
      song_categories: [
        ...(toggles.standard ? ["standard", "other"] : []),
        ...[["character", "character"], ["chanting", "chanting"], ["instrumental", "instrumental"]]
          .filter(([key]) => toggles[key]).map(([, value]) => value)
      ],
      anime_types: [["tv_filter", "tv"], ["movie_filter", "movie"], ["ova_filter", "ova"],
        ["ona_filter", "ona"], ["special_filter", "special"], ["other_filter", "other"]]
        .filter(([key]) => toggles[key]).map(([, value]) => value)
    };
    if (toggles.season_start || toggles.season_end) {
      filters.season = {};
      if (toggles.season_start) filters.season.start = toggles.season_start;
      if (toggles.season_end) filters.season.end = toggles.season_end;
    }
    if (toggles.difficulty_start != null || toggles.difficulty_end != null || toggles.include_no_difficulty) {
      filters.difficulty = {};
      if (toggles.difficulty_start != null) filters.difficulty.start = toggles.difficulty_start;
      if (toggles.difficulty_end != null) filters.difficulty.end = toggles.difficulty_end;
      if (toggles.include_no_difficulty) filters.difficulty.include_no_difficulty = true;
    }
    if (toggles.genres.length) filters.genres = { require_all: toggles.genres };
    if (toggles.tags.length) filters.tags = { require_all: toggles.tags };
    return { and_logic: toggles.and_logic, ignore_duplicate: toggles.ignore_duplicate, filters };
  }

  validateFilters(filters) {
    if (!filters.song_types.length) throw new Error("At least one song type filter (OP, ED, IN) must be enabled.");
    if (!filters.broadcasts.length) throw new Error("At least one broadcast filter (Normal, Dub, Rebroadcast) must be enabled.");
    if (!filters.song_categories.length) throw new Error("At least one performance filter (Standard, Character, Chanting, Instrumental) must be enabled.");
    if (!filters.anime_types.length) throw new Error("At least one anime type filter must be enabled.");
  }

  normalizeToggles(source) {
    const toggles = { ...source };
    for (const key of ["genres", "tags"]) {
      const labels = String(toggles[key] ?? "").split(",").map(label => label.trim()).filter(Boolean);
      if (labels.length > 100) throw new Error(`Too many ${key} (max 100).`);
      if (labels.some(label => label.length > 500)) throw new Error(`${key === "genres" ? "Genre" : "Tag"} names must be 500 characters or fewer.`);
      const seen = new Set();
      toggles[key] = labels.filter(label => {
        const normalized = label.toLocaleLowerCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    }
    const seasonRange = String(toggles.season_range ?? "").trim();
    delete toggles.season_range;
    if (seasonRange) {
      const match = /^((?:winter|spring|summer|fall)\s+\d{4})(?:\s*[-–—]\s*((?:winter|spring|summer|fall)\s+\d{4}))?$/i.exec(seasonRange);
      if (!match) throw new Error("Invalid season range. Use 'Spring 2020 - Fall 2024' or one season.");
      const start = this.parseSeason(match[1]);
      const end = this.parseSeason(match[2] || match[1]);
      const seasonIndex = season => Number(season.slice(-4)) * 4 + ["Winter", "Spring", "Summer", "Fall"].indexOf(season.split(" ")[0]);
      if (seasonIndex(start) > seasonIndex(end)) throw new Error("Season range must run from earlier to later.");
      toggles.season_start = start;
      toggles.season_end = end;
    }
    for (const [key, label] of [["season_start", "start"], ["season_end", "end"]]) {
      const raw = String(toggles[key] ?? "").trim();
      if (!raw) { delete toggles[key]; continue; }
      const season = this.parseSeason(raw);
      if (!season) throw new Error(`Invalid season ${label}. Use e.g. 'Spring 2024'.`);
      toggles[key] = season;
    }
    delete toggles.difficulty_start;
    delete toggles.difficulty_end;
    delete toggles.include_no_difficulty;
    const difficulty = String(toggles.difficulty ?? "").trim();
    delete toggles.difficulty;
    if (difficulty) {
      if (/^(0|none|null)$/i.test(difficulty)) toggles.include_no_difficulty = true;
      else {
        const range = this.parseDifficultyRange(difficulty);
        if (!range) throw new Error("Invalid difficulty. Use a number or range from 0 to 100 (e.g. 60 or 60-100), or none.");
        toggles.difficulty_start = range.start;
        toggles.difficulty_end = range.end;
      }
    }
    return toggles;
  }

  parseSeason(query) {
    const match = /^(winter|spring|summer|fall)\s+(\d{4})$/i.exec(String(query ?? "").trim());
    return match ? `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}` : null;
  }

  parseDifficultyRange(query) {
    const match = /^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?$/.exec(query);
    if (!match) return null;
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 0 || first > 100 || last < 0 || last > 100) return null;
    return { start: Math.min(first, last), end: Math.max(first, last) };
  }

  parseRandomCount(query) {
    if (!query) throw new Error("Enter the number of random songs (1–500).");
    if (!/^\d+$/.test(query)) throw new Error("Number of random songs must be a whole number from 1 to 500.");
    const n = Number(query);
    if (n < 1 || n > 500) throw new Error("Number of random songs must be between 1 and 500.");
    return n;
  }

  parseIdList(query, label) {
    const ids = [];
    for (const raw of query.split(",").map(part => part.trim()).filter(Boolean)) {
      const segment = raw.replace(/\s*-\s*/, "-");
      const range = /^(\d+)-(\d+)$/.exec(segment);
      if (range) {
        const first = Number(range[1]);
        const last = Number(range[2]);
        if (first > last) throw new Error(`${label} ranges must be ascending.`);
        if (ids.length + last - first + 1 > 500) throw new Error(`Too many ${label} (max 500).`);
        for (let id = first; id <= last; id++) ids.push(id);
      } else {
        if (!/^\d+$/.test(segment)) throw new Error(`${label} must be numeric or ranges (comma-separated).`);
        if (ids.length >= 500) throw new Error(`Too many ${label} (max 500).`);
        ids.push(Number(segment));
      }
    }
    if (!ids.length) throw new Error(`Enter ${label}.`);
    return ids;
  }
}

const searchRequestBuilder = new SearchRequestBuilder();
