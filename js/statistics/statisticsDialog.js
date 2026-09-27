class StatisticsDialog {
  constructor({ results, settings, search, searchRequests, ui }) {
    this.results = results;
    this.settings = settings;
    this.search = search;
    this.searchRequests = searchRequests;
    this.ui = ui;
    this.charts = new Map();
    this.statsModal = document.getElementById("stats-modal");
    this.statsModal.addEventListener("click", event => {
      const button = event.target.closest(".stats-rank-search");
      if (!button || button.disabled) return;
      this.ui.hideModal(this.statsModal);
      this.search.submitSearch(this.searchRequests.relatedSearchPayload(button.dataset.scope, button.dataset.query));
    });
    this.statsModal.addEventListener("shown.ui.modal", () => this.loadStats());
    this.statsModal.addEventListener("hidden.ui.modal", () => {
      for (const chart of this.charts.values()) chart.destroy();
      this.charts.clear();
    });
  }

  formatNumber(value) {
    return new Intl.NumberFormat().format(value);
  }

  formatPercent(value, total) {
    return total ? Math.round(value / total * 100) + "%" : "0%";
  }

  element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  categoryOrder(values, preferred) {
    return [
      ...preferred.filter(label => values[label] > 0),
      ...Object.keys(values)
        .filter(label => values[label] > 0 && !preferred.includes(label))
        .sort((a, b) => values[b] - values[a] || a.localeCompare(b))
    ];
  }

  renderBars(id, values, preferred, total) {
    const container = document.getElementById(id);
    const labels = this.categoryOrder(values, preferred);
    if (!labels.length) {
      container.replaceChildren(this.element("p", "stats-empty", "No songs in table"));
      return;
    }

    const rows = labels.map(label => {
      const count = values[label];
      const row = this.element("div", "stats-bar-row");
      const name = this.element("span", "stats-bar-name", label);
      name.title = label;
      const track = this.element("span", "stats-bar-track");
      const fill = this.element("span", "stats-bar-fill");
      fill.style.width = this.formatPercent(count, total);
      track.append(fill);
      const value = this.element("strong", "stats-bar-value");
      value.append(
        this.element("span", "", this.formatNumber(count)),
        this.element("small", "", this.formatPercent(count, total))
      );
      row.append(name, track, value);
      return row;
    });
    container.replaceChildren(...rows);
  }

  renderRanks(id, entries, field, scope) {
    const container = document.getElementById(id);
    if (!entries.length) {
      container.replaceChildren(this.element("p", "stats-empty", "No songs in table"));
      return;
    }
    container.replaceChildren(...entries.map((entry, index) => {
      const row = this.element("div", "stats-rank-row");
      const name = this.element("span", "stats-rank-name", entry[field]);
      name.title = entry[field];
      name.dataset.copy = entry[field];
      name.tabIndex = 0;
      name.setAttribute("role", "button");
      name.setAttribute("aria-label", "Copy " + (field === "artist" ? "artist name" : "anime title") + ": " + entry[field]);
      const ids = entry.ids || [];
      const button = this.element("button", "search-icon-button stats-rank-search");
      button.type = "button";
      button.disabled = ids.length === 0 || ids.length > 500;
      button.title = button.disabled
        ? (ids.length ? "Too many IDs to search" : "No ID available")
        : "Search " + (field === "artist" ? "artist" : "ANN") + " ID" + (ids.length === 1 ? "" : "s");
      button.setAttribute("aria-label", button.title + " for " + entry[field]);
      button.dataset.scope = scope;
      button.dataset.query = ids.join(",");
      button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#search"></use></svg>';
      row.append(
        this.element("span", "stats-rank-index", String(index + 1)),
        button,
        name,
        this.element("strong", "stats-rank-count", this.formatNumber(entry.count))
      );
      return row;
    }));
  }

  renderMedia(data) {
    const container = document.getElementById("stats-media-values");
    const grid = this.element("div", "stats-media-grid");
    for (const [label, count] of [
      ["720p", data.total_links.HQ],
      ["480p", data.total_links.MQ],
      ["MP3", data.total_links.audio]
    ]) {
      const item = this.element("div", "stats-media-item");
      const line = this.element("div", "stats-media-line");
      line.append(
        this.element("span", "", label),
        this.element("strong", "", this.formatNumber(count) + " · " + this.formatPercent(count, data.total_songs))
      );
      const track = this.element("span", "stats-bar-track");
      const fill = this.element("span", "stats-bar-fill");
      fill.style.width = this.formatPercent(count, data.total_songs);
      track.append(fill);
      item.append(line, track);
      grid.append(item);
    }

    const footer = this.element("div", "stats-media-foot");
    for (const [label, value] of [
      ["Any media", this.formatNumber(data.playable_content.total) + " / " + this.formatNumber(data.total_songs)],
      ["Missing difficulty", this.formatNumber(data.missing_data.difficulty)],
      ["Missing length", this.formatNumber(data.missing_data.length)],
      ["Missing season", this.formatNumber(data.missing_data.season)]
    ]) {
      const item = this.element("span", "");
      item.append(label + ": ", this.element("strong", "", value));
      footer.append(item);
    }
    container.replaceChildren(grid, footer);
  }

  renderChart(id, labels, values) {
    const canvas = document.getElementById(id);
    const wrapper = canvas.parentElement;
    this.charts.get(id)?.destroy();
    this.charts.delete(id);
    if (!window.Chart || !labels.length || !values.some(value => value > 0)) {
      wrapper.dataset.message = !window.Chart ? "Chart.js unavailable" : "No data in table";
      return;
    }
    delete wrapper.dataset.message;

    const style = getComputedStyle(document.documentElement);
    const color = name => style.getPropertyValue(name).trim();
    const total = values.reduce((sum, value) => sum + value, 0);
    const muted = color("--muted");
    const grid = color("--border-color");
    this.charts.set(id, new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Songs",
          data: values,
          backgroundColor: color("--primary"),
          borderRadius: 2,
          maxBarThickness: 30
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: labels.length > 10 ? 13 : 10 },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: muted, precision: 0, callback: value => this.formatNumber(value) },
            grid: { color: grid }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => this.formatNumber(context.parsed.y) + " songs (" +
                this.formatPercent(context.parsed.y, total) + ")"
            }
          }
        }
      }
    }));
  }

  renderDifficulty(data) {
    const labels = [
      "1–10", "11–20", "21–30", "31–40", "41–50",
      "51–60", "61–70", "71–80", "81–90", "91–100"
    ];
    this.renderChart("stats-difficulty-chart", labels, data.difficulty_histogram);
  }

  renderVintage(data) {
    const counts = Object.create(null);
    for (const [vintage, count] of Object.entries(data.vintage_distribution)) {
      const year = vintage.match(/\b(?:19|20)\d{2}\b/)?.[0];
      if (year) counts[year] = (counts[year] || 0) + count;
    }
    const labels = Object.keys(counts).sort((a, b) => Number(a) - Number(b));
    this.renderChart("stats-vintage-chart", labels, labels.map(year => counts[year]));
  }

  render(data) {
    for (const [id, value] of [
      ["stats-total-songs", this.formatNumber(data.total_songs)],
      ["stats-total-anime", this.formatNumber(data.total_anime)],
      ["stats-total-artists", this.formatNumber(data.total_artists)],
      ["stats-total-seasons", this.formatNumber(data.total_seasons)],
      ["stats-average-difficulty", data.average_difficulty > 0 ? data.average_difficulty.toFixed(2) : "—"],
      ["stats-average-song-length", formatDurationSeconds(data.average_length_seconds) || "—"]
    ]) document.getElementById(id).textContent = value;

    this.renderBars("stats-song-types-values", data.songs_by_type,
      ["Opening", "Ending", "Insert", "Unknown"], data.total_songs);
    this.renderBars("stats-song-categories-values", data.songs_by_category,
      ["Standard", "Character", "Chanting", "Instrumental", "No Performance"], data.total_songs);
    this.renderBars("stats-broadcast-types-values", data.songs_by_broadcast,
      ["Normal", "Dub", "Rebroadcast", "Dub/Rebroadcast"], data.total_songs);
    this.renderBars("stats-anime-types-values", data.songs_by_anime_type,
      ["TV", "Movie", "OVA", "ONA", "Special", "Unknown"], data.total_songs);
    this.renderDifficulty(data);
    this.renderVintage(data);
    this.renderRanks("stats-top-artists-values", data.top_artists, "artist", "ARTIST_ID");
    this.renderRanks("stats-top-anime-values", data.top_anime, "anime", "ANN");
    this.renderMedia(data);
  }

  loadStats() {
    try {
      const rows = this.results.model.getRows();
      this.render(calculateSongStats(rows, this.settings.get("language")));
    } catch (error) {
      console.error("Statistics calculation failed:", error);
    }
  }
}
