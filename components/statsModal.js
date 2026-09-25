class StatsModal {
  constructor() {
    this.charts = {};
    this.latestStats = null;

    // Cache the panels and controls used during chart updates.
    this.statsModal = document.querySelector("#stats-modal");
    this.statsContent = document.querySelector("#stats-content");
    this.totalSongs = document.querySelector("#stats-total-songs");
    this.totalAnime = document.querySelector("#stats-total-anime");
    this.totalArtists = document.querySelector("#stats-total-artists");
    this.totalSeasons = document.querySelector("#stats-total-seasons");
    this.avgDifficulty = document.querySelector("#stats-average-difficulty");
    this.avgSongLength = document.querySelector("#stats-average-song-length");
    this.topArtistsNumbers = document.querySelector("#stats-top-artists-values");
    this.topAnimeNumbers = document.querySelector("#stats-top-anime-values");
    this.btnSongTypesToggle = document.querySelector("#stats-song-types-toggle");
    this.songTypesNumbersInline = document.querySelector("#stats-song-types-values");
    this.btnSongCategoriesToggle = document.querySelector("#stats-song-categories-toggle");
    this.songCategoriesNumbersInline = document.querySelector("#stats-song-categories-values");
    this.btnBroadcastTypesToggle = document.querySelector("#stats-broadcast-types-toggle");
    this.broadcastTypesNumbersInline = document.querySelector("#stats-broadcast-types-values");
    this.btnAnimeTypesToggle = document.querySelector("#stats-anime-types-toggle");
    this.animeTypesNumbersInline = document.querySelector("#stats-anime-types-values");

    this.wireEvents();
  }

  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  wireEvents() {
    // Song Types per-card toggle
    this.btnSongTypesToggle.addEventListener("click", () => this.toggleSongTypesCard());

    // Other per-card toggles
    this.btnSongCategoriesToggle.addEventListener("click", () => this.toggleSongCategoriesCard());
    this.btnBroadcastTypesToggle.addEventListener("click", () => this.toggleBroadcastTypesCard());
    this.btnAnimeTypesToggle.addEventListener("click", () => this.toggleAnimeTypesCard());

    // Auto-load when modal shown
    this.statsModal.addEventListener("shown.ui.modal", () => this.loadStats());
  }

  createChart(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 15 } }
      }
    };

    this.charts[canvasId] = new Chart(ctx, { type: "doughnut", data, options: { ...defaultOptions, ...options } });
    return this.charts[canvasId];
  }

  categoryOrder(values, preferred) {
    return [
      ...preferred.filter(label => (values[label] || 0) > 0),
      ...Object.keys(values).filter(label => !preferred.includes(label) && values[label] > 0).sort()
    ];
  }

  createCategoryChart(canvasId, values, preferred, colors) {
    const labels = this.categoryOrder(values, preferred);
    const chartData = {
      labels,
      datasets: [{
        data: labels.map(label => values[label]),
        backgroundColor: labels.map((_, index) => colors[index % colors.length]),
        borderWidth: 2,
        borderColor: "#fff"
      }]
    };
    return this.createChart(canvasId, chartData, {
      plugins: { tooltip: { callbacks: { label: ctx => {
        const total = ctx.dataset.data.reduce((sum, count) => sum + count, 0);
        const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0";
        return `${ctx.label}: ${this.formatNumber(ctx.parsed)} (${pct}%)`;
      } } } }
    });
  }

  createSongTypesChart(data) {
    return this.createCategoryChart("stats-song-types-chart", data.songs_by_type,
      ["Opening", "Ending", "Insert"], ["#FF6384", "#36A2EB", "#FFCE56", "#9966FF"]);
  }

  createAnimeTypesChart(data) {
    return this.createCategoryChart("stats-anime-types-chart", data.songs_by_anime_type,
      ["TV", "Movie", "OVA", "ONA", "Special"], ["#8BC34A", "#E91E63", "#9C27B0", "#00BCD4", "#FFC107"]);
  }

  createSongCategoriesChart(data) {
    return this.createCategoryChart("stats-song-categories-chart", data.songs_by_category,
      ["Standard", "Character", "Chanting", "Instrumental"], ["#4BC0C0", "#FF9F40", "#9966FF", "#FF6384"]);
  }

  createBroadcastTypesChart(data) {
    return this.createCategoryChart("stats-broadcast-types-chart", data.songs_by_broadcast,
      ["Normal", "Dub", "Rebroadcast"], ["#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"]);
  }

  // Song Links chart removed

  createVintageChart(data) {
    const yearCounts = {};
    Object.entries(data.vintage_distribution).forEach(([vintage, count]) => {
      if (vintage === "Unknown") return;
      const yearMatch = vintage.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) { const year = yearMatch[0]; yearCounts[year] = (yearCounts[year] || 0) + count; }
    });
    const sortedYears = Object.keys(yearCounts).sort((a, b) => parseInt(a) - parseInt(b));
    const values = sortedYears.map(y => yearCounts[y]);
    const chartData = { labels: sortedYears, datasets: [{ data: values, backgroundColor: "#36A2EB", borderColor: "#2196F3", borderWidth: 1 }] };

    const ctx = document.getElementById("stats-vintage-chart");
    if (!ctx) return null;
    if (this.charts["stats-vintage-chart"]) this.charts["stats-vintage-chart"].destroy();
    this.charts["stats-vintage-chart"] = new Chart(ctx, {
      type: "bar", data: chartData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.parsed.y / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${this.formatNumber(ctx.parsed.y)} songs (${pct}%)`; } } } },
        scales: { x: { title: { display: true, text: "Year" } }, y: { beginAtZero: true, title: { display: true, text: "Number of Songs" }, ticks: { callback: (v) => new Intl.NumberFormat().format(v) } } }
      }
    });
    return this.charts["stats-vintage-chart"];
  }

  createDifficultyChart(data) {
    const labels = [
      "1-10", "11-20", "21-30", "31-40", "41-50",
      "51-60", "61-70", "71-80", "81-90", "91-100"
    ];
    const values = Array.isArray(data.difficulty_histogram) && data.difficulty_histogram.length === 10
      ? data.difficulty_histogram
      : Array(10).fill(0);

    const chartData = {
      labels,
      datasets: [{
        label: "Songs",
        data: values,
        backgroundColor: "#36A2EB",
        borderColor: "#2196F3",
        borderWidth: 1
      }]
    };

    const ctx = document.getElementById("stats-difficulty-chart");
    if (!ctx) return null;
    if (this.charts["stats-difficulty-chart"]) this.charts["stats-difficulty-chart"].destroy();
    this.charts["stats-difficulty-chart"] = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const count = ctx.parsed.y;
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                return `${this.formatNumber(count)} songs (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Difficulty Range" } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Number of Songs" },
            ticks: { callback: (v) => new Intl.NumberFormat().format(v) }
          }
        }
      }
    });
    return this.charts["stats-difficulty-chart"];
  }

  populateNumbers(container, values, order, badgeClass) {
    const items = order.map(label => {
      const item = document.createElement("div");
      item.className = "list-group-item d-flex justify-content-between align-items-center";
      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("span");
      count.className = `badge ${badgeClass} rounded-pill`;
      count.textContent = this.formatNumber(values[label] || 0);
      item.append(name, count);
      return item;
    });
    container.replaceChildren(...items);
  }

  toggleNumbers(canvasId, container, button, values, order, badgeClass) {
    if (!this.latestStats) return;
    const canvas = document.getElementById(canvasId);
    const showNumbers = container.classList.contains("d-none");
    if (showNumbers) this.populateNumbers(container, values, order, badgeClass);
    canvas.classList.toggle("d-none", showNumbers);
    container.classList.toggle("d-none", !showNumbers);
    button.querySelector("svg use")?.setAttribute("href", `#${showNumbers ? "bar_chart" : "format_list_numbered"}`);
  }

  toggleSongTypesCard() {
    this.toggleNumbers("stats-song-types-chart", this.songTypesNumbersInline, this.btnSongTypesToggle,
      this.latestStats?.songs_by_type, this.categoryOrder(this.latestStats?.songs_by_type || {}, ["Opening", "Ending", "Insert"]), "bg-primary");
  }

  toggleSongCategoriesCard() {
    this.toggleNumbers("stats-song-categories-chart", this.songCategoriesNumbersInline, this.btnSongCategoriesToggle,
      this.latestStats?.songs_by_category, this.categoryOrder(this.latestStats?.songs_by_category || {}, ["Standard", "Character", "Chanting", "Instrumental"]), "bg-success");
  }

  toggleBroadcastTypesCard() {
    this.toggleNumbers("stats-broadcast-types-chart", this.broadcastTypesNumbersInline, this.btnBroadcastTypesToggle,
      this.latestStats?.songs_by_broadcast, this.categoryOrder(this.latestStats?.songs_by_broadcast || {}, ["Normal", "Dub", "Rebroadcast"]), "bg-warning");
  }

  toggleAnimeTypesCard() {
    this.toggleNumbers("stats-anime-types-chart", this.animeTypesNumbersInline, this.btnAnimeTypesToggle,
      this.latestStats?.songs_by_anime_type, this.categoryOrder(this.latestStats?.songs_by_anime_type || {}, ["TV", "Movie", "OVA", "ONA", "Special"]), "bg-info");
  }

  updateStatsDisplay(data) {
    this.latestStats = data;
    this.totalSongs.textContent = this.formatNumber(data.total_songs);
    this.totalAnime.textContent = this.formatNumber(data.total_anime);
    this.totalArtists.textContent = this.formatNumber(data.total_artists);
    this.totalSeasons.textContent = this.formatNumber(data.total_seasons);

    this.avgDifficulty.textContent =
      Number.isFinite(data.average_difficulty) && data.average_difficulty > 0
        ? data.average_difficulty.toFixed(2)
        : "-";

    const secs = data.average_length_seconds;
    if (Number.isFinite(secs) && secs > 0) {
      const mins = Math.floor(secs / 60);
      const rem = Math.round(secs % 60).toString().padStart(2, "0");
      this.avgSongLength.textContent = `${mins}:${rem}`;
    } else {
      this.avgSongLength.textContent = "-";
    }

    this.createSongTypesChart(data);
    this.createSongCategoriesChart(data);
    this.createBroadcastTypesChart(data);
    this.createAnimeTypesChart(data);
    this.createVintageChart(data);
    this.createDifficultyChart(data);
    // Populate Top lists inline
    this.populateTopList(this.topArtistsNumbers, data.top_artists, "artist", "bg-primary");
    this.populateTopList(this.topAnimeNumbers, data.top_anime, "anime", "bg-success");
  }

  populateTopList(container, entries, key, badgeClass) {
    container.replaceChildren(...entries.map(entry => {
      const item = document.createElement("div");
      item.className = "list-group-item d-flex justify-content-between align-items-center";
      const name = document.createElement("span");
      name.className = "text-truncate me-2";
      name.textContent = entry[key];
      const count = document.createElement("span");
      count.className = `badge ${badgeClass} rounded-pill`;
      count.textContent = this.formatNumber(entry.count);
      item.append(name, count);
      return item;
    }));
  }

  loadStats() {
    try {
      const data = statsManager.calculateStats();
      this.showContent();
      this.updateStatsDisplay(data);
    } catch (error) {
      console.error("Statistics calculation failed:", error);
    }
  }

  showContent() {
    this.statsContent.classList.remove("d-none");
  }
}

const statsModal = new StatsModal();
