async function probeMediaUrl(url, signal) {
  const headController = new AbortController();
  const abortHead = () => headController.abort();
  signal.addEventListener("abort", abortHead, { once: true });
  const headTimeout = setTimeout(abortHead, 8000);
  try {
    if (signal.aborted) return false;
    const response = await fetch(url, { method: "HEAD", signal: headController.signal, mode: "cors" });
    if (response.ok) return true;
    if (response.status === 404 || response.status === 410) return false;
  } catch (error) {
    if (signal.aborted) return false;
  } finally {
    clearTimeout(headTimeout);
    signal.removeEventListener("abort", abortHead);
  }
  if (signal.aborted) return false;

  return new Promise(resolve => {
    const media = document.createElement(/\.mp3(\?|$)/i.test(url) ? "audio" : "video");
    let settled = false;
    let timeout;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      media.removeEventListener("loadedmetadata", onLoaded);
      media.removeEventListener("error", onError);
      media.removeAttribute("src");
      media.load();
      resolve(ok);
    };
    const onAbort = () => finish(false);
    const onLoaded = () => finish(true);
    const onError = () => finish(false);
    signal.addEventListener("abort", onAbort, { once: true });
    media.addEventListener("loadedmetadata", onLoaded, { once: true });
    media.addEventListener("error", onError, { once: true });
    timeout = setTimeout(() => finish(false), 8000);
    media.preload = "metadata";
    media.src = url;
  });
}
