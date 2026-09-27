class PlaylistSelectionDialog {
  constructor({ notify, playlistStore, playlists, results, ui }) {
    Object.assign(this, { notify, playlistStore, playlists, results, ui });
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
    title.textContent = this.results.getAnimeTitle(songData);
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
    const records = this.playlistStore.loadAllPlaylists();
    Object.entries(records).forEach(([id, playlist]) => {
      this.select.add(new Option(`${playlist.name} (${playlist.songCount} songs)`, id));
    });
    const previous = this.playlists.getLastSelectedPlaylistId();
    this.select.value = previous && records[previous] ? previous : "";
    this.btnAddToPlaylist.disabled = !this.select.value;
    this.syncAutoAdd();
    this.ui.showModal(this.modal);
  }

  hide() {
    this.ui.hideModal(this.modal);
  }

  syncAutoAdd() {
    this.autoAdd.disabled = !this.select.value;
    this.autoAdd.checked = !!this.select.value && this.playlists.getAutoAddPlaylistId() === this.select.value;
  }

  wireEvents() {
    this.select.addEventListener("change", () => {
      this.btnAddToPlaylist.disabled = !this.select.value;
      this.playlists.setLastSelectedPlaylistId(this.select.value);
      this.syncAutoAdd();
    });

    this.autoAdd.addEventListener("change", () => {
      if (!this.select.value) return this.syncAutoAdd();
      if (this.autoAdd.checked !== (this.playlists.getAutoAddPlaylistId() === this.select.value)) {
        this.playlists.toggleAutoAddPlaylist(this.select.value);
      }
      this.syncAutoAdd();
    });

    this.btnAddToPlaylist.addEventListener("click", () => {
      if (this.select.value && this.songData) {
        this.playlists.addSongToPlaylist(this.select.value, this.songData);
      }
    });

    this.btnCreateAndAdd.addEventListener("click", () => {
      const name = this.newPlaylistName.value.trim();
      if (!name) {
        this.notify("Please enter a playlist name", "warning");
        return;
      }
      this.playlists.savePlaylist(name, [this.songData]);
      this.hide();
      this.newPlaylistName.value = "";
      this.notify(`Song added to new playlist "${name}"`, "success");
    });
  }
}
