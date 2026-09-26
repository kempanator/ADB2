const CLIENT_NAME = "ADB2";
const API_BASE = "https://anisongdb.com";
//const API_BASE = "http://127.0.0.1:8000";
const SETTINGS_KEY = "adb_settings";
const PLAYLIST_STORAGE_KEY = "adb_playlists";

// Column metadata is declared in its default order and shared by the header, settings, and sort selector.
// Cell content stays in RowComponent, where its interactive controls live.
const TableColumns = {
  info:        { label: "Info", visible: true },
  rowNumber:   { label: "#", settingsLabel: "Row Number" },
  annId:       { label: "ANN ID", visible: true, nowrap: true, sort: "number", value: r => r.annId },
  anilistId:   { label: "AniList ID", nowrap: true, sort: "number", value: r => r.linked_ids?.anilist },
  malId:       { label: "MAL ID", nowrap: true, sort: "number", value: r => r.linked_ids?.myanimelist },
  kitsuId:     { label: "Kitsu ID", nowrap: true, sort: "number", value: r => r.linked_ids?.kitsu },
  anidbId:     { label: "AniDB ID", nowrap: true, sort: "number", value: r => r.linked_ids?.anidb },
  anime:       { label: "Anime", visible: true, sort: "text", value: (r, language) => tableAnimeTitle(r, language) },
  animeType:   { label: "Anime Type", nowrap: true, sort: "text", value: r => r.animeType },
  season:      { label: "Season", visible: true, nowrap: true, sort: "season", value: r => r.animeVintage },
  annSongId:   { label: "ANN Song ID", nowrap: true, sort: "number", value: r => r.annSongId },
  amqSongId:   { label: "AMQ Song ID", nowrap: true, sort: "number", value: r => r.amqSongId },
  songType:    { label: "Song Type", visible: true, nowrap: true, sort: "type", value: r => r.songType },
  broadcast:   { label: "Broadcast", nowrap: true, sort: "broadcast", value: r => broadcastText(r) },
  performance: { label: "Performance", nowrap: true, sort: "text", value: r => r.songCategory },
  songName:    { label: "Song Name", visible: true, sort: "text", value: r => r.songName },
  artist:      { label: "Artist", visible: true, sort: "text", value: r => r.songArtist },
  composer:    { label: "Composer", sort: "text", value: r => r.songComposer },
  arranger:    { label: "Arranger", sort: "text", value: r => r.songArranger },
  difficulty:  { label: "Dif.", settingsLabel: "Difficulty", nowrap: true, sort: "number", value: r => r.songDifficulty },
  length:      { label: "Length", nowrap: true, sort: "number", value: r => r.songLength },
  songLinks:   { label: "Song Links", visible: true, nowrap: true },
  action:      { label: "Actions", visible: true, nowrap: true }
};

const DefaultColumnOrder = Object.keys(TableColumns);

function tableAnimeTitle(row, language) {
  return language === "romaji"
    ? (row.animeJPName || row.animeENName || "")
    : (row.animeENName || row.animeJPName || "");
}

const DefaultSettings = {
  theme: "dark",
  radioMode: "none", // none | repeat | loopAll
  fileHost: "nawdist",
  language: "english", // english | romaji
  searchMode: "simple", // simple | advanced
  loadRandomSongsOnStartup: false,
  zebraStripe: true,
  tableFullWidth: false,
  defaultAudioVolume: 100, // 0–100, applied to the audio element when the page loads
  hotkeys: { switchSearchMode: "", downloadJson: "", playPause: "", cycleRadioMode: "", prev: "", next: "" },
  visibleColumns: Object.fromEntries(DefaultColumnOrder.map(key => [key, Boolean(TableColumns[key].visible)])),
  columnOrder: [...DefaultColumnOrder]
};
