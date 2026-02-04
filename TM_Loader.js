// ==UserScript==
// @name         HiOrg-Enhancer Loader
// @namespace    https://github.com/tim-kranz/HiOrg-Enhancer
// @version      1.1.0
// @match        https://www.hiorg-server.de/*
// @match        https://hiorg-server.de/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      fastly.jsdelivr.net
// ==/UserScript==

(async () => {
  if (window.__hiorgEnhancerLoaded) return;
  window.__hiorgEnhancerLoaded = 1;

  const urlCb = new URLSearchParams(location.search).get("he_refresh");
  const cb = urlCb ? Number(urlCb) : Math.floor(Date.now() / 6e5);
  const baseMainRaw = "https://raw.githubusercontent.com/tim-kranz/HiOrg-Enhancer/main";
  const baseMainCdn = "https://cdn.jsdelivr.net/gh/tim-kranz/HiOrg-Enhancer@7e1a773";

  // Manifest enthält Reihenfolge + Dateinamen (core zuerst)
  const manifestPaths = [
    `${baseMainRaw}/manifest.json?_=${cb}`,
    `${baseMainCdn}/manifest.json?_=${cb}`,
  ];

  const get = (url) => new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url,
      responseType: "text",
      timeout: 15000,
      onload: (r) => {
        const text = (typeof r.responseText === "string" && r.responseText.length)
          ? r.responseText
          : (r.response || "");
        if (r.status >= 200 && r.status < 300 && text) return resolve(text);
        reject(new Error(`HTTP ${r.status} (${url}) len=${String(text).length}`));
      },
      onerror: () => reject(new Error(`onerror (${url})`)),
      ontimeout: () => reject(new Error(`timeout (${url})`)),
    });
  });

  const stripHeader = (s) =>
    String(s || "").replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/m, "");

  async function loadJson(url) {
    const txt = await get(url);
    try { return JSON.parse(txt); }
    catch (e) { throw new Error(`manifest JSON parse failed (${url}): ${e && e.message ? e.message : e}`); }
  }

  async function fetchTextWithFallback(urls) {
    let lastErr = null;
    for (const u of urls) {
      try { return { url: u, text: await get(u) }; }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("all sources failed");
  }

  // 1) Manifest laden
  let manifest = null;
  let manifestUrl = null;
  try {
    for (const u of manifestPaths) {
      try {
        manifest = await loadJson(u);
        manifestUrl = u;
        break;
      } catch {}
    }
  } catch {}

  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    console.error("[HiOrg-Enhancer] Loader failed: manifest missing/invalid.");
    return;
  }

  // 2) Dateien laden (Reihenfolge aus Manifest)
  // Manifest-Dateien sind relativ zum Repo-Root.
  const toCandidates = (relPath) => ([
    `${baseMainRaw}/${relPath}?_=${cb}`,
    `${baseMainCdn}/${relPath}?_=${cb}`,
  ]);

  for (const rel of manifest.files) {
    const candidates = toCandidates(rel);
    try {
      const { url, text } = await fetchTextWithFallback(candidates);
      const cleaned = stripHeader(text) + `\n//# sourceURL=${url}`;
      Function(cleaned)();
      console.info("[HiOrg-Enhancer] loaded:", rel, "from", url);
    } catch (e) {
      console.error("[HiOrg-Enhancer] file load failed:", rel, e && e.message ? e.message : e);
      return;
    }
  }

  console.info("[HiOrg-Enhancer] all files loaded via manifest:", manifestUrl || "(unknown)");
})();
