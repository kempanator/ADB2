const DefaultSettings = {
  theme: "dark",
  radioMode: "none", // none | repeat | loopAll
  fileHost: "nawdist", // nawdist | naedist | eudist
  language: "english", // english | romaji
  searchMode: "simple", // simple | advanced
  loadRandomSongsOnStartup: false,
  zebraStripe: true,
  tableFullWidth: false,
  defaultAudioVolume: 100, // 0–100, applied to the audio element when the page loads
  hotkeys: { switchSearchMode: "", downloadJson: "", playPause: "", cycleRadioMode: "", prev: "", next: "" },
  visibleColumns: Object.fromEntries(DefaultColumnOrder.map(key => [key, Boolean(ResultColumns[key].visible)])),
  columnOrder: [...DefaultColumnOrder]
};
