class SongRowView {
  constructor(data, index, key, { playback, playlists, results, search, searchRequests, settings, showSongDetails }) {
    Object.assign(this, { playback, playlists, results, search, searchRequests, settings, showSongDetails });
    this.data = data;
    this.index = index;
    this.key = key;
    this.tableElement = null;
    this.cardElement = null;
    this.linkStatuses = new Map();
    this.isDuplicateAnnSongId = false;
  }

  renderAsTable() {
    if (!this.tableElement) {
      this.tableElement = this.createTableRow();
    }
    return this.tableElement;
  }

  renderAsCard() {
    if (!this.cardElement) {
      this.cardElement = this.createMobileCard();
    }
    return this.cardElement;
  }

  createTableRow() {
    const tr = document.createElement("tr");
    tr.dataset.key = this.key;
    tr.dataset.hq = this.data.HQ || "";
    tr.dataset.mq = this.data.MQ || "";
    tr.dataset.mp3 = this.data.audio || "";
    this.appendTableCells(tr);
    this.setupTableEventListeners(tr);
    return tr;
  }

  createMobileCard() {
    const anime = this.sanitize(this.getAnimeTitle());
    const type = this.shortTypeDisplay(this.data.songType);
    const artist = this.sanitize(this.data.songArtist);
    const song = this.sanitize(this.data.songName);
    const vintage = this.sanitize(this.data.animeVintage || "");

    const hasAnySource = this.hasPlayableSources();

    const card = document.createElement("div");
    card.className = "result-card";
    card.dataset.key = this.key;
    card.innerHTML = `
        <div class="result-card-badges">
          <span class="result-card-row-number" data-role="row-number">#${this.index + 1}</span>
          ${this.typeBadgesHTML(type)}
          ${vintage ? `<span class="result-card-season">${escapeHtml(vintage)}</span>` : ""}
        </div>
        <div class="result-card-content">
          <div class="result-card-title">${escapeHtml(song)}</div>
          ${artist ? `<div class="result-card-subtitle">${escapeHtml(artist)}</div>` : ""}
          ${anime ? `<div class="result-card-anime">${escapeHtml(anime)}</div>` : ""}
        </div>
        <div class="result-card-actions">
          <button class="btn btn-sm btn-outline-secondary js-song-info" title="Song information" aria-label="Song information"><svg class="icon" aria-hidden="true"><use href="#info"></use></svg></button>
          <button class="btn btn-sm btn-outline-primary js-track-play" title="Play" aria-label="Play song" ${hasAnySource ? "" : "disabled"}><svg class="icon" aria-hidden="true"><use href="#play_arrow"></use></svg></button>
          <button class="btn btn-sm btn-outline-warning js-playlist-add" title="Add to playlist" aria-label="Add to playlist"><svg class="icon" aria-hidden="true"><use href="#add"></use></svg></button>
          <button class="btn btn-sm btn-outline-danger js-row-delete" title="Remove" aria-label="Remove song"><svg class="icon" aria-hidden="true"><use href="#delete"></use></svg></button>
        </div>
      `;
    this.setupCardEventListeners(card);
    return card;
  }

  appendTableCells(tr) {
    const cells = this.buildAllCells();
    const columnOrder = this.settings.get("columnOrder");

    columnOrder.forEach(colName => {
      if (cells[colName]) {
        cells[colName].dataset.col = colName;
        tr.append(cells[colName]);
      }
    });
  }

