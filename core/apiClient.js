// Shared AnisongDB requests; callers own what happens to the returned rows.
class ApiClient {
  async postJson(url, body, signal) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Id": CLIENT_NAME },
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

  async fetchRowsByAnnSongIds(annSongIds, signal) {
    const ids = Array.isArray(annSongIds) ? annSongIds.map(Number).filter(Number.isFinite) : [];
    if (!ids.length) return [];
    const all = [];
    for (let index = 0; index < ids.length; index += 500) {
      const data = await this.postJson(`${API_BASE}/api/ann_song_ids_request`,
        { ann_song_ids: ids.slice(index, index + 500) }, signal);
      if (Array.isArray(data)) all.push(...data);
    }
    // API batches may arrive in a different order. Playlists retain saved order.
    const byId = new Map(all.map(row => [Number(row.annSongId), row]));
    return ids.map(id => byId.get(id)).filter(Boolean);
  }
}

const apiClient = new ApiClient();
