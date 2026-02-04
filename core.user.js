(() => {
  "use strict";

  if (window.__HiOrgEnhancerCoreLoaded) return;
  window.__HiOrgEnhancerCoreLoaded = 1;

  const STORAGE_KEY = "hiorgEnhancer.moduleState.v1";

  // ---------------------------------------------------------
  // Registry
  // ---------------------------------------------------------
  const Enh = window.HiOrgEnhancer = window.HiOrgEnhancer || {};
  Enh.version = "2.0.2";
  Enh.modules = Enh.modules || new Map();

  // Module, die NICHT im Menü erscheinen sollen
  // (werden trotzdem normal registriert und ausgeführt)
  const HIDDEN_MODULE_IDS = new Set([
    "loginAutoLogin"
  ]);

  // Module, die IMMER aktiv sind (ignorieren localStorage)
  const ALWAYS_ENABLED_IDS = new Set([
    "loginAutoLogin"
  ]);

  // Gruppen: ein Häkchen schaltet mehrere Module
  // Beispiel: später zwei WhatsApp-Module gemeinsam toggeln
  const MODULE_GROUPS = [
    // {
    //   id: "whatsappAll",
    //   name: "WhatsApp (alle)",
    //   moduleIds: ["dienstWhatsApp", "formulareWhatsApp"],
    //   defaultEnabled: true
    // }
  ];

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
    if (ALWAYS_ENABLED_IDS.has(moduleId)) return true;

    const state = loadState();
    if (Object.prototype.hasOwnProperty.call(state, moduleId)) return !!state[moduleId];

    const m = Enh.modules.get(moduleId);
    return m ? !!m.defaultEnabled : true;
  }

  function setEnabled(moduleId, enabled) {
    if (ALWAYS_ENABLED_IDS.has(moduleId)) return; // ignorieren
    const state = loadState();
    state[moduleId] = !!enabled;
    saveState(state);
  }

  function getGroupEnabled(group) {
    const state = loadState();
    if (Object.prototype.hasOwnProperty.call(state, group.id)) return !!state[group.id];
    return group.defaultEnabled !== false;
  }

  function setGroupEnabled(group, enabled) {
    const state = loadState();
    state[group.id] = !!enabled;
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
  // Ziel: Panel oberhalb der ersten Accordion-Box "HiOrg-Server RKBN"
  const wrap = document.querySelector("#menu_row_00_wrap");
  if (!wrap) return null;

  let panel = document.getElementById("hiorgEnhancerPanel");
  if (panel) return panel;

  const styleId = "hiorgEnhancerStyle";
  if (!document.getElementById(styleId)) {
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = `
#hiorgEnhancerPanel{
  margin: 0 0 8px 0;
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
#hiorgEnhancerPanel .he-sep{ margin: 6px 0; border-top: 1px solid rgba(0,0,0,.10); }
    `;
    document.documentElement.appendChild(st);
  }

  panel = document.createElement("div");
  panel.id = "hiorgEnhancerPanel";

  const title = document.createElement("div");
  title.className = "he-title";
  title.textContent = "HiOrg-Enhancer";
  panel.appendChild(title);

  // WICHTIG: oberhalb von "HiOrg-Server RKBN" einfügen
  wrap.insertAdjacentElement("beforebegin", panel);

  return panel;
}

  function makeRow({ labelText, checked, onChange }) {
    const row = document.createElement("div");
    row.className = "he-row";

    const label = document.createElement("label");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!checked;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = labelText;

    label.appendChild(cb);
    label.appendChild(nameSpan);

    const badge = document.createElement("span");
    badge.className = "he-badge " + (cb.checked ? "" : "he-badge-off");
    badge.textContent = cb.checked ? "aktiv" : "aus";

    cb.addEventListener("change", () => {
      onChange(!!cb.checked);
      location.reload();
    });

    row.appendChild(label);
    row.appendChild(badge);
    return row;
  }

  function renderPanel() {
    const panel = ensurePanelHost();
    if (!panel) return;

    // alles außer Titel entfernen
    [...panel.children].forEach((node, idx) => { if (idx > 0) node.remove(); });

    // 1) Gruppen (optional)
    const groups = MODULE_GROUPS.filter(g => g && g.id && Array.isArray(g.moduleIds) && g.moduleIds.length);
    if (groups.length) {
      for (const g of groups) {
        panel.appendChild(makeRow({
          labelText: g.name,
          checked: getGroupEnabled(g),
          onChange: (enabled) => setGroupEnabled(g, enabled)
        }));
      }

      const sep = document.createElement("div");
      sep.className = "he-sep";
      panel.appendChild(sep);
    }

    // 2) Einzelmodule (ohne hidden)
    const mods = [...Enh.modules.values()]
      .filter(m => !HIDDEN_MODULE_IDS.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    if (mods.length === 0 && groups.length === 0) {
      const hint0 = document.createElement("div");
      hint0.className = "he-hint";
      hint0.textContent = "Keine Module im Menü konfigurierbar.";
      panel.appendChild(hint0);
      return;
    }

    for (const m of mods) {
      panel.appendChild(makeRow({
        labelText: m.name,
        checked: getEnabled(m.id),
        onChange: (enabled) => setEnabled(m.id, enabled)
      }));
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reload";
    btn.style.marginTop = "6px";
    btn.style.width = "100%";
    btn.addEventListener("click", () => hardRefreshFromGithub());
    panel.appendChild(btn);

    const hint = document.createElement("div");
    hint.className = "he-hint";
    hint.textContent = "";
    panel.appendChild(hint);
  }

  function hardRefreshFromGithub() {
  try {
    // 1) Modul-States zurücksetzen
    localStorage.removeItem("hiorgEnhancer.moduleState.v1");
    
    // 2) optionale weitere Keys, falls du später mehr speicherst
    // localStorage.removeItem("hiorgEnhancer.someOtherKey");

    // 3) Loader/Core Guards entfernen (für den aktuellen Tab)
    try { delete window.__hiorgEnhancerLoaded; } catch {}
    try { delete window.__HiOrgEnhancerCoreLoaded; } catch {}

    // 4) harte Reload-URL mit Cachebuster (um Browser-Cache/ServiceWorker zu umgehen)
    const u = new URL(location.href);
    u.searchParams.set("he_refresh", String(Date.now()));
    location.href = u.toString();
  } catch {
    // Fallback: normaler Reload
    location.reload();
  }
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

Enh.__started = Enh.__started || false;

Enh.registerModule = function registerModule(def) {
  baseRegisterModule(def);
  renderPanel();

  // NEU: wenn Core schon läuft, direkt dieses Modul starten
  if (Enh.__started && def && def.id) {
    const mod = Enh.modules.get(String(def.id));
    if (mod && shouldRunModule(mod)) {
      try { mod.run(Enh.util); }
      catch (e) { console.warn("[HiOrg-Enhancer] module crashed (late-run):", mod.id, e); }
    }
  }
};

  // Panel früh rendern
  setTimeout(renderPanel, 50);

  // ---------------------------------------------------------
  // Runner
  // ---------------------------------------------------------
  function shouldRunModule(mod) {
    // 1) Gruppenlogik (ein Häkchen schaltet mehrere Module)
    for (const g of MODULE_GROUPS) {
      if (!g || !g.id || !Array.isArray(g.moduleIds)) continue;
      if (g.moduleIds.includes(mod.id)) {
        if (!getGroupEnabled(g)) return false;
        // Wenn Gruppe aktiv ist, entscheidet zusätzlich das Modul selbst (außer ALWAYS_ENABLED)
        break;
      }
    }

    // 2) Einzelstatus
    if (!getEnabled(mod.id)) return false;

    // 3) Seite matchen
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

(async () => {
  await Enh.util.sleep(50);
  Enh.__started = true;   // NEU
  renderPanel();
  runMatchingModules();
})();
})();