  buildAllCells() {
    const anime = this.sanitize(this.getAnimeTitle());
    const animeType = this.sanitize(this.data.animeType || "");
    const type = this.shortTypeDisplay(this.data.songType);
    const song = this.sanitize(this.data.songName);
    const artist = this.sanitize(this.data.songArtist);
    const vintage = this.sanitize(this.data.animeVintage);
    const difficulty = this.formatDifficulty(this.data.songDifficulty);
    const category = this.sanitize(this.data.songCategory || "");
    const broadcast = broadcastText(this.data);
    const length = formatDurationSeconds(this.data.songLength);
    const composer = this.sanitize(this.data.songComposer || "");
    const arranger = this.sanitize(this.data.songArranger || "");
    const annSongId = this.data.annSongId ?? "";
    const amqSongId = this.data.amqSongId ?? "";
    const ids = this.data.linked_ids || {};
    const anilistId = ids.anilist ?? "";
    const malId = ids.myanimelist ?? "";
    const kitsuId = ids.kitsu ?? "";
    const anidbId = ids.anidb ?? "";

    const cells = {
      info: this.cell("", "nw"),
      rowNumber: this.cell(this.index + 1, "nw"),
      annId: this.cell(this.data.annId ?? "", "nw"),
      anime: this.cell(anime, "trunc", anime),
      animeType: this.cell(animeType, "nw"),
      songType: this.cell("", "nw", this.tdTypeTitleText(this.data)),
      songName: this.cell(song, "trunc", song),
      artist: this.cell(artist, "trunc", artist),
      season: this.cell(vintage, "nw"),
      difficulty: this.cell(difficulty, "nw"),
      performance: this.cell(category, "nw"),
      broadcast: this.cell(broadcast, "nw"),
      length: this.cell(length, "nw"),
      composer: this.cell(composer, "trunc", composer),
      arranger: this.cell(arranger, "trunc", arranger),
      annSongId: this.cell(annSongId, "nw"),
      amqSongId: this.cell(amqSongId, "nw"),
      anilistId: this.cell(anilistId, "nw"),
      malId: this.cell(malId, "nw"),
      kitsuId: this.cell(kitsuId, "nw"),
      anidbId: this.cell(anidbId, "nw"),
      songLinks: this.cell("", "nw"),
      action: this.cell("", "nw")
    };
    cells.info.innerHTML = `<button class="btn btn-sm btn-outline-secondary js-song-info" title="Song information" aria-label="Song information"><svg class="icon" aria-hidden="true"><use href="#info"></use></svg></button>`;
    cells.annId.innerHTML = this.tableSearchHTML(this.data.annId, "ANN");
    cells.artist.innerHTML = this.tableSearchHTML(artist, "Artist");
    cells.composer.innerHTML = this.tableSearchHTML(composer, "Composer");
    cells.arranger.innerHTML = this.tableSearchHTML(arranger, "Composer");
    cells.songType.innerHTML = this.typeBadgesHTML(type);
    const copyValues = {
      annId: this.data.annId, anime, animeType, songType: this.tdTypeTitleText(this.data), songName: song, artist,
      season: vintage, difficulty, performance: category, broadcast, length, composer, arranger, annSongId, amqSongId,
      anilistId, malId, kitsuId, anidbId
    };
    for (const [key, value] of Object.entries(copyValues)) {
      const copy = this.sanitize(value).trim();
      if (!copy) continue;
      const target = ["annId", "artist", "composer", "arranger"].includes(key)
        ? cells[key].querySelector(".table-copy-text") : cells[key];
      if (!target) continue;
      target.dataset.copy = copy;
      target.tabIndex = 0;
      target.setAttribute("role", "button");
      target.setAttribute("aria-label", `Copy ${ResultColumns[key].label}: ${copy}`);
    }
    cells.annSongId.classList.toggle("text-danger", this.isDuplicateAnnSongId);
    cells.annSongId.classList.toggle("fw-bold", this.isDuplicateAnnSongId);

    const fileHost = this.settings.get("fileHost");
    const hqUrl = buildSongMediaUrl(this.data.HQ, fileHost) || "";
    const mqUrl = buildSongMediaUrl(this.data.MQ, fileHost) || "";
    const mp3Url = buildSongMediaUrl(this.data.audio, fileHost) || "";
    cells.songLinks.append(
      this.renderLinkLabel("720", hqUrl),
      this.renderLinkLabel("480", mqUrl),
      this.renderLinkLabel("MP3", mp3Url)
    );

    const hasAnySource = Boolean(hqUrl || mqUrl || mp3Url);

    cells.action.innerHTML = `
      <button class="btn btn-sm btn-outline-primary js-track-play" title="Play" aria-label="Play song" ${hasAnySource ? "" : "disabled"}><svg class="icon" aria-hidden="true"><use href="#play_arrow"></use></svg></button>
      <button class="btn btn-sm btn-outline-warning js-playlist-add" title="Add to playlist" aria-label="Add to playlist"><svg class="icon" aria-hidden="true"><use href="#add"></use></svg></button>
      <span class="js-row-grab drag-handle" title="Drag to reorder" aria-label="Drag to reorder"><svg class="icon" aria-hidden="true"><use href="#drag_indicator"></use></svg></span>
      <button class="btn btn-sm btn-outline-danger js-row-delete" title="Remove" aria-label="Remove song"><svg class="icon" aria-hidden="true"><use href="#delete"></use></svg></button>
    `;
    return cells;
  }

  tableSearchHTML(value, scope) {
    const query = this.sanitize(value).trim();
    if (!query) return "";
    const attr = text => escapeHtml(text).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    return `<button type="button" class="table-search-icon js-table-search" data-scope="${attr(scope)}" data-query="${attr(query)}" aria-label="Search ${attr(scope)} for ${attr(query)}" title="Search ${attr(scope)}"><svg class="icon" aria-hidden="true"><use href="#search"></use></svg></button><span class="table-copy-text">${escapeHtml(query)}</span>`;
  }

  cell(value, className, title) {
    const cell = document.createElement("td");
    cell.className = className;
    cell.textContent = String(value ?? "");
    if (title !== undefined) cell.title = title;
    return cell;
  }

  formatDifficulty(dif) {
    return optionalSongNumber(dif) ?? "";
  }

  typeBadgesHTML(type) {
    return songTypeBadgesHTML(type, this.data);
  }

  tdTypeTitleText(d) {
    if (d.isDub && d.isRebroadcast) return `${d.songType} (Dub/Rebroadcast)`;
    if (d.isDub) return `${d.songType} (Dub)`;
    if (d.isRebroadcast) return `${d.songType} (Rebroadcast)`;
    return d.songType;
  }

