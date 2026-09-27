class AnisongDbClient {
  constructor({ baseUrl, clientName }) {
    Object.assign(this, { baseUrl, clientName });
  }

  searchSongs(request, signal) {
    return this.postJson(request.endpoint, request.body, signal);
  }

  getRandomSongs(signal) {
    return this.postJson("/api/get_50_random_songs", {}, signal);
  }

  getSongBatch(ids, signal) {
    return this.postJson("/api/ann_song_ids_request", { ann_song_ids: ids }, signal);
  }

  async postJson(path, body, signal) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Id": this.clientName },
      body: JSON.stringify(body || {}),
      signal
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const error = new Error(this.formatErrorDetail(data) || `HTTP ${response.status}`);
      error.status = response.status;
      error.response = data;
      throw error;
    }
    if (!Array.isArray(data) || data.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
      throw new Error("The API returned an invalid song list.");
    }
    return data;
  }

  formatErrorDetail(data) {
    if (!data) return null;
    const detail = data.detail ?? data.message;
    if (detail == null) return null;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map(item => {
        if (typeof item === "string") return item;
        const loc = Array.isArray(item?.loc) ? item.loc.filter(part => part !== "body").join(".") : "";
        const message = item?.msg || JSON.stringify(item);
        return loc ? `${loc}: ${message}` : message;
      }).join("; ");
    }
    if (typeof detail === "object") {
      try { return JSON.stringify(detail); } catch { return String(detail); }
    }
    return String(detail);
  }

  async getSongsByAnnIds(annSongIds, signal) {
    const ids = Array.isArray(annSongIds) ? annSongIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0) : [];
    if (!ids.length) return [];
    const all = [];
    for (let index = 0; index < ids.length; index += 500) {
      const data = await this.getSongBatch(ids.slice(index, index + 500), signal);
      all.push(...data);
    }
    // API batches may arrive in a different order. Playlists retain saved order.
    const byId = new Map(all.map(row => [Number(row.annSongId), row]));
    return ids.map(id => byId.get(id)).filter(Boolean);
  }
}
