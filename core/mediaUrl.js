// Resolve song media paths using the currently selected AMQ file host.
function buildSongMediaUrl(value, fileHost) {
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return rewriteSongMediaHost(value, fileHost);

  const clean = String(value).replace(/^\/+/, "");
  if (clean.includes("..")) return "";

  return `https://${fileHost}.animemusicquiz.com/${encodeURIComponent(clean)}`;
}

function rewriteSongMediaHost(url, fileHost) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".animemusicquiz.com")) {
      const parts = parsed.hostname.split(".");
      parts[0] = fileHost;
      parsed.hostname = parts.join(".");
      return parsed.toString();
    }
  } catch { }
  return url;
}