  renderLinkLabel(label, url) {
    if (url) {
      const link = document.createElement("a");
      link.className = "table-song-link";
      link.dataset.label = label;
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      if (this.linkStatuses.has(label)) {
        link.classList.toggle("text-success", this.linkStatuses.get(label));
        link.classList.toggle("text-danger", !this.linkStatuses.get(label));
      }
      return link;
    }
    const span = document.createElement("span");
    span.className = "table-song-link disabled";
    span.dataset.label = label;
    span.setAttribute("aria-disabled", "true");
    span.textContent = label;
    return span;
  }

  updateLinkHrefs() {
    this.tableElement?.querySelectorAll('td[data-col="songLinks"] a.table-song-link').forEach(link => {
      const current = link.getAttribute("href");
      const rewritten = rewriteSongMediaHost(current, this.settings.get("fileHost"));
      if (rewritten !== current) {
        link.setAttribute("href", rewritten);
      }
    });
    this.clearLinkStatuses();
  }

  clearLinkStatuses() {
    this.linkStatuses.clear();
    this.tableElement?.querySelectorAll(".table-song-link").forEach(label => label.classList.remove("text-success", "text-danger"));
  }

  updateLinkLabelStatus(label, isOk) {
    this.linkStatuses.set(label, Boolean(isOk));
    const link = this.tableElement?.querySelector(`td[data-col="songLinks"] .table-song-link[data-label="${label}"]`);
    if (!link) return;
    link.classList.toggle("text-success", Boolean(isOk));
    link.classList.toggle("text-danger", !Boolean(isOk));
  }

  setAnnSongIdDuplicate(isDuplicate) {
    this.isDuplicateAnnSongId = Boolean(isDuplicate);
    const cell = this.tableElement?.querySelector('td[data-col="annSongId"]');
    if (!cell) return;
    cell.classList.toggle("text-danger", Boolean(isDuplicate));
    cell.classList.toggle("fw-bold", Boolean(isDuplicate));
  }

  setupTableEventListeners(element) {
    element.addEventListener("click", event => this.handleAction(event));
  }

  setupCardEventListeners(element) {
    element.addEventListener("click", event => this.handleAction(event));
  }

  handleAction(event) {
    const target = event.target;
    if (target.closest(".js-track-play")) {
      this.playback.toggleSong(this.key);
    } else if (target.closest(".js-playlist-add")) {
      this.playlists.addFromResults(this.key);
    } else if (target.closest(".js-row-delete")) {
      this.results.removeRow(this.key);
    } else if (target.closest(".js-table-search")) {
      const searchTarget = target.closest(".js-table-search");
      this.search.submitSearch(this.searchRequests.relatedSearchPayload(searchTarget.dataset.scope, searchTarget.dataset.query));
    } else if (target.closest(".js-song-info")) {
      this.showSongDetails(this.key);
    }
  }

  updatePlayButtonState() {
    const currentRowKey = this.playback.getCurrentKey();
    const isCurrent = currentRowKey === this.key;
    const isPlaying = this.playback.isPlaying();

    [this.tableElement, this.cardElement].forEach(element => {
      const button = element?.querySelector(".js-track-play");
      button?.classList.toggle("is-playing", isCurrent && isPlaying);
      button?.classList.toggle("is-paused", isCurrent && !isPlaying && currentRowKey != null);
      button?.querySelector("use")?.setAttribute("href", `#${isCurrent && isPlaying ? "pause" : "play_arrow"}`);
      if (button) {
        button.setAttribute("aria-label", isCurrent && isPlaying ? "Pause song" : "Play song");
        button.title = isCurrent && isPlaying ? "Pause" : "Play";
      }
    });
  }

  setIndex(index) {
    if (this.index === index) return;
    this.index = index;
    const tableNumber = this.tableElement?.querySelector('td[data-col="rowNumber"]');
    if (tableNumber) tableNumber.textContent = String(index + 1);
    const cardNumber = this.cardElement?.querySelector('[data-role="row-number"]');
    if (cardNumber) cardNumber.textContent = `#${index + 1}`;
  }

  setVisible(isVisible) {
    this.tableElement?.classList.toggle("d-none", !isVisible);
    this.cardElement?.classList.toggle("d-none", !isVisible);
  }

  hasPlayableSources() {
    return [this.data.HQ, this.data.MQ, this.data.audio]
      .some(path => buildSongMediaUrl(path, this.settings.get("fileHost")));
  }

  getAnimeTitle() {
    return songAnimeTitle(this.data, this.settings.get("language"));
  }

  sanitize(text) {
    return String(text ?? "").replace(/[\r\n]+/g, " ");
  }

  shortTypeDisplay(t) {
    return shortSongType(t);
  }

  destroy() {
    this.tableElement?.remove();
    this.cardElement?.remove();
    this.tableElement = null;
    this.cardElement = null;
  }
}
