(() => {
  "use strict";

  if (window.__HiOrgEnhancerCoreLoaded) return;
  window.__HiOrgEnhancerCoreLoaded = 1;

  const STORAGE_KEY = "hiorgEnhancer.moduleState.v1";

  // ---------------------------------------------------------
  // Registry
  // ---------------------------------------------------------
  const Enh = window.HiOrgEnhancer = window.HiOrgEnhancer || {};
  Enh.version = "2.0.1";
  Enh.modules = Enh.modules || new Map();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : {};
    } catch {
      return {};
    }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {})); } catch {}
  }

  function getEnabled(moduleId) {
    const state = loadState();
    if (Object.prototype.hasOwnProperty.call(state, moduleId)) return !!state[moduleId];
    const m = Enh.modules.get(moduleId);
    return m ? !!m.defaultEnabled : true;
  }

  function setEnabled(moduleId, enabled) {
    const state = loadState();
    state[moduleId] = !!enabled;
    saveState(state);
  }

  // ---------------------------------------------------------
  // Shared Helpers (für Module)
  // ---------------------------------------------------------
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function waitFor(selector, { timeoutMs = 15000, intervalMs = 100 } = {}) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(intervalMs);
    }
    return null;
  }

  function norm(s) {
    return (s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  Enh.util = Enh.util || {};
  Enh.util.sleep = sleep;
  Enh.util.waitFor = waitFor;
  Enh.util.norm = norm;

  // ---------------------------------------------------------
  // UI (ein Panel, immer re-renderbar)
  // ---------------------------------------------------------
  function ensurePanelHost() {
    const box = document.querySelector("#menu_row_00");
    if (!box) return null;

    let panel = document.getElementById("hiorgEnhancerPanel");
    if (panel) return panel;

    const styleId = "hiorgEnhancerStyle";
    if (!document.getElementById(styleId)) {
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = `
#hiorgEnhancerPanel{
  margin: 10px 0 6px 0;
  padding: 8px 8px 6px 8px;
  border: 1px solid rgba(0,0,0,.10);
  border-radius: 6px;
  background: rgba(0,0,0,.02);
  font-size: 12px;
}
#hiorgEnhancerPanel .he-title{ font-weight: 600; margin: 0 0 6px 0; }
#hiorgEnhancerPanel .he-row{
  display:flex; align-items:center; justify-content:space-between;
  gap:8px; padding:3px 0;
}
#hiorgEnhancerPanel .he-row label{ display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
#hiorgEnhancerPanel .he-row input[type="checkbox"]{ transform: scale(1.05); }
#hiorgEnhancerPanel .he-badge{
  display:inline-block; padding:1px 6px; border-radius:999px;
  border:1px solid rgba(0,0,0,.12); opacity:.85;
}
#hiorgEnhancerPanel .he-badge-off{ opacity:.55; }
#hiorgEnhancerPanel .he-hint{ margin-top:6px; opacity:.75; }
      `;
      document.documentElement.appendChild(st);
    }

    panel = document.createElement("div");
    panel.id = "hiorgEnhancerPanel";

    const title = document.createElement("div");
    title.className = "he-title";
    title.textContent = "HiOrg-Enhancer";
    panel.appendChild(title);

    const firstUl = box.querySelector("ul");
    if (firstUl) firstUl.insertAdjacentElement("beforebegin", panel);
    else box.appendChild(panel);

    return panel;
  }

  function renderPanel() {
    const panel = ensurePanelHost();
    if (!panel) return;

    // alles außer Titel entfernen
    [...panel.children].forEach((node, idx) => { if (idx > 0) node.remove(); });

    const mods = [...Enh.modules.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));

    if (mods.length === 0) {
      const hint0 = document.createElement("div");
      hint0.className = "he-hint";
      hint0.textContent = "Keine Module registriert.";
      panel.appendChild(hint0);
      return;
    }

    for (const m of mods) {
      const row = document.createElement("div");
      row.className = "he-row";

      const label = document.createElement("label");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = getEnabled(m.id);

      const nameSpan = document.createElement("span");
      nameSpan.textContent = m.name;

      label.appendChild(cb);
      label.appendChild(nameSpan);

      const badge = document.createElement("span");
      badge.className = "he-badge " + (cb.checked ? "" : "he-badge-off");
      badge.textContent = cb.checked ? "aktiv" : "aus";

      cb.addEventListener("change", () => {
        setEnabled(m.id, cb.checked);
        location.reload();
      });

      row.appendChild(label);
      row.appendChild(badge);
      panel.appendChild(row);
    }

    const hint = document.createElement("div");
    hint.className = "he-hint";
    hint.textContent = "";
    panel.appendChild(hint);
  }

  // ---------------------------------------------------------
  // Register (mit UI-Refresh)
  // ---------------------------------------------------------
  function baseRegisterModule(def) {
    if (!def || !def.id || typeof def.run !== "function") return;
    if (Enh.modules.has(def.id)) return;
    Enh.modules.set(def.id, {
      id: String(def.id),
      name: String(def.name || def.id),
      defaultEnabled: def.defaultEnabled !== false,
      pages: Array.isArray(def.pages) ? def.pages.map(String) : null,
      match: typeof def.match === "function" ? def.match : null,
      run: def.run
    });
  }

  Enh.registerModule = function registerModule(def) {
    baseRegisterModule(def);
    renderPanel(); // <- wichtig: nach jeder Registrierung UI aktualisieren
  };

  // Panel früh anlegen (Titel/Hint kommt später ohnehin per renderPanel)
  setTimeout(renderPanel, 50);

  // ---------------------------------------------------------
  // Runner
  // ---------------------------------------------------------
  function shouldRunModule(mod) {
    if (!getEnabled(mod.id)) return false;
    if (mod.match) return !!mod.match(location);
    if (mod.pages && mod.pages.length) return mod.pages.includes(String(location.pathname || ""));
    return true;
  }

  function runMatchingModules() {
    for (const mod of Enh.modules.values()) {
      if (!shouldRunModule(mod)) continue;
      try { mod.run(Enh.util); }
      catch (e) { console.warn("[HiOrg-Enhancer] module crashed:", mod.id, e); }
    }
  }

  // Start
  (async () => {
    await Enh.util.sleep(50);
    renderPanel();       // UI befüllen (falls Module schon da sind)
    runMatchingModules();
  })();
})();
