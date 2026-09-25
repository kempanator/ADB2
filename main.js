"use strict";

// =====================
// Global Helper Functions
// =====================
// Simple alert function that emits events
function showAlert(message, type = "info") {
  eventBus.emit("ui:show-alert", { message, type });
}

// Escape HTML special characters to prevent XSS attacks
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// Format duration in seconds to MM:SS display format
function formatDurationSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.floor(n / 60);
  const s = Math.round(n - m * 60);
  const ss = String(s).padStart(2, "0");
  return `${m}:${ss}`;
}

// Get broadcast type string based on dub and rebroadcast flags
function broadcastText(d) {
  if (d.isDub && d.isRebroadcast) return "Dub/Rebroadcast";
  if (d.isDub) return "Dub";
  if (d.isRebroadcast) return "Rebroadcast";
  return "Normal";
}

// =======================
// Initialize on DOM ready
// =======================
document.addEventListener("DOMContentLoaded", function () {
  // Apply default volume from current settings
  audioPlayer.applyDefaultVolumeFromSettings();

  // Apply initial UI from current settings
  settingsModal.applyToUI();

  // Apply initial search mode UI
  toolbar.applySearchModeUI(settingsManager.get("searchMode"));
  toolbar.renderQuickColumns();

  // Initialize hotkeyManager, must happen after settingsManager loads
  hotkeyManager.initialize();

  // Keep chart updates synchronous with the rest of the UI.
  Chart.defaults.animation = false;

  // Initialize column order and visibility after table is ready
  tableManager.table.applyColumnOrder();
  tableManager.table.applyColumnVisibility();

  if (settingsManager.get("loadRandomSongsOnStartup")) {
    searchManager.loadStartupRandomSongs();
  }
});
