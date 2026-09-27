class CheckMediaLinks {
  constructor({ events, notify, results, settings }) {
    Object.assign(this, { events, notify, results, settings });
    this.linkCheckState = { running: false };
    this.events.on("results:invalidated", () => this.stopLinkCheck());
    this.events.on("settings:fileHost-changed", () => {
      this.stopLinkCheck();
      this.events.emit("results:link-check-reset");
    });
  }

  toggle() {
    if (this.linkCheckState.running) this.stopLinkCheck();
    else this.startLinkCheck();
  }

  startLinkCheck() {
    const visible = this.results.model.getDisplayData();
    if (!visible.length) {
      this.notify("No songs to check.", "warning");
      return;
    }
    this.events.emit("results:link-check-reset");
    const run = {
      running: true, cancelled: false, finalized: false,
      controller: new AbortController(), generation: this.results.revision,
      processed: 0, total: visible.length, bad: 0, fileHost: this.settings.get("fileHost")
    };
    this.linkCheckState = run;
    this.events.emit("results:task-state-changed", { task: "link-check", running: true });
    this.updateLinkCheckAlert(run);

    const tasks = visible.map(row => () => this.checkRowLinks(row, run));
    return this.runWithConcurrency(tasks, 5, run).then(() => {
      if (this.linkCheckState !== run) return;
      run.running = false;
      this.events.emit("results:task-state-changed", { task: "link-check", running: false });
      if (!run.finalized) {
        this.updateLinkCheckAlert(run, true, run.cancelled || run.generation !== this.results.revision || run.processed < run.total);
        run.finalized = true;
      }
    }).catch(error => {
      if (this.linkCheckState !== run) return;
      run.cancelled = true;
      run.controller.abort();
      run.running = false;
      this.events.emit("results:task-state-changed", { task: "link-check", running: false });
      if (!run.finalized) this.notify(`Link check failed: ${error.message || error}`, "danger");
      run.finalized = true;
    });
  }

  stopLinkCheck() {
    const run = this.linkCheckState;
    if (!run.running) return;
    run.cancelled = true;
    run.running = false;
    run.controller.abort();
    this.events.emit("results:task-state-changed", { task: "link-check", running: false });
    if (!run.finalized) {
      this.updateLinkCheckAlert(run, true, true);
      run.finalized = true;
    }
  }

  updateLinkCheckAlert(run, done = false, stopped = false) {
    if (run.finalized) return;
    if (done) {
      const result = stopped ? "stopped" : "completed";
      const detail = stopped ? "bad links found so far" : "bad links found";
      this.notify(`Link check ${result} (${run.processed}/${run.total}). ${run.bad} ${detail}.`, stopped ? "danger" : "success");
    } else {
      this.notify(`Processing songs ${run.processed}/${run.total}.`, "warning");
    }
  }

  async runWithConcurrency(tasks, limit, run) {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (run.running && !run.cancelled && run.generation === this.results.revision && this.linkCheckState === run && next < tasks.length) {
        await tasks[next++]();
      }
    });
    await Promise.all(workers);
  }

  async checkRowLinks(row, run) {
    if (run.cancelled || run.generation !== this.results.revision) return;
    const key = this.results.getKeyForRow(row);
    const fileHost = run.fileHost;
    const urls = [
      { label: "720", url: buildSongMediaUrl(row.HQ, fileHost) },
      { label: "480", url: buildSongMediaUrl(row.MQ, fileHost) },
      { label: "MP3", url: buildSongMediaUrl(row.audio, fileHost) }
    ].filter(item => item.url);

    await Promise.all(urls.map(async ({ label, url }) => {
      const ok = await probeMediaUrl(url, run.controller.signal);
      if (run.cancelled || run.generation !== this.results.revision || this.linkCheckState !== run) return;
      this.events.emit("results:link-check-result", { key, label, ok });
      if (!ok) run.bad++;
    }));
    if (run.cancelled || run.generation !== this.results.revision) return;
    run.processed++;
    if (run.processed % 5 === 0 || run.processed === run.total) this.updateLinkCheckAlert(run);
  }
}
