class SearchManager {
  constructor() {
    eventBus.on("search:submit", (payload) => this.submitSearch(payload));
  }

  // Every search entry point supplies its own inputs and result mode.
  submitSearch(payload) {
    try {
      const request = searchRequestBuilder.fromPayload(payload);
      this.makeSearchRequest(`${API_BASE}${request.endpoint}`, request.body, payload.result_mode === "append");
    } catch (error) {
      showAlert(error.message || String(error), "warning");
    }
  }

  // Makes a search request to the API
  makeSearchRequest(url, body, isAppend) {
    tableRequestManager.run(signal => apiClient.postJson(url, body, signal), isAppend, {
      transform: rows => this.sortBySongType(rows)
    });
  }

  loadStartupRandomSongs() {
    tableRequestManager.run(
      signal => apiClient.postJson(`${API_BASE}/api/get_50_random_songs`, {}, signal),
      false
    );
  }

  // Sort rows by ANN ID group, then by song type within each group (OP/ED/IN with ascending number),
  // and for ties (e.g., two OP1), order by broadcast: Normal, then Dub, then Rebroadcast.
  sortBySongType(rows) {
    if (!Array.isArray(rows)) return rows;
    const copy = rows.slice();
    copy.sort((a, b) => {
      const annA = this.safeNum(a?.annId);
      const annB = this.safeNum(b?.annId);
      if (annA !== annB) return annA - annB;

      const ra = this.getSongTypeRank(a?.songType);
      const rb = this.getSongTypeRank(b?.songType);
      if (ra.group !== rb.group) return ra.group - rb.group;
      if (ra.number !== rb.number) return ra.number - rb.number;

      const ba = this.broadcastWeight(a);
      const bb = this.broadcastWeight(b);
      if (ba !== bb) return ba - bb;
      return 0;
    });
    return copy;
  }

  // Get song type rank for sorting
  getSongTypeRank(typeValue) {
    const raw = String(typeValue || "").trim();
    const upper = raw.toUpperCase();
    const numberMatch = raw.match(/\d+/);
    const number = numberMatch ? parseInt(numberMatch[0], 10) || 0 : 0;

    if (upper.startsWith("OPENING") || upper.startsWith("OP")) {
      return { group: 1, number };
    }
    if (upper.startsWith("ENDING") || upper.startsWith("ED")) {
      return { group: 2, number };
    }
    if (upper.startsWith("INSERT") || upper.startsWith("IN")) {
      return { group: 3, number };
    }
    return { group: 99, number };
  }

  // Broadcast weight: Normal (0), Dub only (1), Rebroadcast only (2), both (3)
  broadcastWeight(row) {
    const isDub = songBoolean(row?.isDub);
    const isRebroadcast = songBoolean(row?.isRebroadcast);
    return (isDub ? 1 : 0) + (isRebroadcast ? 2 : 0);
  }

  // Safe numeric parse for ANN ID sorting
  safeNum(v) {
    return optionalSongNumber(v) ?? Number.POSITIVE_INFINITY;
  }
}

const searchManager = new SearchManager();
