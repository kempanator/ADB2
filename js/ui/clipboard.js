function initializeClipboard() {
  let copyToastTimer;
  function showCopyToast(message, point) {
    let toast = document.querySelector("#copy-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "copy-toast";
      toast.className = "copy-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    clearTimeout(copyToastTimer);
    toast.textContent = message;
    const gap = 12;
    const x = Math.max(8, Math.min(point.x + gap, window.innerWidth - toast.offsetWidth - 8));
    const below = point.y + gap;
    const y = below + toast.offsetHeight <= window.innerHeight - 8
      ? below : point.y - toast.offsetHeight - gap;
    toast.style.left = `${x}px`;
    toast.style.top = `${Math.max(8, y)}px`;
    toast.classList.add("show");
    copyToastTimer = setTimeout(() => toast.classList.remove("show"), 700);
  }

  async function copyValue(value, point) {
    const text = String(value ?? "");
    if (!text) return;
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch { /* file:// can need the selection fallback. */ }
    }
    if (!copied) {
      const previousFocus = document.activeElement;
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.append(input);
      input.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      input.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
    }
    showCopyToast(copied ? "Copied" : "Copy failed", point);
  }

  document.addEventListener("click", event => {
    const target = event.target.closest?.("[data-copy]");
    if (!target || event.target.closest("a, button, .song-info-search-link")) return;
    copyValue(target.dataset.copy, { x: event.clientX, y: event.clientY });
  });
  document.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key) || !event.target.matches?.("[data-copy]")) return;
    event.preventDefault();
    const rect = event.target.getBoundingClientRect();
    copyValue(event.target.dataset.copy, { x: rect.left + rect.width / 2, y: rect.bottom });
  });
}
