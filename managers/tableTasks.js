class TableTasks {
  constructor(manager) {
    this.manager = manager;
    this.linkCheckState = { running: false };
    this.redownloadState = { running: false };
  }

  cancelAll() {
    if (this.linkCheckState.running) this.stopLinkCheck();
    if (this.redownloadState.running) this.stopRedownload();
  }

  // Refresh a snapshot of the displayed rows in batches. A run owns its abort
  // signal, so a stopped run cannot change the next run or replace newer data.
  startRedownload() {
    const visible = this.manager.model.getDisplayData();
    if (!visible.length) {
      showAlert("No songs to redownload.", "warning");
      return;
    }
    const invalid = visible.filter(row => row.annSongId == null || row.annSongId === "" || !Number.isFinite(Number(row.annSongId))).length;
    if (invalid) {
      showAlert(`Error: ${invalid} songs have an invalid ANN Song ID`, "danger");
      return;
    }

    // A redownload is a table load too, so it supersedes any pending search.
    this.manager.bumpTableGeneration();
    const ids = visible.map(row => Number(row.annSongId));
    const batches = [];
    for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));
    const run = {
      running: true, cancelled: false, finalized: false,
      controller: new AbortController(), generation: this.manager.tableGeneration,
      processed: 0, total: batches.length, success: 0
    };
    this.redownloadState = run;
    eventBus.emit("table:task-state-changed", { task: "redownload", running: true });
    showAlert(`Redownloading 0/${run.total} batches.`, "warning");

    const execute = async () => {
      const collected = [];
      let failure = null;
      try {
        for (const batch of batches) {
          if (run.cancelled || run.generation !== this.manager.tableGeneration) break;
          const data = await apiClient.postJson(
            `${API_BASE}/api/ann_song_ids_request`,
            { ann_song_ids: batch },
            run.controller.signal
          );
          if (run.cancelled || run.generation !== this.manager.tableGeneration) break;
          const rows = Array.isArray(data) ? data : [];
          collected.push(...rows);
          run.success += rows.length;
          run.processed++;
          showAlert(`Redownloading ${run.processed}/${run.total} batches.`, "warning");
        }
      } catch (error) {
        if (!run.cancelled && error?.name !== "AbortError") failure = error;
      } finally {
        if (this.redownloadState !== run) return;
        run.running = false;
        eventBus.emit("table:task-state-changed", { task: "redownload", running: false });
        if (run.finalized) return;
        run.finalized = true;
        if (failure) {
          showAlert(`Redownload failed: ${failure.message || failure}`, "danger");
        } else if (run.cancelled || run.generation !== this.manager.tableGeneration || run.processed < run.total) {
          showAlert(`Redownload stopped (${run.processed}/${run.total}).`, "danger");
        } else {
          const byAnnSongId = new Map(collected.map(row => [Number(row.annSongId), row]));
          const rebuilt = visible.map(old => byAnnSongId.get(Number(old.annSongId)) || old);
          this.manager.loadData(rebuilt);
          showAlert(`Redownload completed (${run.processed}/${run.total}). ${run.success} songs redownloaded.`, "success");
        }
      }
    };
    void execute();
  }

  stopRedownload() {
    const run = this.redownloadState;
    if (!run.running) return;
    run.cancelled = true;
    run.running = false;
    run.controller.abort();
    eventBus.emit("table:task-state-changed", { task: "redownload", running: false });
    if (!run.finalized) {
      run.finalized = true;
      showAlert(`Redownload stopped (${run.processed}/${run.total}).`, "danger");
    }
  }

  // Validate a snapshot with limited concurrency and a separate run signal.
  startLinkCheck() {
    const visible = this.manager.model.getDisplayData();
    if (!visible.length) {
      showAlert("No songs to check.", "warning");
      return;
    }
    eventBus.emit("table:link-check-reset");
    const run = {
      running: true, cancelled: false, finalized: false,
      controller: new AbortController(), generation: this.manager.tableGeneration,
      processed: 0, total: visible.length, bad: 0
    };
    this.linkCheckState = run;
    eventBus.emit("table:task-state-changed", { task: "link-check", running: true });
    this.updateLinkCheckAlert(run);

    const tasks = visible.map(row => () => this.checkRowLinks(row, run));
    this.runWithConcurrency(tasks, 5, run).then(() => {
      if (this.linkCheckState !== run) return;
      run.running = false;
      eventBus.emit("table:task-state-changed", { task: "link-check", running: false });
      if (!run.finalized) {
        this.updateLinkCheckAlert(run, true, run.cancelled || run.generation !== this.manager.tableGeneration || run.processed < run.total);
        run.finalized = true;
      }
    }).catch(error => {
      if (this.linkCheckState !== run) return;
      run.running = false;
      eventBus.emit("table:task-state-changed", { task: "link-check", running: false });
      if (!run.finalized) showAlert(`Link check failed: ${error.message || error}`, "danger");
      run.finalized = true;
    });
  }

  stopLinkCheck() {
    const run = this.linkCheckState;
    if (!run.running) return;
    run.cancelled = true;
    run.running = false;
    run.controller.abort();
    eventBus.emit("table:task-state-changed", { task: "link-check", running: false });
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
      showAlert(`Link check ${result} (${run.processed}/${run.total}). ${run.bad} ${detail}.`, stopped ? "danger" : "success");
    } else {
      showAlert(`Processing songs ${run.processed}/${run.total}.`, "warning");
    }
  }

  async runWithConcurrency(tasks, limit, run) {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (run.running && !run.cancelled && run.generation === this.manager.tableGeneration && this.linkCheckState === run && next < tasks.length) {
        await tasks[next++]();
      }
    });
    await Promise.all(workers);
  }

  async checkRowLinks(row, run) {
    if (run.cancelled || run.generation !== this.manager.tableGeneration) return;
    const key = this.manager.getKeyForRow(row);
    const fileHost = settingsManager.get("fileHost");
    const urls = [
      { label: "720", url: buildSongMediaUrl(row.HQ, fileHost) },
      { label: "480", url: buildSongMediaUrl(row.MQ, fileHost) },
      { label: "MP3", url: buildSongMediaUrl(row.audio, fileHost) }
    ].filter(item => item.url);

    await Promise.all(urls.map(async ({ label, url }) => {
      const ok = await this.checkUrl(url, run);
      if (run.cancelled || run.generation !== this.manager.tableGeneration || this.linkCheckState !== run) return;
      eventBus.emit("table:link-check-result", { key, label, ok });
      if (!ok) run.bad++;
    }));
    if (run.cancelled || run.generation !== this.manager.tableGeneration) return;
    run.processed++;
    if (run.processed % 5 === 0 || run.processed === run.total) this.updateLinkCheckAlert(run);
  }

  // Try HEAD first, then a bounded media metadata probe when HEAD is inconclusive.
  async checkUrl(url, run) {
    const mediaUrl = rewriteSongMediaHost(url, settingsManager.get("fileHost"));
    const headController = new AbortController();
    const abortHead = () => headController.abort();
    run.controller.signal.addEventListener("abort", abortHead, { once: true });
    const headTimeout = setTimeout(abortHead, 8000);
    try {
      if (run.controller.signal.aborted) return false;
      const response = await fetch(mediaUrl, { method: "HEAD", signal: headController.signal, mode: "cors" });
      if (response.ok) return true;
      if (response.status === 404 || response.status === 410) return false;
    } catch (error) {
      if (run.controller.signal.aborted) return false;
    } finally {
      clearTimeout(headTimeout);
      run.controller.signal.removeEventListener("abort", abortHead);
    }
    if (run.controller.signal.aborted) return false;

    return new Promise(resolve => {
      const media = document.createElement(/\.mp3(\?|$)/i.test(url) ? "audio" : "video");
      let settled = false;
      let timeout;
      const finish = ok => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        run.controller.signal.removeEventListener("abort", onAbort);
        media.removeEventListener("loadedmetadata", onLoaded);
        media.removeEventListener("error", onError);
        media.removeAttribute("src");
        media.load();
        resolve(ok);
      };
      const onAbort = () => finish(false);
      const onLoaded = () => finish(true);
      const onError = () => finish(false);
      run.controller.signal.addEventListener("abort", onAbort, { once: true });
      media.addEventListener("loadedmetadata", onLoaded, { once: true });
      media.addEventListener("error", onError, { once: true });
      timeout = setTimeout(() => finish(false), 8000);
      media.preload = "metadata";
      media.src = mediaUrl;
    });
  }

}
