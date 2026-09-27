// The latest table load owns cancellation and the right to replace or append rows.
class ResultsLoader {
  constructor({ api, events, notify, results }) {
    Object.assign(this, { api, events, notify, results });
    this.request = null;
    this.isLoading = false;
    this.events.on("results:invalidated", () => this.cancel());
  }

  setLoading(loading) {
    if (this.isLoading === Boolean(loading)) return;
    this.isLoading = Boolean(loading);
    this.events.emit("results:loading-changed", { loading: this.isLoading });
  }

  async run(load, isAppend, { transform = rows => rows, onSuccess } = {}) {
    this.cancel();
    this.results.invalidatePendingWork();
    const request = { controller: new AbortController() };
    this.request = request;
    this.setLoading(true);
    let rows;
    try {
      const result = await load(request.controller.signal);
      if (this.request !== request) return;
      rows = transform(result);
    } catch (error) {
      if (this.request !== request) return;
      this.request = null;
      this.setLoading(false);
      if (error?.name !== "AbortError") this.reportError(error);
      return;
    }

    // Committing rows invalidates pending work, so release the request first.
    this.request = null;
    this.setLoading(false);
    try {
      if (isAppend) this.results.appendData(rows);
      else this.results.loadData(rows);
      onSuccess?.(rows);
    } catch (error) {
      this.reportError(error);
    }
  }

  reportError(error) {
    const detail = this.api.formatErrorDetail(error?.response) ?? error?.message ?? String(error);
    console.error("Request failed:", error);
    this.notify(`Request failed: ${detail}`, "danger");
  }

  cancel() {
    if (!this.request) return;
    this.request.controller.abort();
    this.request = null;
    this.setLoading(false);
  }
}
