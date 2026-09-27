// Each row key identifies an occurrence, so repeated ANN song IDs are allowed.
class ResultsModel {
  static SeasonOrder = ["Winter", "Spring", "Summer", "Fall"];

  constructor(language = "english") {
    this.rows = new Map();
    this.keysByRow = new WeakMap();
    this.rowKeys = [];
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
      this.rowKeys.push(key);
      keys.push(key);
    }
    this.sort = { column: null, dir: null };
    return keys;
  }

  replace(rows) {
    this.rows.clear();
    this.rowKeys = [];
    this.keysByRow = new WeakMap();
    return this.add(rows);
  }

  clear() {
    this.rows.clear();
    this.rowKeys = [];
    this.keysByRow = new WeakMap();
    this.sort = { column: null, dir: null };
  }

  getRow(key) {
    return this.rows.get(key) || null;
  }

  getKey(row) {
    return this.keysByRow.get(row);
  }

  getRows() {
    return this.rowKeys.map(key => this.rows.get(key));
  }

  getDisplayData() {
    return this.getDisplayKeys().map(key => this.rows.get(key));
  }

  getDisplayKeys() {
    const keys = [...this.rowKeys];
    const { column, dir } = this.sort;
    if (!ResultColumns[column]?.sort || !["asc", "desc"].includes(dir)) return keys;
    const position = new Map(keys.map((key, index) => [key, index]));
    keys.sort((a, b) => this.compare(column, this.rows.get(a), this.rows.get(b), dir)
      || position.get(a) - position.get(b));
    return keys;
  }

  toggleSort(column) {
    if (!ResultColumns[column]?.sort) return false;
    const dir = this.sort.column === column && this.sort.dir === "asc" ? "desc" : "asc";
    this.sort = { column, dir };
    return true;
  }

  remove(key) {
    const index = this.rowKeys.indexOf(key);
    if (index < 0) return false;
    this.rowKeys.splice(index, 1);
    this.keysByRow.delete(this.rows.get(key));
    this.rows.delete(key);
    return true;
  }

  removeWhere(predicate) {
    const removed = [];
    this.rowKeys = this.rowKeys.filter(key => {
      if (!predicate(this.rows.get(key))) return true;
      removed.push(key);
      this.keysByRow.delete(this.rows.get(key));
      this.rows.delete(key);
      return false;
    });
    return removed;
  }

  reorder(order) {
    const visible = new Set(this.rowKeys);
    const next = [];
    for (const key of order) {
      if (!visible.delete(key)) continue;
      next.push(key);
    }
    next.push(...this.rowKeys.filter(key => visible.has(key)));
    this.rowKeys = next;
    this.sort = { column: null, dir: null };
  }

  reverse() {
    this.rowKeys = this.getDisplayKeys().reverse();
    this.sort = { column: null, dir: null };
  }

  shuffle() {
    const keys = this.getDisplayKeys();
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    this.rowKeys = keys;
    this.sort = { column: null, dir: null };
  }

  compare(column, a, b, direction) {
    const definition = ResultColumns[column];
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
      result = this.compareValues(songAnimeTitle(a, this.language), songAnimeTitle(b, this.language));
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
    const { rank, number } = parseSongType(value);
    return [rank, number];
  }

  seasonOrder(value) {
    const match = /^(winter|spring|summer|fall)\s*(\d{4})$/i.exec(String(value ?? "").trim());
    if (!match) return -1;
    const season = ResultsModel.SeasonOrder.findIndex(item => item.toLowerCase() === match[1].toLowerCase());
    return Number(match[2]) * 4 + season;
  }

  broadcastOrder(row) {
    return Number(Boolean(row.isDub)) + 2 * Number(Boolean(row.isRebroadcast));
  }
}
