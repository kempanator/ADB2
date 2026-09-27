class SearchController {
  constructor({ api, notify, resultsLoader, searchRequests }) {
    Object.assign(this, { api, notify, resultsLoader, searchRequests });
  }

  submitSearch(payload) {
    try {
      const request = this.searchRequests.fromPayload(payload);
      return this.makeSearchRequest(request, payload.result_mode === "append");
    } catch (error) {
      this.notify(error.message || String(error), "warning");
    }
  }

  makeSearchRequest(request, isAppend) {
    return this.resultsLoader.run(signal => this.api.searchSongs(request, signal), isAppend, {
      transform: rows => this.sortBySongType(rows)
    });
  }

  loadStartupRandomSongs() {
    return this.resultsLoader.run(
      signal => this.api.getRandomSongs(signal),
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

  getSongTypeRank(typeValue) {
    const { rank, number } = parseSongType(typeValue);
    return { group: rank, number };
  }

  // Broadcast weight: Normal (0), Dub only (1), Rebroadcast only (2), both (3)
  broadcastWeight(row) {
    const isDub = songBoolean(row?.isDub);
    const isRebroadcast = songBoolean(row?.isRebroadcast);
    return (isDub ? 1 : 0) + (isRebroadcast ? 2 : 0);
  }

  safeNum(v) {
    return optionalSongNumber(v) ?? Number.POSITIVE_INFINITY;
  }
}
