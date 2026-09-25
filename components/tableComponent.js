class TableComponent {
  constructor(model) {
    this.model = model;
    this.table = document.querySelector("#results-table");
    this.thead = document.querySelector("#results-table thead");
    this.theadRow = document.querySelector("#results-table thead tr");
    this.tbody = document.querySelector("#results-table tbody");
    this.cardContainer = document.querySelector("#results-cards");
    this.resultsCount = document.querySelector("#results-count");
    this.rows = new Map(); // key -> RowComponent instance
    this.activePlaylistSongIds = null;
    this.renderedColumnOrder = null;
    this.renderedLanguage = null;
    this.headerColumnOrder = null;
    this.columnResizeObserver = new ResizeObserver(() => this.sizeColumns());
    this.columnResizeObserver.observe(this.table.parentElement);

    // Wire sortable for manual row reordering
    new Sortable(this.tbody, {
      handle: ".js-row-grab",
      animation: 180,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      ghostClass: "table-row-ghost",
      onEnd: () => {
        const domKeys = this.getDomOrderKeys();
        eventBus.emit("table:reordered", { order: domKeys });
      }
    });
    const onHeaderSort = event => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      const header = event.target.closest("th");
      if (!header || !this.thead.contains(header) || !TableColumns[header.dataset.col]?.sort) return;
      if (event.type === "keydown") event.preventDefault();
      eventBus.emit("table:sort", { column: header.dataset.col });
    };
    this.thead.addEventListener("click", onHeaderSort);
    this.thead.addEventListener("keydown", onHeaderSort);
    eventBus.on("audio:state-changed", () => this.markPlaying());
    eventBus.on("playlist:auto-add-state-changed", annSongIds => {
      this.activePlaylistSongIds = annSongIds === null ? null : new Set(annSongIds);
      this.updatePlaylistIndicators();
    });
    eventBus.on("table:link-check-reset", () => {
      this.rows.forEach(row => row.clearLinkStatuses());
    });
    eventBus.on("table:link-check-result", ({ key, label, ok }) => {
      this.rows.get(key)?.updateLinkLabelStatus(label, ok);
    });
    eventBus.on("table:duplicate-ids-checked", ({ keys }) => {
      const duplicates = new Set(keys);
      this.rows.forEach((row, key) => row.setAnnSongIdDuplicate(duplicates.has(key)));
    });
    eventBus.on("settings:fileHost-changed", () => {
      this.rows.forEach(row => row.updateLinkHrefs());
    });
  }

  // Reconcile disposable row views against the model's visible keys.
  syncRows() {
    const visible = new Set(this.model.visibleKeys);
    let changed = false;
    for (const [key, row] of this.rows) {
      if (visible.has(key)) continue;
      row.destroy();
      this.rows.delete(key);
      changed = true;
    }
    for (const key of visible) {
      if (!this.rows.has(key)) {
        this.rows.set(key, new RowComponent(this.model.getRow(key), 0, key));
        changed = true;
      }
    }
    if (changed) this.rows.forEach(row => row.setAnnSongIdDuplicate(false));
  }

  // Render both table and card views with current data
  render() {
    this.syncRows();
    const columnOrder = settingsManager.get("columnOrder").join("|");
    const language = settingsManager.get("language");
    if (columnOrder !== this.renderedColumnOrder || language !== this.renderedLanguage) {
      this.rows.forEach(row => row.destroy());
      this.renderedColumnOrder = columnOrder;
      this.renderedLanguage = language;
    }
    const orderedRows = this.getSortedRows();
    orderedRows.forEach((row, index) => row.setIndex(index));
    this.renderTable(orderedRows);
    this.renderCards(orderedRows);
    this.updateResultsCount();
    this.markPlaying();
    this.updatePlaylistIndicators();
    eventBus.emit("table:rendered", orderedRows.map(row => row.key));
  }

  // Render the table view with sorted rows and column settings
  renderTable(orderedRows) {
    const fragment = document.createDocumentFragment();
    orderedRows.forEach(row => {
      fragment.append(row.renderAsTable());
    });
    this.tbody.replaceChildren(fragment);

    this.applyColumnOrder();
    this.applyColumnVisibility();

    // Apply zebra stripe setting
    this.applyZebraStripe();
  }

  // Render the mobile card view with sorted rows
  renderCards(orderedRows) {
    const fragment = document.createDocumentFragment();
    orderedRows.forEach(row => {
      fragment.append(row.renderAsCard());
    });
    this.cardContainer.replaceChildren(fragment);
  }

  // Derive the one displayed order used by the table and cards.
  getSortedRows() {
    return this.model.getDisplayKeys().map(key => this.rows.get(key)).filter(Boolean);
  }

  // Set column visibility settings and apply to the table
  setColumnVisibility(columns) {
    settingsManager.set("visibleColumns", columns);
  }

  // Set column order settings and apply to the table
  setColumnOrder(order) {
    settingsManager.set("columnOrder", order);
  }

  // Build the header from the shared column definitions.
  applyColumnOrder() {
    const order = settingsManager.get("columnOrder");
    const signature = order.join("|");
    if (signature === this.headerColumnOrder) return;
    this.theadRow.replaceChildren();
    order.forEach(key => {
      const column = TableColumns[key];
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

  // Apply current column visibility settings to the table DOM
  applyColumnVisibility() {
    // Use the current column order from settings manager
    const columnOrder = settingsManager.get("columnOrder");

    // Apply visibility to header
    this.thead.querySelectorAll("th").forEach((th, index) => {
      const colClass = columnOrder[index];
      const isVisible = settingsManager.get("visibleColumns")[colClass];
      th.style.display = isVisible ? "" : "none";
    });

    // Add sort indicators after visibility is set
    this.updateHeaderSortIndicators();

    // Show header after everything is ready
    this.thead.style.display = "";

    // Apply visibility to body rows
    this.tbody.querySelectorAll("tr").forEach(tr => {
      tr.querySelectorAll("td").forEach((td) => {
        const colClass = td.getAttribute("data-col");
        if (colClass) {
          const isVisible = settingsManager.get("visibleColumns")[colClass];
          td.style.display = isVisible ? "" : "none";
        }
      });
    });
    this.sizeColumns();
  }

  // Reserve room for controls and compact values, then give remaining width to text.
  // Shrink flexible compact columns before the fixed controls when many are enabled.
  sizeColumns() {
    if (window.innerWidth < 768) return;
    const available = this.table.parentElement.clientWidth;
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

  // Mark rows that are currently playing
  markPlaying() {
    // Update all rows
    this.rows.forEach((row) => {
      row.updatePlayButtonState();
    });
  }

  // Keep table and card markers in sync with the active auto-add playlist.
  updatePlaylistIndicators() {
    this.rows.forEach(row => {
      const marked = this.activePlaylistSongIds?.has(row.data?.annSongId) ?? false;
      row.tableElement?.querySelector(".js-playlist-add")?.classList.toggle("is-marked", marked);
      row.cardElement?.querySelector(".js-playlist-add")?.classList.toggle("is-marked", marked);
    });
  }

  // Update sort indicators in the table header based on current sort state
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

  // Update the results count display with current row count
  updateResultsCount() {
    this.resultsCount.textContent = String(this.rows.size);
    document.querySelector(".results-section")?.classList.toggle("has-results", this.rows.size > 0);
  }

  // Get the current order of keys from DOM table rows
  getDomOrderKeys() {
    return [...this.tbody.querySelectorAll("tr")].map(tr => tr.dataset.key);
  }

  // Apply zebra stripe setting to the table
  applyZebraStripe() {
    if (settingsManager.get("zebraStripe")) {
      this.table.classList.add("table-striped");
    } else {
      this.table.classList.remove("table-striped");
    }
  }
}
