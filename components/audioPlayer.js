class AudioPlayer {
  constructor() {
    this.audio = document.getElementById("player-audio");
    this.playerUI = {
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
    this.queueKeys = [];
    this.failedSources = new Set();
    this.activeSourceUrl = "";
    this.wireEvents();
  }

  // Wire up audio element event listeners
  wireEvents() {
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("pause", () => this.onPause());
    this.audio.addEventListener("play", () => this.onPlay());
    this.audio.addEventListener("error", () => this.onError());
    for (const eventName of ["timeupdate", "durationchange", "loadedmetadata", "volumechange"])
      this.audio.addEventListener(eventName, () => this.updatePlayerUI());
    this.playerUI.toggle.addEventListener("click", () => eventBus.emit("audio:toggle-play-pause"));
    this.playerUI.seek.addEventListener("input", () => {
      if (Number.isFinite(this.audio.duration)) this.setCurrentTime(Number(this.playerUI.seek.value));
    });
    this.playerUI.volume.addEventListener("input", () => {
      this.audio.muted = false;
      this.setVolume(Number(this.playerUI.volume.value) / 100);
    });
    this.playerUI.mute.addEventListener("click", () => { this.audio.muted = !this.audio.muted; });
    this.playerUI.info.addEventListener("click", () => {
      const key = this.getCurrentKey();
      if (key) eventBus.emit("song:show-info", key);
    });
    this.playerUI.repeat.addEventListener("click", () => this.cycleRadioMode());
    eventBus.on("audio:cycle-radio-mode", () => this.cycleRadioMode());

    // Listen for song play events from EventBus
    eventBus.on("song:play", (songId) => {
      if (this.getCurrentKey() === songId) {
        this.togglePlayPause();
      } else {
        this.play(songId);
      }
    });

    // Listen for audio control events
    eventBus.on("audio:previous", () => {
      this.previous();
    });

    eventBus.on("audio:next", () => {
      this.next();
    });

    eventBus.on("audio:toggle-play-pause", () => {
      this.togglePlayPause();
    });

    eventBus.on("table:rendered", keys => {
      this.queueKeys = [...keys];
      const currentKey = this.getCurrentKey();
      if (currentKey && !this.queueKeys.includes(currentKey)) this.stop();
      this.updatePlayerUI();
    });
    eventBus.on("settings:defaultAudioVolume-changed", () => this.applyDefaultVolumeFromSettings());
    eventBus.on("settings:changed", () => this.updatePlayerUI());

    // React to file host changes by updating current audio source
    eventBus.on("settings:fileHost-changed", () => {
      const key = this.getCurrentKey();
      if (!key) return;
      const src = this.getBestSourceUrlForKey(key);
      if (!src) return;
      const wasPlaying = !this.audio.paused;
      this.failedSources.clear();
      if (!wasPlaying) {
        this.activeSourceUrl = "";
        this.audio.removeAttribute("src");
        this.audio.load();
        return;
      }
      this.activeSourceUrl = src;
      if (this.audio.src !== src) {
        this.audio.src = src;
      }
      if (wasPlaying) {
        this.audio.play().catch(() => { });
      }
    });
  }

  cycleRadioMode() {
    const modes = ["none", "repeat", "loopAll"];
    const next = modes[(modes.indexOf(settingsManager.get("radioMode")) + 1) % modes.length];
    settingsManager.set("radioMode", next);
  }

  // Play a song by its unique key identifier
  play(key, { preserveFailures = false } = {}) {
    if (!key || !this.queueKeys.includes(key)) return;
    if (!preserveFailures) this.failedSources.clear();
    const src = this.getAvailableSources(key).find(url => !this.failedSources.has(url));
    if (!src) return;
    this.activeSourceUrl = src;

    // Update global state instead of local state
    appState.updateStateSlice("audio.currentSongId", () => key);

    if (this.audio.src !== src) {
      this.audio.src = src;
    }

    this.ensureVisible();
    this.updatePlayerUI();

    // Update button states before attempting to play
    this.updatePlayButtonStates(key);

    // Handle audio.play() Promise and potential autoplay restrictions
    this.audio.play().catch(error => {
      console.warn("AudioPlayer.play: Failed to play audio:", error);
      // Reset button states on play failure
      this.updatePlayButtonStates();
    });
  }

  // Pause the currently playing audio
  pause() {
    this.audio.pause();
  }

  // Stop playback and reset to beginning
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.activeSourceUrl = "";
    this.failedSources.clear();
    appState.updateStateSlice("audio.currentSongId", () => null);
    this.audio.removeAttribute("src");
    this.audio.load();
    this.updatePlayButtonStates();
    document.getElementById("player-container")?.classList.remove("show");
    document.body.classList.remove("has-player");
    this.updatePlayerUI();
  }

  // Toggle between play and pause states
  togglePlayPause() {
    if (this.audio.paused) {
      if (!this.activeSourceUrl && this.getCurrentKey()) {
        this.play(this.getCurrentKey());
        return;
      }
      // Update button states before attempting to play
      this.updatePlayButtonStates();

      this.audio.play().catch(error => {
        console.warn("AudioPlayer.togglePlayPause: Failed to play audio:", error);
        // Reset button states on play failure
        this.updatePlayButtonStates();
      });
    } else {
      this.audio.pause();
    }
  }

  // Play the next song in the playlist
  next({ preserveFailures = false } = {}) {
    if (!preserveFailures) this.failedSources.clear();
    const nextKey = this.getNextPlayableKey();
    if (nextKey) {
      this.play(nextKey, { preserveFailures: true });
    }
  }

  // Play the previous song in the playlist
  previous({ preserveFailures = false } = {}) {
    if (!preserveFailures) this.failedSources.clear();
    const prevKey = this.getPreviousPlayableKey();
    if (prevKey) {
      this.play(prevKey, { preserveFailures: true });
    }
  }

  // Get the currently playing song data object
  getCurrentSong() {
    const currentKey = appState.getStateSlice("audio.currentSongId");
    if (!currentKey) return null;

    return tableManager.model.getRow(currentKey);
  }

  // Check if audio is currently playing
  isPlaying() {
    return !this.audio.paused;
  }

  // Get playback progress as percentage (0-100)
  getProgress() {
    return this.audio.duration > 0 ? (this.audio.currentTime / this.audio.duration) * 100 : 0;
  }

  // Handle audio playback ended event
  onEnded() {
    const mode = settingsManager.get("radioMode");

    if (mode === "repeat") {
      this.audio.currentTime = 0;
      this.audio.play().catch(error => {
        console.warn("AudioPlayer.onEnded: Failed to repeat audio:", error);
      });
    } else if (mode === "loopAll") {
      this.next({ preserveFailures: true });
    }
  }

  // Try the next source for this song, then another song, at most once per URL.
  onError() {
    if (!this.activeSourceUrl || this.failedSources.has(this.activeSourceUrl)) return;
    this.failedSources.add(this.activeSourceUrl);
    const key = this.getCurrentKey();
    if (this.getAvailableSources(key).some(url => !this.failedSources.has(url))) {
      this.play(key, { preserveFailures: true });
      return;
    }
    if (settingsManager.get("radioMode") === "loopAll") {
      const nextKey = this.getNextPlayableKey();
      if (nextKey) {
        this.play(nextKey, { preserveFailures: true });
        return;
      }
    }
    this.stop();
  }

  // Handle audio play event
  onPlay() {
    this.updatePlayButtonStates();
    this.updatePlayerUI();
  }

  // Handle audio pause event
  onPause() {
    this.updatePlayButtonStates();
    this.updatePlayerUI();
  }

  updatePlayerUI() {
    const ui = this.playerUI;
    const song = this.getCurrentSong();
    const anime = song ? tableAnimeTitle(song, settingsManager.get("language")) : "";
    ui.title.textContent = song?.songName || "No song selected";
    ui.context.textContent = song ? [song.songArtist, anime].filter(Boolean).join(" · ") : "Choose a song from the results";
    ui.art.textContent = anime ? anime.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() : "ADB";
    const playing = Boolean(song) && !this.audio.paused;
    ui.toggle.setAttribute("aria-label", playing ? "Pause" : "Play");
    ui.toggle.title = playing ? "Pause" : "Play";
    ui.toggle.querySelector("use").setAttribute("href", `#${playing ? "pause" : "play_arrow"}`);
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    ui.seek.max = String(duration || 100);
    ui.seek.value = String(Math.min(this.audio.currentTime || 0, duration || 100));
    ui.elapsed.textContent = this.formatTime(this.audio.currentTime);
    ui.duration.textContent = this.formatTime(duration);
    ui.volume.value = String(Math.round(this.audio.volume * 100));
    ui.mute.setAttribute("aria-label", this.audio.muted ? "Unmute" : "Mute");
    ui.mute.title = this.audio.muted ? "Unmute" : "Mute";
    ui.mute.querySelector("use").setAttribute("href", `#${this.audio.muted ? "volume_off" : "volume_up"}`);
    const mode = settingsManager.get("radioMode");
    ui.repeat.classList.toggle("active", mode !== "none");
    ui.repeat.title = mode === "repeat" ? "Repeat song" : mode === "loopAll" ? "Loop table" : "Stop at end";
    ui.repeat.setAttribute("aria-label", `Playback mode: ${ui.repeat.title}`);
    ui.repeat.querySelector("use").setAttribute("href", `#${mode === "repeat" ? "restart_alt" : mode === "loopAll" ? "repeat" : "stop"}`);
    const source = this.activeSourceUrl || this.pickBestUrlFromData(song);
    ui.source.textContent = /\.mp3(?:[?#]|$)/i.test(source) ? "MP3" : source ? "VIDEO" : "—";
    if (source) ui.source.href = source;
    else ui.source.removeAttribute("href");
    ui.source.tabIndex = source ? 0 : -1;
    ui.source.setAttribute("aria-disabled", String(!source));
    ui.source.setAttribute("aria-label", source ? `Open current ${ui.source.textContent} file in a new tab` : "No media file selected");
    ui.source.title = source ? "Open current file in a new tab" : "No media file selected";
    ui.info.disabled = !song;
  }

  // Get the next song key in the current order
  getNextKey() {
    const order = this.getOrderKeys();
    if (!order.length) return null;

    const currentKey = this.getCurrentKey();
    const i = order.indexOf(currentKey);
    return order[(i + 1) % order.length];
  }

  // Get the previous song key in the current order
  getPreviousKey() {
    const order = this.getOrderKeys();
    if (!order.length) return null;

    const currentKey = this.getCurrentKey();
    const i = order.indexOf(currentKey);
    if (i < 0) return order.at(-1);
    return order[(i - 1 + order.length) % order.length];
  }

  // Get the next song key that has playable audio sources
  getNextPlayableKey() {
    return this.findPlayableKey(1);
  }

  // Get the previous song key that has playable audio sources
  getPreviousPlayableKey() {
    return this.findPlayableKey(-1);
  }

  findPlayableKey(direction) {
    const order = this.getOrderKeys();
    if (!order.length) return null;
    const start = order.indexOf(this.getCurrentKey());
    for (let step = 1; step <= order.length; step++) {
      const index = start < 0
        ? (direction > 0 ? step - 1 : order.length - step)
        : (start + direction * step + order.length * 2) % order.length;
      const key = order[index];
      if (this.getAvailableSources(key).some(url => !this.failedSources.has(url))) return key;
    }
    return null;
  }

  // Let each view refresh its play buttons from the current audio state.
  updatePlayButtonStates() {
    eventBus.emit("audio:state-changed");
  }

  // Ensure the audio player is visible in the UI
  ensureVisible() {
    const wrap = document.getElementById("player-container");
    if (wrap && !wrap.classList.contains("show")) {
      wrap.classList.add("show");
      document.body.classList.add("has-player");
    }
  }

  // Keep these methods available for existing integrations.
  buildMediaUrl(value) {
    return buildSongMediaUrl(value, settingsManager.get("fileHost"));
  }

  rewriteFileHost(url) {
    return rewriteSongMediaHost(url, settingsManager.get("fileHost"));
  }

  // Pick the best available media URL from song data
  pickBestUrlFromData(row) {
    if (!row) return "";
    const mp3 = row.audio || "";
    const mq = row.MQ || ""; // 480
    const hq = row.HQ || ""; // 720
    const fileHost = settingsManager.get("fileHost");
    return buildSongMediaUrl(mp3, fileHost) || buildSongMediaUrl(mq, fileHost) || buildSongMediaUrl(hq, fileHost);
  }

  // Playback follows the same order shown in the table and mobile cards.
  getOrderKeys() {
    return this.queueKeys;
  }

  getAvailableSources(key) {
    const row = tableManager.model.getRow(key);
    if (!row) return [];
    const fileHost = settingsManager.get("fileHost");
    return [...new Set([row.audio, row.MQ, row.HQ]
      .map(value => buildSongMediaUrl(value, fileHost)).filter(Boolean))];
  }

  // Resolve the best source URL for a given key using state data
  getBestSourceUrlForKey(key) {
    return this.pickBestUrlFromData(tableManager.model.getRow(key));
  }

  // Get the current song key
  getCurrentKey() {
    return appState.getStateSlice("audio.currentSongId");
  }

  // Set the current song key
  setCurrentKey(key) {
    // Update global state instead of local state
    appState.updateStateSlice("audio.currentSongId", () => key);
    this.updatePlayButtonStates();
  }

  // Get current playback time in seconds
  getCurrentTime() {
    return this.audio.currentTime;
  }

  // Get total duration of current audio in seconds
  getDuration() {
    return this.audio.duration;
  }

  // Set current playback time in seconds
  setCurrentTime(time) {
    if (Number.isFinite(time) && time >= 0) {
      this.audio.currentTime = time;
    }
  }

  // Get current volume level (0-1)
  getVolume() {
    return this.audio.volume;
  }

  // Set volume level (0-1)
  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  // Set volume from Settings (0–100); call after settingsManager has loaded (e.g. DOM ready).
  applyDefaultVolumeFromSettings() {
    const pct = settingsManager.get("defaultAudioVolume");
    const n = typeof pct === "number" && Number.isFinite(pct) ? pct : 100;
    this.setVolume(Math.max(0, Math.min(100, Math.round(n))) / 100);
  }

  // Check if audio is muted
  isMuted() {
    return this.audio.muted;
  }

  // Set audio mute state
  setMuted(muted) {
    this.audio.muted = muted;
  }

  // Get current time formatted as MM:SS
  getCurrentTimeFormatted() {
    return this.formatTime(this.audio.currentTime);
  }

  // Get duration formatted as MM:SS
  getDurationFormatted() {
    return this.formatTime(this.audio.duration);
  }

  // Format seconds into MM:SS time string
  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Get all available audio sources for a song
  getSongSources(key) {
    const row = tableManager.model.getRow(key);
    if (!row) return { hq: null, mq: null, mp3: null };
    return {
      hq: buildSongMediaUrl(row.HQ || "", settingsManager.get("fileHost")),
      mq: buildSongMediaUrl(row.MQ || "", settingsManager.get("fileHost")),
      mp3: buildSongMediaUrl(row.audio || "", settingsManager.get("fileHost"))
    };
  }
}

const audioPlayer = new AudioPlayer();
