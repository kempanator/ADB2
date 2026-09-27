"use strict";

// Composition root: definitions have no startup side effects. Classic scripts
// deliberately avoid module/fetch loading so opening index.html via file:// works.
document.addEventListener("DOMContentLoaded", () => {
  const ui = initializeControls();
  initializeClipboard();
  const notify = (message, type = "info") => events.emit("ui:show-alert", { message, type });
  const showSongDetails = rowKey => details.show(rowKey);
  const navigateDetails = direction => details.navigate(direction);
  const choosePlaylist = song => playlistSelection.show(song);
  const closePlaylistSelection = () => playlistSelection.hide();
  const showColumnSettings = () => settingsDialog.showColumns();
  const toggleSearchMode = () => searchView.toggleSearchMode();
  const createRowView = (row, key) => new SongRowView(row, 0, key, { playback, playlists, results, search, searchRequests, settings, showSongDetails });

  const events = new EventBus();
  const settings = new SettingsStore({ defaults: DefaultSettings, storageKey: SETTINGS_KEY, events });
  const applyAppearance = () => {
    document.documentElement.setAttribute("data-theme", settings.get("theme"));
    document.documentElement.classList.toggle("table-full-width", settings.get("tableFullWidth"));
  };
  events.on("settings:changed", applyAppearance);
  applyAppearance();
  const api = new AnisongDbClient({ baseUrl: API_BASE, clientName: CLIENT_NAME });
  const searchRequests = new SearchRequestBuilder();
  const songFileFormats = new SongFileFormats();
  const playlistStore = new PlaylistStore({ storageKey: PLAYLIST_STORAGE_KEY });
  const results = new ResultsController({ model: new ResultsModel(settings.get("language")), settings, events, notify });
  const resultsLoader = new ResultsLoader({ api, events, notify, results });
  const search = new SearchController({ api, notify, resultsLoader, searchRequests });
  const playlists = new PlaylistController({ api, choosePlaylist, closePlaylistSelection, events, notify, playlistStore, results, resultsLoader });
  const files = new FileController({ notify, playlists, results, settings, songFileFormats });
  const refresher = new RefreshResults({ api, events, notify, results });
  const linkChecker = new CheckMediaLinks({ events, notify, results, settings });
  const playback = new PlaybackController({ events, results, settings });
  const shortcuts = new KeyboardShortcuts({ files, navigateDetails, playback, settings, toggleSearchMode });
  const details = new SongDetailsDialog({ events, playback, playlists, results, search, searchRequests, settings, ui });
  const playlistSelection = new PlaylistSelectionDialog({ notify, playlistStore, playlists, results, ui });
  new PlaylistsDialog({ events, notify, playlistStore, playlists, results, ui });
  const settingsDialog = new SettingsDialog({ events, files, notify, playlists, settings, shortcuts, ui });
  new StatisticsDialog({ results, settings, search, searchRequests, ui });
  new AlertView({ events });
  const searchView = new SearchView({ events, results, search, settings });
  const resultsToolbar = new ResultsToolbar({ events, files, linkChecker, refresher, results, settings, showColumnSettings });
  const playerView = new PlayerView({ events, playback, settings, showSongDetails });
  new ResultsView({ createRowView, events, results, settings });

  Chart.defaults.animation = false;
  shortcuts.initialize();
  playback.applyDefaultVolumeFromSettings();
  settingsDialog.applyToUI();
  searchView.applySearchModeUI(settings.get("searchMode"));
  resultsToolbar.renderQuickColumns();
  results.publishChange();
  playerView.render();
  if (settings.get("loadRandomSongsOnStartup")) search.loadStartupRandomSongs();
});
