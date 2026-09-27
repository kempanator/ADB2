class PlayerView {
  constructor({ events, playback, settings, showSongDetails }) {
    Object.assign(this, { events, playback, settings, showSongDetails });
    this.elements = {
      art: document.getElementById("player-artwork"),
      title: document.getElementById("player-title"),
      context: document.getElementById("player-context"),
      toggle: document.getElementById("player-play-pause-button"),
      repeat: document.getElementById("player-repeat-button"),
      seek: document.getElementById("player-seek-input"),
      elapsed: document.getElementById("player-elapsed"),
      duration: document.getElementById("player-duration"),
      volume: document.getElementById("player-volume-input"),
      mute: document.getElementById("player-mute-button"),
      source: document.getElementById("player-source-link"),
      info: document.getElementById("player-info-button")
    };
    this.elements.toggle.addEventListener("click", () => this.playback.togglePlayPause());
    this.elements.seek.addEventListener("input", () => {
      if (Number.isFinite(this.playback.audio.duration)) this.playback.setCurrentTime(Number(this.elements.seek.value));
    });
    this.elements.volume.addEventListener("input", () => {
      this.playback.audio.muted = false;
      this.playback.setVolume(Number(this.elements.volume.value) / 100);
    });
    this.elements.mute.addEventListener("click", () => { this.playback.audio.muted = !this.playback.audio.muted; });
    this.elements.info.addEventListener("click", () => {
      const key = this.playback.getCurrentKey();
      if (key) this.showSongDetails(key);
    });
    this.elements.repeat.addEventListener("click", () => this.playback.cycleRadioMode());
    this.events.on("audio:state-changed", () => this.render());
    this.events.on("audio:progress-changed", () => this.render());
    this.events.on("settings:changed", () => this.render());
    document.getElementById("player-previous-button").addEventListener("click", () => this.playback.previous());
    document.getElementById("player-next-button").addEventListener("click", () => this.playback.next());
  }

  render() {
    const ui = this.elements;
    const visible = Boolean(this.playback.getCurrentKey());
    document.getElementById("player-container")?.classList.toggle("show", visible);
    document.body.classList.toggle("has-player", visible);
    const song = this.playback.getCurrentSong();
    const anime = song ? songAnimeTitle(song, this.settings.get("language")) : "";
    ui.title.textContent = song?.songName || "No song selected";
    ui.context.textContent = song ? [song.songArtist, anime].filter(Boolean).join(" · ") : "Choose a song from the results";
    ui.art.textContent = anime ? anime.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() : "ADB";
    const playing = Boolean(song) && !this.playback.audio.paused;
    ui.toggle.setAttribute("aria-label", playing ? "Pause" : "Play");
    ui.toggle.title = playing ? "Pause" : "Play";
    ui.toggle.querySelector("use").setAttribute("href", `#${playing ? "pause" : "play_arrow"}`);
    const duration = Number.isFinite(this.playback.audio.duration) ? this.playback.audio.duration : 0;
    ui.seek.max = String(duration || 100);
    ui.seek.value = String(Math.min(this.playback.audio.currentTime || 0, duration || 100));
    ui.elapsed.textContent = this.playback.formatTime(this.playback.audio.currentTime);
    ui.duration.textContent = this.playback.formatTime(duration);
    ui.volume.value = String(Math.round(this.playback.audio.volume * 100));
    ui.mute.setAttribute("aria-label", this.playback.audio.muted ? "Unmute" : "Mute");
    ui.mute.title = this.playback.audio.muted ? "Unmute" : "Mute";
    ui.mute.querySelector("use").setAttribute("href", `#${this.playback.audio.muted ? "volume_off" : "volume_up"}`);
    const mode = this.settings.get("radioMode");
    ui.repeat.classList.toggle("active", mode !== "none");
    ui.repeat.title = mode === "repeat" ? "Repeat song" : mode === "loopAll" ? "Loop table" : "Stop at end";
    ui.repeat.setAttribute("aria-label", `Playback mode: ${ui.repeat.title}`);
    ui.repeat.querySelector("use").setAttribute("href", `#${mode === "repeat" ? "restart_alt" : mode === "loopAll" ? "repeat" : "stop"}`);
    const source = this.playback.activeSourceUrl || this.playback.pickBestUrlFromData(song);
    if (source) ui.source.href = source;
    else ui.source.removeAttribute("href");
    ui.source.tabIndex = source ? 0 : -1;
    ui.source.setAttribute("aria-disabled", String(!source));
    ui.source.setAttribute("aria-label", source ? "Open current source file in a new tab" : "No media file selected");
    ui.source.title = source ? "Open current file in a new tab" : "No media file selected";
    ui.info.disabled = !song;
  }
}
