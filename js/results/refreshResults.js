class RefreshResults {
  constructor({ api, events, notify, results }) {
    Object.assign(this, { api, events, notify, results });
    this.redownloadState = { running: false };
    this.events.on("results:invalidated", () => this.stopRedownload());
  }

  toggle() {
    if (this.redownloadState.running) this.stopRedownload();
    else this.startRedownload();
  }

  startRedownload() {
    const visible = this.results.model.getDisplayData();
    if (!visible.length) {
      this.notify("No songs to redownload.", "warning");
      return;
    }
    const invalid = visible.filter(row => !Number.isSafeInteger(Number(row.annSongId)) || Number(row.annSongId) <= 0).length;
    if (invalid) {
      this.notify(`Error: ${invalid} songs have an invalid ANN Song ID`, "danger");
      return;
    }

    // A redownload is a table load too, so it supersedes any pending search.
    this.results.invalidatePendingWork();
    const ids = visible.map(row => Number(row.annSongId));
    const batches = [];
    for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));
    const run = {
      running: true, cancelled: false, finalized: false,
      controller: new AbortController(), generation: this.results.revision,
      processed: 0, total: batches.length, success: 0
    };
    this.redownloadState = run;
    this.events.emit("results:task-state-changed", { task: "redownload", running: true });
    this.notify(`Redownloading 0/${run.total} batches.`, "warning");

    const execute = async () => {
      const collected = [];
      let failure = null;
      try {
        for (const batch of batches) {
          if (run.cancelled || run.generation !== this.results.revision) break;
          const data = await this.api.getSongBatch(batch, run.controller.signal);
          if (run.cancelled || run.generation !== this.results.revision) break;
          const rows = data;
          collected.push(...rows);
          run.success += rows.length;
          run.processed++;
          this.notify(`Redownloading ${run.processed}/${run.total} batches.`, "warning");
        }
      } catch (error) {
        if (!run.cancelled && error?.name !== "AbortError") failure = error;
      } finally {
        if (this.redownloadState !== run) return;
        run.running = false;
        this.events.emit("results:task-state-changed", { task: "redownload", running: false });
        if (run.finalized) return;
        run.finalized = true;
        if (failure) {
          this.notify(`Redownload failed: ${failure.message || failure}`, "danger");
        } else if (run.cancelled || run.generation !== this.results.revision || run.processed < run.total) {
          this.notify(`Redownload stopped (${run.processed}/${run.total}).`, "danger");
        } else {
          const byAnnSongId = new Map(collected.map(row => [Number(row.annSongId), row]));
          const rebuilt = visible.map(old => byAnnSongId.get(Number(old.annSongId)) || old);
          this.results.loadData(rebuilt);
          this.notify(`Redownload completed (${run.processed}/${run.total}). ${run.success} songs redownloaded.`, "success");
        }
      }
    };
    return execute();
  }

  stopRedownload() {
    const run = this.redownloadState;
    if (!run.running) return;
    run.cancelled = true;
    run.running = false;
    run.controller.abort();
    this.events.emit("results:task-state-changed", { task: "redownload", running: false });
    if (!run.finalized) {
      run.finalized = true;
      this.notify(`Redownload stopped (${run.processed}/${run.total}).`, "danger");
    }
  }
}
