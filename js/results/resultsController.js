class ResultsController {
  constructor({ model, settings, events, notify }) {
    Object.assign(this, { model, settings, events, notify });
    this.revision = 0;
    this.resultMode = "new";
    this.events.on("settings:language-changed", () => {
      this.model.setLanguage(this.settings.get("language"));
      this.publishChange();
    });
  }

  // Invalidates pending loads/tasks; does not claim that rows have changed.
  invalidatePendingWork() {
    this.revision++;
    this.events.emit("results:invalidated");
  }

  publishChange() {
    this.events.emit("results:changed", this.model.getDisplayKeys());
  }

  sort(column) {
    if (!ResultColumns[column]?.sort) return;
    this.invalidatePendingWork();
    this.model.toggleSort(column);
    this.publishChange();
  }

  reorder(order) {
    this.invalidatePendingWork();
    this.model.reorder(order);
    this.publishChange();
  }

  moveRow({ key, direction }) {
    const order = this.model.getDisplayKeys();
    const index = order.indexOf(key);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    this.reorder(order);
  }

  loadData(data) {
    this.invalidatePendingWork();
    this.model.replace(data);
    this.publishChange();
  }

  appendData(data) {
    this.invalidatePendingWork();
    this.model.add(data);
    this.publishChange();
  }

  clearData() {
    this.invalidatePendingWork();
    this.model.clear();
    this.publishChange();
  }

  applyClientFilter(payload) {
    const matches = createSongMatcher(payload, this.settings.get("language"));
    const removeMatches = String(payload.action || "keep").toLowerCase() === "remove";
    const shouldRemove = row => matches(row) === removeMatches;
    if (!this.model.getRows().some(shouldRemove)) return;
    this.invalidatePendingWork();
    this.model.removeWhere(shouldRemove);
    this.publishChange();
  }

  shuffle() {
    this.invalidatePendingWork();
    this.model.shuffle();
    this.publishChange();
  }

  reverse() {
    this.invalidatePendingWork();
    this.model.reverse();
    this.publishChange();
  }

  removeRow(key) {
    if (!this.model.getRow(key)) return;
    this.invalidatePendingWork();
    this.model.remove(key);
    this.publishChange();
  }

  getKeyForRow(row) {
    return this.model.getKey(row);
  }

  getAnimeTitle(row) {
    return songAnimeTitle(row, this.settings.get("language"));
  }

  checkSongIds() {
    const visible = this.model.getRows();
    const total = visible.length;
    const idToKeys = new Map();
    let missing = 0;

    visible.forEach(row => {
      const id = row.annSongId;
      if (id == null || id === "") { missing++; return; }
      const k = String(id);
      const arr = idToKeys.get(k) || [];
      arr.push(this.getKeyForRow(row));
      idToKeys.set(k, arr);
    });

    const duplicateKeys = [];
    let duplicateBuckets = 0;
    idToKeys.forEach(keys => {
      if (keys.length > 1) {
        duplicateBuckets++;
        duplicateKeys.push(...keys);
      }
    });
    this.events.emit("results:duplicate-ids-checked", { keys: duplicateKeys });

    const uniqueCount = idToKeys.size;
    const msg = `ANN Song IDs — Unique: ${uniqueCount}, Duplicates: ${duplicateBuckets}, Missing: ${missing}`;
    const allGood = duplicateBuckets === 0 && missing === 0 && uniqueCount === total;
    this.notify(msg, allGood ? "success" : "warning");
  }
}
