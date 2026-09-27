class PlaybackController {
  constructor({ events, results, settings }) {
    Object.assign(this, { events, results, settings });
    this.audio = document.getElementById("player-audio");
    this.currentRowKey = null;
    this.queueKeys = this.results.model.getDisplayKeys();
    this.failedSources = new Set();
    this.activeSourceUrl = "";
    this.wireEvents();
  }

  wireEvents() {
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("pause", () => this.onPause());
    this.audio.addEventListener("play", () => this.onPlay());
    this.audio.addEventListener("error", () => this.onError());
    for (const name of ["timeupdate", "durationchange", "loadedmetadata", "volumechange"])
      this.audio.addEventListener(name, () => this.events.emit("audio:progress-changed"));
    this.events.on("results:changed", keys => {
      this.queueKeys = [...keys];
      if (this.currentRowKey && !this.queueKeys.includes(this.currentRowKey)) this.stop();
      this.events.emit("audio:progress-changed");
    });
    this.events.on("settings:defaultAudioVolume-changed", () => this.applyDefaultVolumeFromSettings());
    this.events.on("settings:fileHost-changed", () => {
      if (!this.currentRowKey) return;
      const wasPlaying = !this.audio.paused;
      this.failedSources.clear();
      this.activeSourceUrl = "";
      this.audio.removeAttribute("src");
      this.audio.load();
      if (wasPlaying) this.play(this.currentRowKey);
      this.events.emit("audio:progress-changed");
    });
  }

  toggleSong(rowKey) {
    if (this.currentRowKey === rowKey) this.togglePlayPause();
    else this.play(rowKey);
  }

  cycleRadioMode() {
    const modes = ["none", "repeat", "loopAll"];
    const next = modes[(modes.indexOf(this.settings.get("radioMode")) + 1) % modes.length];
    this.settings.set("radioMode", next);
  }

  play(key, { preserveFailures = false } = {}) {
    if (!key || !this.queueKeys.includes(key)) return;
    if (!preserveFailures) this.failedSources.clear();
    const src = this.getAvailableSources(key).find(url => !this.failedSources.has(url));
    if (!src) return;
    this.activeSourceUrl = src;

    const changedSong = this.currentRowKey !== key;
    this.currentRowKey = key;

    if (this.audio.src !== src) {
      this.audio.src = src;
    } else if (changedSong) {
      this.audio.currentTime = 0;
    }

    this.events.emit("audio:progress-changed");

    this.updatePlayButtonStates(key);

    this.audio.play().catch(error => {
      console.warn("PlaybackController.play: Failed to play audio:", error);

      this.updatePlayButtonStates();
    });
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.activeSourceUrl = "";
    this.failedSources.clear();
    this.currentRowKey = null;
    this.audio.removeAttribute("src");
    this.audio.load();
    this.updatePlayButtonStates();
    this.events.emit("audio:progress-changed");
  }

  togglePlayPause() {
    if (!this.currentRowKey) {
      this.next();
      return;
    }
    if (this.audio.paused) {
      if (!this.activeSourceUrl && this.getCurrentKey()) {
        this.play(this.getCurrentKey());
        return;
      }

      this.updatePlayButtonStates();

      this.audio.play().catch(error => {
        console.warn("PlaybackController.togglePlayPause: Failed to play audio:", error);

        this.updatePlayButtonStates();
      });
    } else {
      this.audio.pause();
    }
  }

  next({ preserveFailures = false } = {}) {
    if (!preserveFailures) this.failedSources.clear();
    const nextKey = this.getNextPlayableKey();
    if (nextKey) {
      this.play(nextKey, { preserveFailures: true });
    }
  }

  previous({ preserveFailures = false } = {}) {
    if (!preserveFailures) this.failedSources.clear();
    const prevKey = this.getPreviousPlayableKey();
    if (prevKey) {
      this.play(prevKey, { preserveFailures: true });
    }
  }

  getCurrentSong() {
    const currentKey = this.currentRowKey;
    if (!currentKey) return null;

    return this.results.model.getRow(currentKey);
  }

  isPlaying() {
    return !this.audio.paused;
  }

  onEnded() {
    const mode = this.settings.get("radioMode");

    if (mode === "repeat") {
      this.audio.currentTime = 0;
      this.audio.play().catch(error => {
        console.warn("PlaybackController.onEnded: Failed to repeat audio:", error);
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
    if (this.settings.get("radioMode") === "loopAll") {
      const nextKey = this.getNextPlayableKey();
      if (nextKey) {
        this.play(nextKey, { preserveFailures: true });
        return;
      }
    }
    this.stop();
  }

  onPlay() {
    this.updatePlayButtonStates();
    this.events.emit("audio:progress-changed");
  }

  onPause() {
    this.updatePlayButtonStates();
    this.events.emit("audio:progress-changed");
  }

  getNextPlayableKey() {
    return this.findPlayableKey(1);
  }

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

  updatePlayButtonStates() {
    this.events.emit("audio:state-changed");
  }

  pickBestUrlFromData(row) {
    if (!row) return "";
    const mp3 = row.audio || "";
    const mq = row.MQ || "";
    const hq = row.HQ || "";
    const fileHost = this.settings.get("fileHost");
    return buildSongMediaUrl(mp3, fileHost) || buildSongMediaUrl(mq, fileHost) || buildSongMediaUrl(hq, fileHost);
  }

  // Playback follows the same order shown in the table and mobile cards.
  getOrderKeys() {
    return this.queueKeys;
  }

  getAvailableSources(key) {
    const row = this.results.model.getRow(key);
    if (!row) return [];
    const fileHost = this.settings.get("fileHost");
    return [...new Set([row.audio, row.MQ, row.HQ]
      .map(value => buildSongMediaUrl(value, fileHost)).filter(Boolean))];
  }

  getCurrentKey() {
    return this.currentRowKey;
  }

  setCurrentTime(time) {
    if (Number.isFinite(time) && time >= 0) {
      this.audio.currentTime = time;
    }
  }

  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  applyDefaultVolumeFromSettings() {
    const pct = this.settings.get("defaultAudioVolume");
    const n = typeof pct === "number" && Number.isFinite(pct) ? pct : 100;
    this.setVolume(Math.max(0, Math.min(100, Math.round(n))) / 100);
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}
