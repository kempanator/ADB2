// The latest table load owns cancellation and the right to replace or append rows.
class TableRequestManager {
  constructor() {
    this.request = null;
    this.isLoading = false;
    eventBus.on("table:changed", () => this.cancel());
  }

  setLoading(loading) {
    if (this.isLoading === Boolean(loading)) return;
    this.isLoading = Boolean(loading);
    eventBus.emit("table:request-state-changed", { loading: this.isLoading });
  }

  run(load, isAppend, { transform = rows => rows, onSuccess } = {}) {
    this.cancel();
    tableManager.bumpTableGeneration();
    const request = { controller: new AbortController() };
    this.request = request;
    this.setLoading(true);
    Promise.resolve().then(() => load(request.controller.signal))
      .then(result => {
        if (this.request !== request) return;
        const rows = transform(Array.isArray(result) ? result : []);
        this.request = null;
        this.setLoading(false);
        if (isAppend) tableManager.appendData(rows);
        else tableManager.loadData(rows);
        onSuccess?.(rows);
      })
      .catch(error => {
        if (this.request !== request) return;
        this.request = null;
        this.setLoading(false);
        if (error?.name === "AbortError") return;
        const detail = apiClient.formatErrorDetail(error?.response) ?? error?.message ?? String(error);
        console.error("Fetch error:", error);
        showAlert(`Request failed: ${detail}`, "danger");
      });
  }

  cancel() {
    if (!this.request) return;
    this.request.controller.abort();
    this.request = null;
    this.setLoading(false);
  }
}

const tableRequestManager = new TableRequestManager();
