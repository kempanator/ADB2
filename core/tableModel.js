// The table's data and ordering live here. DOM rows are disposable views of keys.
class TableModel {
  static SeasonOrder = ["Winter", "Spring", "Summer", "Fall"];

  constructor(language = "english") {
    this.rows = new Map();
    this.keysByRow = new WeakMap();
    this.visibleKeys = [];
    this.nextKey = 1;
    this.sort = { column: null, dir: null };
    this.language = language;
  }

  setLanguage(language) {
    this.language = language;
  }

  add(rows) {
    const keys = [];
    for (const value of Array.isArray(rows) ? rows : []) {
      const row = normalizeSongRow(value);
      if (!row) continue;
      const key = String(this.nextKey++);
      this.rows.set(key, row);
      this.keysByRow.set(row, key);
      this.visibleKeys.push(key);
      keys.push(key);
    }
    this.sort = { column: null, dir: null };
    return keys;
  }

  replace(rows) {
    this.rows.clear();
    this.visibleKeys = [];
    this.keysByRow = new WeakMap();
    return this.add(rows);
  }

  clear() {
    this.rows.clear();
    this.visibleKeys = [];
    this.keysByRow = new WeakMap();
    this.sort = { column: null, dir: null };
  }

  getRow(key) {
    return this.rows.get(key) || null;
  }

  getKey(row) {
    return this.keysByRow.get(row);
  }

  getVisibleData() {
    return this.visibleKeys.map(key => this.rows.get(key));
  }

  getDisplayData() {
    return this.getDisplayKeys().map(key => this.rows.get(key));
  }

  getDisplayKeys() {
    const keys = [...this.visibleKeys];
    const { column, dir } = this.sort;
    if (!TableColumns[column]?.sort || !["asc", "desc"].includes(dir)) return keys;
    const position = new Map(keys.map((key, index) => [key, index]));
    keys.sort((a, b) => this.compare(column, this.rows.get(a), this.rows.get(b), dir)
      || position.get(a) - position.get(b));
    return keys;
  }

  toggleSort(column) {
    if (!TableColumns[column]?.sort) return false;
    const dir = this.sort.column === column && this.sort.dir === "asc" ? "desc" : "asc";
    this.sort = { column, dir };
    return true;
  }

  remove(key) {
    const index = this.visibleKeys.indexOf(key);
    if (index < 0) return false;
    this.visibleKeys.splice(index, 1);
    return true;
  }

  removeWhere(predicate) {
    const removed = [];
    this.visibleKeys = this.visibleKeys.filter(key => {
      if (!predicate(this.rows.get(key))) return true;
      removed.push(key);
      return false;
    });
    return removed;
  }

  reorder(order) {
    const visible = new Set(this.visibleKeys);
    const next = [];
    for (const key of order) {
      if (!visible.delete(key)) continue;
      next.push(key);
    }
    next.push(...this.visibleKeys.filter(key => visible.has(key)));
    this.visibleKeys = next;
    this.sort = { column: null, dir: null };
  }

  reverse() {
    this.visibleKeys = this.getDisplayKeys().reverse();
    this.sort = { column: null, dir: null };
  }

  shuffle() {
    const keys = this.getDisplayKeys();
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    this.visibleKeys = keys;
    this.sort = { column: null, dir: null };
  }

  compare(column, a, b, direction) {
    const definition = TableColumns[column];
    let result;
    if (definition.sort === "type") {
      result = this.compareSongTypes(a.songType, b.songType);
    } else if (definition.sort === "season") {
      result = this.compareValues(this.seasonOrder(a.animeVintage), this.seasonOrder(b.animeVintage));
    } else if (definition.sort === "broadcast") {
      result = this.compareValues(this.broadcastOrder(a), this.broadcastOrder(b));
    } else {
      result = this.compareValues(definition.value(a, this.language), definition.value(b, this.language));
    }

    if (!result && column === "season") {
      result = this.compareValues(tableAnimeTitle(a, this.language), tableAnimeTitle(b, this.language));
    }
    if (!result && (column === "season" || column === "anime")) {
      result = this.compareSongTypes(a.songType, b.songType);
    }
    if (!result && ["artist", "composer", "arranger"].includes(column)) {
      result = this.compareValues(a.songName, b.songName);
    }

    // Every sortable column ends with the same deterministic tie-break chain.
    result ||= this.compareValues(a.annId, b.annId)
      || this.compareSongTypes(a.songType, b.songType)
      || this.compareValues(a.annSongId, b.annSongId);
    return direction === "desc" ? -result : result;
  }

  compareValues(left, right) {
    if (left === right) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "number" && typeof right === "number") return left < right ? -1 : 1;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  }

  compareSongTypes(left, right) {
    const [leftGroup, leftNumber] = this.songTypeOrder(left);
    const [rightGroup, rightNumber] = this.songTypeOrder(right);
    return leftGroup - rightGroup || leftNumber - rightNumber;
  }

  songTypeOrder(value) {
    const type = String(value ?? "").trim();
    const numbered = /^(opening|op|ending|ed)(?:\s+song)?\s*(\d+)?$/i.exec(type);
    if (numbered) {
      return [/^(opening|op)$/i.test(numbered[1]) ? 0 : 1, Number(numbered[2] ?? 0)];
    }
    return /^(insert|in)(?:\s+song)?$/i.test(type) ? [2, 0] : [3, 0];
  }

  seasonOrder(value) {
    const match = /^(winter|spring|summer|fall)\s*(\d{4})$/i.exec(String(value ?? "").trim());
    if (!match) return -1;
    const season = TableModel.SeasonOrder.findIndex(item => item.toLowerCase() === match[1].toLowerCase());
    return Number(match[2]) * 4 + season;
  }

  broadcastOrder(row) {
    return Number(Boolean(row.isDub)) + 2 * Number(Boolean(row.isRebroadcast));
  }
}
