// Small shared UI state. Settings and playlists persist in their own managers;
// TableModel owns song data and ordering.
class AppState {
  constructor() {
    this.state = {
      ui: { resultMode: "new" },
      audio: { currentSongId: null }
    };
    this.listeners = new Map();
  }

  getStateSlice(path) {
    return path.split(".").reduce((value, key) => value?.[key], this.state);
  }

  updateStateSlice(path, updater) {
    const parts = path.split(".");
    const previous = this.getStateSlice(path);
    const next = updater(previous);
    if (Object.is(previous, next)) return;
    let source = this.state;
    const root = { ...source };
    let target = root;
    for (let i = 0; i < parts.length - 1; i++) {
      source = source[parts[i]];
      target = target[parts[i]] = { ...source };
    }
    target[parts.at(-1)] = next;
    this.state = root;
    this.listeners.get(path)?.forEach(listener => listener(next));
  }

  subscribeToSlice(path, listener) {
    const listeners = this.listeners.get(path) || new Set();
    listeners.add(listener);
    this.listeners.set(path, listeners);
    return () => listeners.delete(listener);
  }
}

const appState = new AppState();
