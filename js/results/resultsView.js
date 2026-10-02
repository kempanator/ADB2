class ResultsView {
  constructor({ createRowView, events, results, settings }) {
    Object.assign(this, { createRowView, events, results, settings });
    this.model = this.results.model;
    this.events.on("results:changed", () => this.render());
    this.events.on("settings:columnOrder-changed", () => this.render());
    this.events.on("settings:visibleColumns-changed", () => this.applyColumnVisibility());
    this.events.on("settings:zebraStripe-changed", () => this.applyZebraStripe());
    this.events.on("settings:resultsViewMode-changed", () => this.applyViewMode());
    this.section = document.querySelector(".results-section");
    this.table = document.querySelector("#results-table");
    this.thead = document.querySelector("#results-table thead");
    this.theadRow = document.querySelector("#results-table thead tr");
    this.tbody = document.querySelector("#results-table tbody");
    this.cardContainer = document.querySelector("#results-cards");
    this.resultsCount = document.querySelector("#results-count");
    this.rows = new Map();
    this.activePlaylistSongIds = null;
    this.renderedColumnOrder = null;
    this.renderedLanguage = null;
    this.headerColumnOrder = null;
    this.columnResizeObserver = new ResizeObserver(() => this.sizeColumns());
    this.columnResizeObserver.observe(this.table.parentElement);

    new Sortable(this.tbody, {
      handle: ".js-row-grab",
      animation: 180,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      ghostClass: "table-row-ghost",
      onEnd: () => {
        const domKeys = this.getDomOrderKeys();
        this.results.reorder(domKeys);
      }
    });
    const onHeaderSort = event => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      const header = event.target.closest("th");
      if (!header || !this.thead.contains(header) || !ResultColumns[header.dataset.col]?.sort) return;
      if (event.type === "keydown") event.preventDefault();
      this.results.sort(header.dataset.col);
    };
    this.thead.addEventListener("click", onHeaderSort);
    this.thead.addEventListener("keydown", onHeaderSort);
    this.events.on("audio:state-changed", () => this.markPlaying());
    this.events.on("playlist:auto-add-state-changed", annSongIds => {
      this.activePlaylistSongIds = annSongIds === null ? null : new Set(annSongIds);
      this.updatePlaylistIndicators();
    });
    this.events.on("results:link-check-reset", () => {
      this.rows.forEach(row => row.clearLinkStatuses());
    });
    this.events.on("results:link-check-result", ({ key, label, ok }) => {
      this.rows.get(key)?.updateLinkLabelStatus(label, ok);
    });
    this.events.on("results:duplicate-ids-checked", ({ keys }) => {
      const duplicates = new Set(keys);
      this.rows.forEach((row, key) => row.setAnnSongIdDuplicate(duplicates.has(key)));
    });
    this.events.on("settings:fileHost-changed", () => {
      this.rows.forEach(row => row.updateLinkHrefs());
    });
    this.applyViewMode();
  }

  applyViewMode() {
    this.section.dataset.viewMode = this.settings.get("resultsViewMode");
    this.sizeColumns();
  }

  syncRows() {
    const visible = new Set(this.model.rowKeys);
    let changed = false;
    for (const [key, row] of this.rows) {
      if (visible.has(key)) continue;
      row.destroy();
      this.rows.delete(key);
      changed = true;
    }
    for (const key of visible) {
      if (!this.rows.has(key)) {
        this.rows.set(key, this.createRowView(this.model.getRow(key), key));
        changed = true;
      }
    }
    if (changed) this.rows.forEach(row => row.setAnnSongIdDuplicate(false));
  }

  render() {
    this.syncRows();
    const columnOrder = this.settings.get("columnOrder").join("|");
    const language = this.settings.get("language");
    if (columnOrder !== this.renderedColumnOrder || language !== this.renderedLanguage) {
      this.rows.forEach(row => row.destroy());
      this.renderedColumnOrder = columnOrder;
      this.renderedLanguage = language;
    }
    const orderedRows = this.getSortedRows();
    orderedRows.forEach((row, index) => row.setIndex(index));
    this.updateResultsCount();
    this.renderTable(orderedRows);
    this.renderCards(orderedRows);
    this.markPlaying();
    this.updatePlaylistIndicators();
  }

  renderTable(orderedRows) {
    const fragment = document.createDocumentFragment();
    orderedRows.forEach(row => {
      fragment.append(row.renderAsTable());
    });
    this.tbody.replaceChildren(fragment);

    this.applyColumnOrder();
    this.applyColumnVisibility();

    this.applyZebraStripe();
  }

  renderCards(orderedRows) {
    const fragment = document.createDocumentFragment();
    orderedRows.forEach(row => {
      fragment.append(row.renderAsCard());
    });
    this.cardContainer.replaceChildren(fragment);
  }

  getSortedRows() {
    return this.model.getDisplayKeys().map(key => this.rows.get(key)).filter(Boolean);
  }

  setColumnVisibility(columns) {
    this.settings.set("visibleColumns", columns);
  }

  setColumnOrder(order) {
    this.settings.set("columnOrder", order);
  }

  applyColumnOrder() {
    const order = this.settings.get("columnOrder");
    const signature = order.join("|");
    if (signature === this.headerColumnOrder) return;
    this.theadRow.replaceChildren();
    order.forEach(key => {
      const column = ResultColumns[key];
      if (!column) return;
      const th = document.createElement("th");
      th.scope = "col";
      th.dataset.col = key;
      th.textContent = column.label;
      if (column.nowrap) th.classList.add("nw");
      if (column.sort) th.tabIndex = 0;
      else th.classList.add("no-sort");
      this.theadRow.append(th);
    });
    this.headerColumnOrder = signature;
  }

  applyColumnVisibility() {
    const columnOrder = this.settings.get("columnOrder");

    this.thead.querySelectorAll("th").forEach((th, index) => {
      const colClass = columnOrder[index];
      const isVisible = this.settings.get("visibleColumns")[colClass];
      th.style.display = isVisible ? "" : "none";
    });

    this.updateHeaderSortIndicators();

    this.thead.style.display = "";

    this.tbody.querySelectorAll("tr").forEach(tr => {
      tr.querySelectorAll("td").forEach((td) => {
        const colClass = td.getAttribute("data-col");
        if (colClass) {
          const isVisible = this.settings.get("visibleColumns")[colClass];
          td.style.display = isVisible ? "" : "none";
        }
      });
    });
    this.sizeColumns();
  }

  // Reserve room for controls and compact values, then give remaining width to text.
  // Shrink flexible compact columns before the fixed controls when many are enabled.
  sizeColumns() {
    const available = Math.max(this.table.parentElement.clientWidth, this.table.clientWidth);
    if (!available) return;

    // [preferred, minimum] pixel widths at the table's 13px text size.
    const compactSizes = {
      info: [48, 48], rowNumber: [44, 40], annId: [96, 84],
      animeType: [104, 80], season: [100, 78], songType: [90, 76], difficulty: [62, 46],
      length: [78, 70], songLinks: [120, 120], action: [140, 140],
      performance: [108, 32], broadcast: [112, 32],
      annSongId: [104, 28], amqSongId: [104, 28], anilistId: [104, 28],
      malId: [104, 28], kitsuId: [104, 28], anidbId: [104, 28]
    };
    const textWeights = { anime: 1.3, songName: 1.3, artist: 1, composer: 1, arranger: 1 };
    const headers = [...this.theadRow.querySelectorAll("th")]
      .filter(th => th.style.display !== "none");
    const compact = headers.filter(th => compactSizes[th.dataset.col]);
    const textHeaders = headers.filter(th => textWeights[th.dataset.col]);
    const textReserve = textHeaders.length * 72;
    const compactBudget = Math.max(0, available - textReserve);
    const widths = new Map(compact.map(th => [th, compactSizes[th.dataset.col][0]]));
    const preferredTotal = [...widths.values()].reduce((sum, width) => sum + width, 0);

    if (preferredTotal > compactBudget) {
      const slack = compact.reduce((sum, th) => {
        const [preferred, minimum] = compactSizes[th.dataset.col];
        return sum + preferred - minimum;
      }, 0);
      const shrink = Math.min(1, (preferredTotal - compactBudget) / slack);
      compact.forEach(th => {
        const [preferred, minimum] = compactSizes[th.dataset.col];
        widths.set(th, preferred - (preferred - minimum) * shrink);
      });
    }

    let compactTotal = [...widths.values()].reduce((sum, width) => sum + width, 0);
    if (compactTotal > compactBudget) {
      const scale = compactBudget / compactTotal;
      compact.forEach(th => widths.set(th, widths.get(th) * scale));
      compactTotal = compactBudget;
    }

    if (textHeaders.length) {
      const textBudget = available - compactTotal;
      const totalWeight = textHeaders.reduce((sum, th) => sum + textWeights[th.dataset.col], 0);
      textHeaders.forEach(th => widths.set(th, textBudget * textWeights[th.dataset.col] / totalWeight));
    } else if (compactTotal) {
      compact.forEach(th => widths.set(th, widths.get(th) * available / compactTotal));
    }

    headers.forEach(th => { th.style.width = `${100 * widths.get(th) / available}%`; });
  }

  markPlaying() {
    this.rows.forEach((row) => {
      row.updatePlayButtonState();
    });
  }

  updatePlaylistIndicators() {
    this.rows.forEach(row => {
      const marked = this.activePlaylistSongIds?.has(row.data?.annSongId) ?? false;
      row.tableElement?.querySelector(".js-playlist-add")?.classList.toggle("is-marked", marked);
      row.cardElement?.querySelector(".js-playlist-add")?.classList.toggle("is-marked", marked);
    });
  }

  updateHeaderSortIndicators() {
    const { column, dir } = this.model.sort;
    this.thead.querySelectorAll("th").forEach(th => {
      const col = th.dataset.col;
      th.querySelector(".table-sort-indicator")?.remove();
      th.removeAttribute("aria-sort");
      if (!col || th.classList.contains("no-sort") || column !== col || !["asc", "desc"].includes(dir)) return;
      th.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "icon table-sort-indicator");
      icon.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", `#arrow_drop_${dir === "asc" ? "up" : "down"}`);
      icon.append(use);
      th.append(icon);
    });
  }

  updateResultsCount() {
    this.resultsCount.textContent = String(this.rows.size);
    this.section.classList.toggle("has-results", this.rows.size > 0);
  }

  getDomOrderKeys() {
    return [...this.tbody.querySelectorAll("tr")].map(tr => tr.dataset.key);
  }

  applyZebraStripe() {
    if (this.settings.get("zebraStripe")) {
      this.table.classList.add("table-striped");
    } else {
      this.table.classList.remove("table-striped");
    }
  }
}
