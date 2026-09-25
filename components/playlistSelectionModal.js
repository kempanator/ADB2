class PlaylistSelectionModal {
  constructor() {
    this.modal = document.querySelector("#playlist-selection-modal");
    this.select = document.querySelector("#playlist-selection-select");
    this.autoAdd = document.querySelector("#playlist-selection-auto-add-checkbox");
    this.newPlaylistName = document.querySelector("#playlist-selection-new-name-input");
    this.btnAddToPlaylist = document.querySelector("#playlist-selection-add-button");
    this.btnCreateAndAdd = document.querySelector("#playlist-selection-create-button");
    this.songData = null;
    this.wireEvents();
  }

  show(songData) {
    this.songData = songData;
    const songInfo = this.modal.querySelector(".playlist-selection-song-info");
    const title = document.createElement("div");
    title.className = "fw-bold playlist-selection-anime";
    title.textContent = tableManager.getAnimeTitle(songData);
    const badges = songTypeBadgesHTML(shortSongType(songData.songType), songData);
    if (badges) {
      const badgeGroup = document.createElement("span");
      badgeGroup.className = "playlist-selection-badges";
      badgeGroup.innerHTML = badges;
      title.append(badgeGroup);
    }
    const subtitle = document.createElement("div");
    subtitle.className = "text-muted";
    subtitle.textContent = `${songData.songName || ""}${songData.songArtist ? ` — ${songData.songArtist}` : ""}`;
    songInfo.replaceChildren(title, subtitle);

    this.select.replaceChildren(new Option("-- Select a playlist --", ""));
    const playlists = playlistManager.loadAllPlaylists();
    Object.entries(playlists).forEach(([id, playlist]) => {
      this.select.add(new Option(`${playlist.name} (${playlist.songCount} songs)`, id));
    });
    const previous = playlistManager.getLastSelectedPlaylistId();
    this.select.value = previous && playlists[previous] ? previous : "";
    this.btnAddToPlaylist.disabled = !this.select.value;
    this.syncAutoAdd();
    ui.showModal(this.modal);
  }

  hide() {
    ui.hideModal(this.modal);
  }

  syncAutoAdd() {
    this.autoAdd.disabled = !this.select.value;
    this.autoAdd.checked = !!this.select.value && playlistManager.getAutoAddPlaylistId() === this.select.value;
  }

  wireEvents() {
    eventBus.on("playlist:selection-open", songData => this.show(songData));
    eventBus.on("playlist:selection-close", () => this.hide());
    this.select.addEventListener("change", () => {
      this.btnAddToPlaylist.disabled = !this.select.value;
      playlistManager.setLastSelectedPlaylistId(this.select.value);
      this.syncAutoAdd();
    });

    this.autoAdd.addEventListener("change", () => {
      if (!this.select.value) return this.syncAutoAdd();
      if (this.autoAdd.checked !== (playlistManager.getAutoAddPlaylistId() === this.select.value)) {
        playlistManager.toggleAutoAddPlaylist(this.select.value);
      }
      this.syncAutoAdd();
    });

    this.btnAddToPlaylist.addEventListener("click", () => {
      if (this.select.value && this.songData) {
        playlistManager.addSongToPlaylist(this.select.value, this.songData);
      }
    });

    this.btnCreateAndAdd.addEventListener("click", () => {
      const name = this.newPlaylistName.value.trim();
      if (!name) {
        showAlert("Please enter a playlist name", "warning");
        return;
      }
      playlistManager.savePlaylist(name, [this.songData]);
      this.hide();
      this.newPlaylistName.value = "";
      showAlert(`Song added to new playlist "${name}"`, "success");
    });
  }
}

const playlistSelectionModal = new PlaylistSelectionModal();
