class PlaylistModal {
  constructor() {
    this.modal = document.querySelector("#playlists-modal");
    this.btnSavePlaylist = document.querySelector("#playlists-save-button");
    this.playlistName = document.querySelector("#playlists-name-input");
    this.playlistSearch = document.querySelector("#playlists-search-input");
    this.playlistList = document.querySelector("#playlists-list");
    this.playlistDetail = document.querySelector("#playlists-detail");
    this.noPlaylistsMessage = document.querySelector("#playlists-empty-message");
    this.noMatchesMessage = document.querySelector("#playlists-no-matches");
    this.selectedPlaylistId = null;
    this.sortedPlaylists = [];
    this.wireEvents();
  }

  show() { ui.showModal(this.modal); }
  hide() { ui.hideModal(this.modal); }

  wireEvents() {
    eventBus.on("playlists:changed", ({ selectedPlaylistId } = {}) => {
      if (selectedPlaylistId) this.selectedPlaylistId = selectedPlaylistId;
      this.renderPlaylistList();
    });
    this.btnSavePlaylist.addEventListener("click", () => {
      const name = this.playlistName.value.trim();
      if (!name) return showAlert("Please enter a playlist name.", "warning");
      const songs = tableManager.model.getDisplayData().filter(row => row.annSongId);
      if (!songs.length) return showAlert("No valid songs to save.", "warning");
      this.playlistSearch.value = "";
      this.selectedPlaylistId = playlistManager.savePlaylist(name, songs);
      this.playlistName.value = "";
      showAlert(`Playlist "${name}" saved with ${songs.length} songs`, "success");
    });
    this.playlistName.addEventListener("keydown", event => {
      if (event.key === "Enter") this.btnSavePlaylist.click();
    });
    this.playlistSearch.addEventListener("input", () => this.filterPlaylists(this.playlistSearch.value));
    this.modal.addEventListener("shown.ui.modal", () => this.renderPlaylistList());
    this.playlistList.addEventListener("click", event => {
      const item = event.target.closest("[data-playlist-index]");
      if (!item) return;
      this.selectedPlaylistId = this.sortedPlaylists[Number(item.dataset.playlistIndex)]?.[0] || null;
      this.renderPlaylistList();
    });
    this.playlistDetail.addEventListener("click", event => {
      const action = event.target.closest("[data-playlist-action]")?.dataset.playlistAction;
      if (action) this.handlePlaylistAction(action);
    });
  }

  renderPlaylistList() {
    const playlists = playlistManager.loadAllPlaylists();
    this.sortedPlaylists = Object.entries(playlists)
      .sort(([, a], [, b]) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    if (!this.sortedPlaylists.some(([id]) => id === this.selectedPlaylistId)) {
      this.selectedPlaylistId = this.sortedPlaylists[0]?.[0] || null;
    }
    this.noPlaylistsMessage.style.display = this.sortedPlaylists.length ? "none" : "";
    this.playlistList.innerHTML = this.sortedPlaylists.map(([id, playlist], index) => `
      <button type="button" class="playlist-item ${id === this.selectedPlaylistId ? "active" : ""}" data-playlist-index="${index}" aria-current="${id === this.selectedPlaylistId}">
        <span class="playlist-item-name">${escapeHtml(playlist.name)}</span><small>${playlist.songCount}</small>
      </button>
    `).join("");
    this.filterPlaylists(this.playlistSearch.value);
    this.renderPlaylistDetail(playlists[this.selectedPlaylistId]);
    if (this.selectedPlaylistId) playlistManager.hydratePlaylistMetadata(this.selectedPlaylistId);
  }

  renderPlaylistDetail(playlist) {
    if (!playlist) {
      this.playlistDetail.innerHTML = '<div class="playlist-detail-empty"><svg class="icon icon-lg" aria-hidden="true"><use href="#queue_music"></use></svg><strong>Choose a playlist</strong><span>Saved lists appear on the left.</span></div>';
      return;
    }
    const date = new Date(playlist.updatedAt || playlist.createdAt).toLocaleDateString();
    const preview = playlist.songs.slice(0, 30).map((song, index) => {
      const detail = song.songArtist || (!song.songName ? "Song details are unavailable" : "");
      return `<div class="playlist-song"><span class="playlist-song-number">${index + 1}</span><div><strong>${escapeHtml(song.songName || `ANN Song ID ${song.annSongId}`)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}</div></div>`;
    }).join("");
    this.playlistDetail.innerHTML = `
      <div class="playlist-detail-head"><div><h6>${escapeHtml(playlist.name)}</h6><p>${playlist.songCount} song${playlist.songCount === 1 ? "" : "s"} · Updated ${date}</p></div></div>
      <div class="playlist-detail-actions">
        <button type="button" class="btn btn-sm btn-primary" data-playlist-action="load"><svg class="icon" aria-hidden="true"><use href="#table_chart"></use></svg>Load to table</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-playlist-action="export">Export</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-playlist-action="rename">Rename</button>
        <button type="button" class="btn btn-sm btn-outline-secondary ${playlistManager.getAutoAddPlaylistId() === this.selectedPlaylistId ? "active" : ""}" data-playlist-action="auto-add" aria-pressed="${playlistManager.getAutoAddPlaylistId() === this.selectedPlaylistId}">Auto add</button>
      </div>
      <div class="playlist-song-heading">Songs <span>Showing ${Math.min(playlist.songCount, 30)} of ${playlist.songCount}</span></div>
      <div class="playlist-songs">${preview || '<p class="empty-state-message">This playlist is empty.</p>'}</div>
      <div class="playlist-detail-bottom"><button type="button" class="btn btn-sm btn-outline-secondary" data-playlist-action="replace">Replace with current table</button><button type="button" class="btn btn-sm btn-outline-danger" data-playlist-action="delete">Delete playlist</button></div>
    `;
  }

  handlePlaylistAction(action) {
    const id = this.selectedPlaylistId;
    const playlist = id && playlistManager.loadPlaylist(id);
    if (!playlist) return;
    if (action === "load") {
      this.hide();
      playlistManager.loadPlaylistIntoTable(id);
    } else if (action === "export") {
      playlistManager.exportPlaylist(id);
    } else if (action === "rename") {
      const name = prompt("New playlist name:", playlist.name)?.trim();
      if (name && name !== playlist.name) {
        playlistManager.renamePlaylist(id, name);
      }
    } else if (action === "replace") {
      if (confirm(`Replace "${playlist.name}" with the current table contents?`)) playlistManager.replacePlaylist(id);
    } else if (action === "auto-add") {
      playlistManager.toggleAutoAddPlaylist(id);
    } else if (action === "delete") {
      if (confirm(`Delete playlist "${playlist.name}"?`)) {
        playlistManager.deletePlaylist(id);
      }
    }
  }

  filterPlaylists(searchTerm) {
    const query = String(searchTerm || "").trim().toLowerCase();
    let matches = 0;
    this.playlistList.querySelectorAll(".playlist-item").forEach(item => {
      item.hidden = !item.querySelector(".playlist-item-name").textContent.toLowerCase().includes(query);
      if (!item.hidden) matches++;
    });
    this.noMatchesMessage.style.display = query && this.sortedPlaylists.length && !matches ? "" : "none";
  }
}

const playlistModal = new PlaylistModal();
