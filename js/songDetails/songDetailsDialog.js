class SongDetailsDialog {
  constructor({ events, playback, playlists, results, search, searchRequests, settings, ui }) {
    Object.assign(this, { events, playback, playlists, results, search, searchRequests, settings, ui });
    this.modal = document.querySelector("#song-info-modal");
    this.title = this.modal.querySelector(".modal-title");
    this.viewButton = document.querySelector("#song-info-view-button");
    this.viewMode = "formatted";
    this.formatted = document.querySelector("#song-info-formatted");
    this.json = document.querySelector("#song-info-json");
    this.playButton = document.querySelector("#song-info-play-button");
    this.addToPlaylistButton = document.querySelector("#song-info-add-to-playlist-button");
    this.prevButton = document.querySelector("#song-info-previous-button");
    this.nextButton = document.querySelector("#song-info-next-button");
    this.currentKey = null;
    this.wireEvents();
  }

  wireEvents() {
    this.events.on("audio:state-changed", () => this.updateModalPlayButton());
    this.events.on("results:changed", keys => {
      if (!this.currentKey) return;
      if (keys.includes(this.currentKey)) {
        this.title.innerHTML = `Song Info <span class="song-info-position">${keys.indexOf(this.currentKey) + 1} / ${keys.length}</span>`;
        return;
      }
      this.currentKey = null;
      this.ui.hideModal(this.modal);
    });
    this.events.on("settings:fileHost-changed", () => this.refreshMediaLinks());
    this.events.on("settings:language-changed", () => this.refreshAnimeTitle());
    this.viewButton.addEventListener("click", () => {
      this.viewMode = this.viewMode === "formatted" ? "json" : "formatted";
      this.updateViewMode();
    });
    this.prevButton.addEventListener("click", () => this.navigate("prev"));
    this.nextButton.addEventListener("click", () => this.navigate("next"));
    this.playButton.addEventListener("click", () => {
      if (!this.playButton.disabled && this.currentKey) this.playback.toggleSong(this.currentKey);
    });
    this.addToPlaylistButton.addEventListener("click", () => {
      if (this.currentKey) this.playlists.addFromResults(this.currentKey);
    });
    this.modal.addEventListener("click", event => {
      const link = event.target.closest(".song-info-search-link");
      if (!link || !this.modal.contains(link)) return;
      event.preventDefault();
      if (!link.dataset.search) return;
      this.ui.hideModal(this.modal);
      this.search.submitSearch(this.searchRequests.relatedSearchPayload(link.dataset.scope, link.dataset.search));
    });
    this.modal.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key) || !event.target.matches(".song-info-search-link")) return;
      event.preventDefault();
      event.target.click();
    });
  }

  updateModalPlayButton() {
    const current = this.currentKey === this.playback.getCurrentKey();
    const playing = this.playback.isPlaying();
    this.playButton.classList.toggle("is-playing", current && playing);
    this.playButton.classList.toggle("is-paused", current && !playing);
    const action = current && playing ? "Pause" : "Play";
    this.playButton.querySelector("use").setAttribute("href", `#${action === "Pause" ? "pause" : "play_arrow"}`);
    this.playButton.querySelector(".song-info-button-label").textContent = action;
    this.playButton.setAttribute("aria-label", `${action} song`);
    this.playButton.title = `${action} song`;
  }

  show(key) {
    if (this.showForKey(key)) this.ui.showModal(this.modal);
  }

  showForKey(key) {
    if (!key) return false;
    const data = this.results.model.getRow(key);
    if (!data) return false;

    this.currentKey = key;
    const displayedKeys = this.results.model.getDisplayKeys();
    const index = displayedKeys.indexOf(key);
    this.title.innerHTML = `Song Info${index >= 0 ? ` <span class="song-info-position">${index + 1} / ${displayedKeys.length}</span>` : ""}`;
    this.json.textContent = JSON.stringify(data, null, 2);
    this.formatted.innerHTML = this.buildInfoFormattedHTML(data);
    this.playButton.disabled = ![data.audio, data.MQ, data.HQ]
      .some(path => buildSongMediaUrl(path, this.settings.get("fileHost")));
    this.updateModalPlayButton();
    this.updateViewMode();
    return true;
  }

  updateViewMode() {
    const raw = this.viewMode === "json";
    this.formatted.classList.toggle("d-none", raw);
    this.json.classList.toggle("d-none", !raw);
    const current = raw ? "JSON" : "Details";
    const next = raw ? "Details" : "JSON";
    this.viewButton.textContent = current;
    this.viewButton.setAttribute("aria-label", `${current} view. Switch to ${next} view`);
    this.viewButton.title = `Switch to ${next} view`;
  }

  refreshMediaLinks() {
    this.formatted.querySelectorAll(".song-info-media-link").forEach(link => {
      const current = link.getAttribute("href");
      const updated = rewriteSongMediaHost(current, this.settings.get("fileHost"));
      if (updated !== current) link.setAttribute("href", updated);
    });
  }

  refreshAnimeTitle() {
    const data = this.currentKey && this.results.model.getRow(this.currentKey);
    const titleSlot = this.formatted.querySelector(".song-info-hero-anime-title");
    if (!data || !titleSlot) return;

    const title = this.sanitize(this.results.getAnimeTitle(data)).trim();
    const value = document.createElement("span");
    value.textContent = title || "—";
    if (title) {
      value.className = "copyable-value";
      value.setAttribute("role", "button");
      value.tabIndex = 0;
      value.dataset.copy = title;
      value.setAttribute("aria-label", `Copy ${title}`);
    } else {
      value.className = "text-muted";
    }
    titleSlot.replaceChildren(value);
  }

  navigate(direction) {
    if (!this.currentKey) return;
    const order = this.results.model.getDisplayKeys();
    if (!order.length) return;
    const position = order.indexOf(this.currentKey);
    if (position < 0) return;
    const next = (position + (direction === "next" ? 1 : -1) + order.length) % order.length;
    this.showForKey(order[next]);
  }

  sanitize(value) {
    return String(value ?? "").replace(/[\r\n]+/g, " ");
  }

  attr(value) {
    return escapeHtml(String(value ?? "")).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  fileBaseName(pathOrUrl) {
    if (!pathOrUrl) return "";
    try {
      const path = /^https?:\/\//i.test(pathOrUrl) ? new URL(pathOrUrl).pathname : String(pathOrUrl).split(/[?#]/)[0];
      return path.split("/").filter(Boolean).pop() || "";
    } catch {
      return String(pathOrUrl).split("/").pop() || "";
    }
  }

  searchIcon(value, scope) {
    if (value == null || value === "") return "";
    return `<svg class="icon ms-2 song-info-search-link" role="button" tabindex="0" aria-label="Search ${this.attr(scope)} for ${this.attr(value)}" data-search="${this.attr(value)}" data-scope="${this.attr(scope)}"><use href="#search"></use></svg>`;
  }

  copyValueHTML(value) {
    const text = this.sanitize(value).trim();
    return text ? `<span class="copyable-value" role="button" tabindex="0" data-copy="${this.attr(text)}" aria-label="Copy ${this.attr(text)}">${escapeHtml(text)}</span>`
      : '<span class="text-muted">—</span>';
  }

  buildArtistInfo(artist, scope = "Artist") {
    if (!artist) return "";
    const names = Array.isArray(artist.names) ? artist.names.map(name => this.sanitize(name).trim()).filter(Boolean) : [];
    const groups = Array.isArray(artist.groups) ? artist.groups : [];
    const members = Array.isArray(artist.members) ? artist.members : [];
    const isGroup = artist.type !== "person" && (["group", "choir", "orchestra"].includes(artist.type) || (Array.isArray(artist.members) && artist.members.length > 0));
    const kind = isGroup ? "group" : "person";
    const kindLabel = isGroup ? "Group" : "Person";
    const badges = items => items.map(item => {
      const values = Array.isArray(item.names) ? item.names : [];
      return `<span class="song-info-related-badge">${this.copyValueHTML(values.join(", "))}${this.searchIcon(values[0], scope)}</span>`;
    }).join(" ");
    return `<div class="song-info-artist-credit">
      ${names.length ? `<div class="song-info-person-name"><svg class="icon" role="img" aria-label="${kindLabel}"><title>${kindLabel}</title><use href="#${kind}"></use></svg><span class="song-info-person-main">${this.copyValueHTML(names[0])}${this.searchIcon(names[0], scope)}</span></div>` : ""}
      ${names.length > 1 ? `<div class="song-info-related"><span>AKA</span><span class="song-info-aka-names">${names.slice(1).map(name => this.copyValueHTML(name)).join(", ")}</span></div>` : ""}
      ${groups.length ? `<div class="song-info-related"><span>Groups</span>${badges(groups)}</div>` : ""}
      ${members.length ? `<div class="song-info-related"><span>Members</span>${badges(members)}</div>` : ""}
    </div>`;
  }

  idRow(title, id, siteUrl, siteScope) {
    const link = siteUrl ? `<a href="${this.attr(siteUrl)}" target="_blank" rel="noreferrer" aria-label="Open ${this.attr(title)}"><svg class="icon" aria-hidden="true"><use href="#open_in_new"></use></svg></a>` : "";
    return `<div class="song-info-id"><span>${escapeHtml(title)}</span><strong>${this.copyValueHTML(id)}</strong>${siteScope ? this.searchIcon(id, siteScope) : ""}${link}</div>`;
  }

  fileRow(label, url, name) {
    return url ? `<a class="song-info-media-link" href="${this.attr(url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(name)}</span><svg class="icon" aria-hidden="true"><use href="#open_in_new"></use></svg></a>` : "";
  }

  detail(label, value, extra = "") {
    return `<div class="song-info-fact"><dt>${escapeHtml(label)}</dt><dd>${this.copyValueHTML(value)}${extra}</dd></div>`;
  }

  buildInfoFormattedHTML(data) {
    const title = this.sanitize(this.results.getAnimeTitle(data));
    const song = this.sanitize(data.songName) || "Untitled song";
    const artist = this.sanitize(data.songArtist);
    const alternateTitle = Array.isArray(data.animeAltName)
      ? data.animeAltName.map(value => this.sanitize(value)).filter(Boolean).join(", ")
      : this.sanitize(data.animeAltName);
    const type = this.sanitize(data.songType);
    const heroBadges = songTypeBadgesHTML(shortSongType(type), data);
    const ids = data.linked_ids || {};
    const fileHost = this.settings.get("fileHost");
    const hq = buildSongMediaUrl(data.HQ, fileHost) || "";
    const mq = buildSongMediaUrl(data.MQ, fileHost) || "";
    const mp3 = buildSongMediaUrl(data.audio, fileHost) || "";
    const idRows = [
      data.annId && this.idRow("ANN ID", data.annId, `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${encodeURIComponent(data.annId)}`, "ANN"),
      ids.anilist && this.idRow("AniList ID", ids.anilist, `https://anilist.co/anime/${encodeURIComponent(ids.anilist)}`),
      ids.myanimelist && this.idRow("MAL ID", ids.myanimelist, `https://myanimelist.net/anime/${encodeURIComponent(ids.myanimelist)}`),
      ids.kitsu && this.idRow("Kitsu ID", ids.kitsu, `https://kitsu.io/anime/${encodeURIComponent(ids.kitsu)}`),
      ids.anidb && this.idRow("AniDB ID", ids.anidb, `https://anidb.net/anime/${encodeURIComponent(ids.anidb)}`),
      data.annSongId && this.idRow("ANN Song ID", data.annSongId, null, "ANN_SONG"),
      data.amqSongId && this.idRow("AMQ Song ID", data.amqSongId, null, "AMQ_SONG")
    ].filter(Boolean).join("");
    const people = [
      ["Artists", data.artists, "Artist", data.songArtist],
      ["Composers", data.composers, "Composer", data.songComposer],
      ["Arrangers", data.arrangers, "Composer", data.songArranger]
    ].map(([label, entries, scope, fallback]) => {
      const peopleEntries = Array.isArray(entries) && entries.length ? entries
        : fallback ? [{ names: [this.sanitize(fallback)] }] : [];
      return peopleEntries.length
        ? `<div class="song-info-people-group"><h4>${label}</h4>${peopleEntries.map(entry => this.buildArtistInfo(entry, scope)).join("")}</div>`
        : "";
    }).join("");
    const media = [
      this.fileRow("MP3 audio", mp3, this.fileBaseName(data.audio || mp3)),
      this.fileRow("480p video", mq, this.fileBaseName(data.MQ || mq)),
      this.fileRow("720p video", hq, this.fileBaseName(data.HQ || hq))
    ].filter(Boolean).join("");

    return `
      <div class="song-info-hero">
        <h2 class="song-info-hero-line"><svg class="icon" aria-hidden="true"><use href="#music_note"></use></svg>${this.copyValueHTML(song)}</h2>
        ${artist ? `<div class="song-info-hero-line song-info-hero-artist"><svg class="icon" aria-hidden="true"><use href="#artist"></use></svg>${this.copyValueHTML(artist)}</div>` : ""}
        <div class="song-info-hero-line song-info-hero-anime"><svg class="icon" aria-hidden="true"><use href="#tv"></use></svg><span class="song-info-hero-anime-content"><span class="song-info-hero-anime-title">${this.copyValueHTML(title)}</span>${heroBadges ? `<span class="song-info-hero-types">${heroBadges}</span>` : ""}</span></div>
      </div>
      <section class="song-info-section">
        <h3>Song and anime</h3>
        <dl class="song-info-facts">
          ${this.detail("English title", data.animeENName)}
          ${this.detail("Japanese title", data.animeJPName)}
          ${this.detail("Alternate title", alternateTitle)}
          ${this.detail("Anime type", data.animeType)}
          ${this.detail("Season", data.animeVintage, this.searchIcon(data.animeVintage, "Season"))}
          ${this.detail("Song type", type)}
          ${this.detail("Broadcast", broadcastText(data))}
          ${this.detail("Performance", data.songCategory)}
          ${this.detail("Difficulty", data.songDifficulty)}
          ${this.detail("Length", data.songLength == null ? "" : formatDurationSeconds(data.songLength))}
        </dl>
      </section>
      <section class="song-info-section">
        <h3>Credits</h3>
        ${people ? `<div class="song-info-people">${people}</div>` : '<span class="text-muted">No credit details available</span>'}
      </section>
      <div class="song-info-bottom">
        <section class="song-info-section">
          <h3>Available media</h3>
          <div class="song-info-media">${media || '<span class="text-muted">No media links available</span>'}</div>
        </section>
        <section class="song-info-section">
          <h3>External IDs</h3>
          <div class="song-info-ids">${idRows || '<span class="text-muted">No external IDs available</span>'}</div>
        </section>
      </div>
    `;
  }
}
