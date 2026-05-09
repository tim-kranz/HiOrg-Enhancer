(() => {
  "use strict";

  const MOD_ID = "dienstGantt";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Dienst-Gantt",
    defaultEnabled: true,
    match: (loc) => loc && (
      loc.pathname === "/einteilung_dienst.php"
      || loc.pathname === "/einteilung_dienst_positionen.php"
      || loc.pathname === "/einteilung_termin.php"
    ),
    run: ({ norm }) => {
      const CHART_ID = "hiorg-dienst-gantt";
      const STYLE_ID = "hiorg-dienst-gantt-style";
      const QUALIFIED_RE = /^(san|rs|ra|nfs|notsan|rettsan|rettass)$/i;
      const LISTS = [
        { selector: "#et_posbox_fest, #eingeteilte-personen", status: "fest", title: "Eingeteilt" },
        { selector: "#et_posbox_meld, #gemeldete-personen", status: "gemeldet", title: "Gemeldet" }
      ];

      if (window.__HiOrgDienstGanttRunning) return;
      window.__HiOrgDienstGanttRunning = true;

      ensureStyle();
      render();
      attachLiveUpdates();

      function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
#${CHART_ID}{
  box-sizing:border-box;
  max-width:1160px;
  margin:20px 0 18px 0;
  padding:14px 16px 16px 16px;
  border:1px solid #cfd7df;
  border-radius:10px;
  background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  color:#1f2933;
  font-size:14px;
}
#${CHART_ID} *{ box-sizing:border-box; }
#${CHART_ID} .hg-head{ display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:12px; }
#${CHART_ID} .hg-title{ margin:0; font-size:18px; line-height:1.25; font-weight:700; color:#123d5f; }
#${CHART_ID} .hg-summary{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
#${CHART_ID} .hg-pill{ display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:999px; border:1px solid #d6dde5; background:#f7fafc; font-weight:600; }
#${CHART_ID} .hg-pill-ok{ color:#116329; background:#ebf8ef; border-color:#b7e4c4; }
#${CHART_ID} .hg-pill-warn{ color:#8a4b00; background:#fff5df; border-color:#ffd48a; }
#${CHART_ID} .hg-pill-bad{ color:#8a1111; background:#fff0f0; border-color:#f5b5b5; }
#${CHART_ID} .hg-legend{ display:flex; flex-wrap:wrap; gap:10px; margin:8px 0 12px 0; color:#53616f; font-size:12px; }
#${CHART_ID} .hg-dot{ width:10px; height:10px; border-radius:999px; display:inline-block; margin-right:4px; vertical-align:-1px; }
#${CHART_ID} .hg-dot-fest{ background:#2563eb; }
#${CHART_ID} .hg-dot-meld{ background:#f59e0b; }
#${CHART_ID} .hg-dot-ok{ background:#22c55e; }
#${CHART_ID} .hg-dot-bad{ background:#ef4444; }
#${CHART_ID} .hg-chart{ overflow-x:auto; padding-bottom:2px; }
#${CHART_ID} .hg-grid{ display:grid; grid-template-columns:minmax(190px, 260px) minmax(620px, 1fr); gap:0; min-width:840px; }
#${CHART_ID} .hg-label, #${CHART_ID} .hg-time, #${CHART_ID} .hg-row-label, #${CHART_ID} .hg-row-track{ border-bottom:1px solid #eef2f6; }
#${CHART_ID} .hg-label{ padding:0 10px 8px 0; font-weight:700; color:#53616f; }
#${CHART_ID} .hg-time{ position:relative; height:30px; }
#${CHART_ID} .hg-tick{ position:absolute; top:0; bottom:0; width:1px; background:#dde5ed; }
#${CHART_ID} .hg-tick strong{ position:absolute; top:0; left:4px; transform:translateX(-50%); padding:0 3px; background:#fff; color:#53616f; font-size:12px; font-weight:600; white-space:nowrap; }
#${CHART_ID} .hg-row-label{ min-height:44px; padding:8px 10px 8px 0; }
#${CHART_ID} .hg-name{ font-weight:700; line-height:1.15; }
#${CHART_ID} .hg-meta{ margin-top:3px; color:#66788a; font-size:12px; line-height:1.25; }
#${CHART_ID} .hg-row-track{ position:relative; min-height:44px; padding:9px 0; background:linear-gradient(to right, rgba(221,229,237,.65) 1px, transparent 1px); }
#${CHART_ID} .hg-bar{ position:absolute; top:9px; height:24px; border-radius:7px; overflow:hidden; color:#fff; font-size:12px; line-height:24px; padding:0 8px; white-space:nowrap; text-overflow:ellipsis; box-shadow:inset 0 -1px 0 rgba(0,0,0,.18); }
#${CHART_ID} .hg-bar-fest{ background:#2563eb; }
#${CHART_ID} .hg-bar-gemeldet{ background:#f59e0b; color:#1f2933; }
#${CHART_ID} .hg-bar-u18{ background-image:repeating-linear-gradient(45deg, rgba(255,255,255,.0), rgba(255,255,255,.0) 6px, rgba(255,255,255,.28) 6px, rgba(255,255,255,.28) 12px); }
#${CHART_ID} .hg-coverage-label{ color:#123d5f; font-weight:800; }
#${CHART_ID} .hg-coverage-track{ height:38px; min-height:38px; padding:8px 0; background:#f8fafc; }
#${CHART_ID} .hg-segment{ position:absolute; top:8px; height:22px; line-height:22px; text-align:center; color:#fff; font-size:12px; font-weight:700; border-right:1px solid rgba(255,255,255,.75); }
#${CHART_ID} .hg-segment-ok{ background:#22c55e; }
#${CHART_ID} .hg-segment-bad{ background:#ef4444; }
#${CHART_ID} .hg-empty{ padding:10px; color:#6b7280; background:#f8fafc; border-radius:7px; }
        `;
        document.documentElement.appendChild(style);
      }

      function attachLiveUpdates() {
        const debounced = debounce(render, 250);
        document.addEventListener("input", (ev) => {
          if (ev.target && ev.target.matches("input")) debounced();
        }, true);
        document.addEventListener("change", (ev) => {
          if (ev.target && ev.target.matches("input, select")) debounced();
        }, true);

        const roots = LISTS.map((cfg) => document.querySelector(cfg.selector)).filter(Boolean);
        for (const root of roots) {
          const obs = new MutationObserver(debounced);
          obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
        }
      }

      function render() {
        const dienst = readDienst();
        if (!dienst) return;

        const helpers = readHelpers(dienst);
        const soll = readSollSanitaeter() || 2;
        const coverage = buildCoverage(dienst, helpers, soll);
        const complete = coverage.length > 0 && coverage.every((seg) => seg.count >= soll);

        const chart = ensureChartHost();
        if (!chart) return;

        chart.innerHTML = "";
        chart.appendChild(buildHeader(dienst, helpers, soll, complete));

        if (!helpers.length) {
          const empty = document.createElement("div");
          empty.className = "hg-empty";
          empty.textContent = "Noch keine eingeteilten oder gemeldeten Personen für eine Zeitübersicht gefunden.";
          chart.appendChild(empty);
          return;
        }

        chart.appendChild(buildLegend());
        chart.appendChild(buildChart(dienst, helpers, coverage, soll));
      }

      function ensureChartHost() {
        let chart = document.getElementById(CHART_ID);
        if (chart) return chart;

        chart = document.createElement("section");
        chart.id = CHART_ID;

        const firstList = document.querySelector("#et_posbox_fest, #eingeteilte-personen")
          || [...document.querySelectorAll("fieldset, section, h2")].find((el) => /eingeteilte|helfer/i.test(el.textContent || ""));
        const anchor = firstList || document.querySelector("main")?.firstElementChild || document.body.firstElementChild;
        if (!anchor || !anchor.parentNode) return null;

        anchor.parentNode.insertBefore(chart, anchor);
        return chart;
      }

      function buildHeader(dienst, helpers, soll, complete) {
        const head = document.createElement("div");
        head.className = "hg-head";

        const title = document.createElement("h2");
        title.className = "hg-title";
        title.textContent = `Dienst-Besetzung ${dienst.startLabel} - ${dienst.endLabel} Uhr`;

        const summary = document.createElement("div");
        summary.className = "hg-summary";
        const fest = helpers.filter((h) => h.status === "fest").length;
        const gemeldet = helpers.filter((h) => h.status === "gemeldet").length;
        summary.appendChild(pill(`${helpers.length} Personen (${fest} fest, ${gemeldet} gemeldet)`));
        summary.appendChild(pill(`Soll San/RD: ${soll}`));
        summary.appendChild(pill(complete ? "durchgehend vollständig" : "Lücken vorhanden", complete ? "ok" : "bad"));

        head.appendChild(title);
        head.appendChild(summary);
        return head;
      }

      function buildLegend() {
        const legend = document.createElement("div");
        legend.className = "hg-legend";
        legend.innerHTML = `
<span><i class="hg-dot hg-dot-fest"></i>fest eingeteilt</span>
<span><i class="hg-dot hg-dot-meld"></i>gemeldet</span>
<span><i class="hg-dot hg-dot-ok"></i>Soll erfüllt</span>
<span><i class="hg-dot hg-dot-bad"></i>Unterbesetzt</span>
        `;
        return legend;
      }

      function buildChart(dienst, helpers, coverage, soll) {
        const outer = document.createElement("div");
        outer.className = "hg-chart";
        const grid = document.createElement("div");
        grid.className = "hg-grid";
        grid.style.setProperty("--hg-hours", String(Math.max(1, Math.ceil((dienst.end - dienst.start) / 60))));

        const label = document.createElement("div");
        label.className = "hg-label";
        label.textContent = "Person";
        const time = document.createElement("div");
        time.className = "hg-time";
        for (const tick of buildTicks(dienst)) {
          const t = document.createElement("div");
          t.className = "hg-tick";
          t.style.left = `${percent(dienst, tick.minute)}%`;
          t.innerHTML = `<strong>${tick.label}</strong>`;
          time.appendChild(t);
        }
        grid.appendChild(label);
        grid.appendChild(time);

        const coverageLabel = document.createElement("div");
        coverageLabel.className = "hg-row-label hg-coverage-label";
        coverageLabel.innerHTML = `San/RD-Abdeckung<div class="hg-meta">benötigt: ${soll} gleichzeitig</div>`;
        const coverageTrack = document.createElement("div");
        coverageTrack.className = "hg-row-track hg-coverage-track";
        coverageTrack.style.backgroundSize = `${100 / Math.max(1, Math.ceil((dienst.end - dienst.start) / 60))}% 100%`;
        for (const seg of coverage) {
          const el = document.createElement("div");
          el.className = `hg-segment ${seg.count >= soll ? "hg-segment-ok" : "hg-segment-bad"}`;
          el.style.left = `${percent(dienst, seg.start)}%`;
          el.style.width = `${Math.max(.5, percentWidth(dienst, seg.start, seg.end))}%`;
          el.title = `${minutesToLabel(seg.start)} - ${minutesToLabel(seg.end)} Uhr: ${seg.count}/${soll}`;
          el.textContent = `${seg.count}/${soll}`;
          coverageTrack.appendChild(el);
        }
        grid.appendChild(coverageLabel);
        grid.appendChild(coverageTrack);

        for (const helper of helpers) {
          grid.appendChild(buildHelperLabel(helper));
          grid.appendChild(buildHelperTrack(dienst, helper));
        }

        outer.appendChild(grid);
        return outer;
      }

      function buildHelperLabel(helper) {
        const label = document.createElement("div");
        label.className = "hg-row-label";
        const meta = [helper.status === "gemeldet" ? "gemeldet" : "fest"];
        if (helper.quals.length) meta.push(helper.quals.join(", "));
        if (helper.note) meta.push(helper.note);
        label.innerHTML = `<div class="hg-name"></div><div class="hg-meta"></div>`;
        label.querySelector(".hg-name").textContent = helper.name;
        label.querySelector(".hg-meta").textContent = meta.join(" · ");
        return label;
      }

      function buildHelperTrack(dienst, helper) {
        const track = document.createElement("div");
        track.className = "hg-row-track";
        track.style.backgroundSize = `${100 / Math.max(1, Math.ceil((dienst.end - dienst.start) / 60))}% 100%`;
        const bar = document.createElement("div");
        bar.className = `hg-bar hg-bar-${helper.status}${helper.u18 ? " hg-bar-u18" : ""}`;
        bar.style.left = `${percent(dienst, helper.start)}%`;
        bar.style.width = `${Math.max(.5, percentWidth(dienst, helper.start, helper.end))}%`;
        bar.title = `${helper.name}: ${minutesToLabel(helper.start)} - ${minutesToLabel(helper.end)} Uhr`;
        bar.textContent = `${minutesToLabel(helper.start)}-${minutesToLabel(helper.end)}`;
        track.appendChild(bar);
        return track;
      }

      function readDienst() {
        const candidates = [
          document.querySelector("main")?.innerText,
          document.querySelector("h1")?.innerText,
          document.body?.innerText
        ].filter(Boolean);

        for (const text of candidates) {
          const match = norm(text).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(?:Uhr)?/i);
          if (!match) continue;
          const start = timeToMinutes(match[1]);
          const end = timeToMinutes(match[2]);
          if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            return { start, end, startLabel: minutesToLabel(start), endLabel: minutesToLabel(end) };
          }
        }
        return null;
      }

      function readHelpers(dienst) {
        const helpers = [];
        for (const cfg of LISTS) {
          document.querySelectorAll(cfg.selector).forEach((root) => {
            const items = root.matches("li") ? [root] : [...root.querySelectorAll("li[data-uid], li.helfer, li")];
            for (const li of items) {
              if (li.closest(`#${CHART_ID}`)) continue;
              const helper = readHelper(li, cfg.status, dienst);
              if (helper) helpers.push(helper);
            }
          });
        }
        return helpers.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name, "de"));
      }

      function readHelper(li, status, dienst) {
        if (!li || li.querySelector(`#${CHART_ID}`)) return null;
        const name = readName(li);
        if (!name) return null;
        const times = readHelperTimes(li, dienst);
        const quals = readQuals(li);
        const text = norm(li.innerText || li.textContent || "");
        const note = /unter\s*18|u18/i.test(text) || li.classList.contains("u18") ? "U18" : (/keine passende Position/i.test(text) ? "keine passende Position" : "");
        return {
          name,
          status,
          quals,
          start: times.start,
          end: times.end,
          qualified: quals.some((q) => QUALIFIED_RE.test(q)),
          u18: note === "U18",
          note
        };
      }

      function readName(li) {
        const explicit = li.querySelector(".name, .helfer-name, .username, a[href*='adresse.php']");
        if (explicit) {
          const val = norm(explicit.textContent || "");
          if (looksLikeName(val)) return val;
        }

        const clone = li.cloneNode(true);
        clone.querySelectorAll("input, button, select, textarea, svg, img, .hiorg-wa-btn").forEach((el) => el.remove());
        const lines = (clone.innerText || clone.textContent || "")
          .split(/\n|\s{2,}/)
          .map(norm)
          .filter(Boolean);
        return lines.find(looksLikeName) || "";
      }

      function looksLikeName(text) {
        return /^[\p{L}][\p{L}' .-]{2,}$/u.test(text)
          && !/^(RA|RS|San|He|EKA|ZF|NFS|NotSan|RettSan|RettAss)$/i.test(text)
          && !/\d{1,2}:\d{2}/.test(text)
          && !/^(von|bis|ändern|liste|externe)$/i.test(text);
      }

      function readHelperTimes(li, dienst) {
        const inputs = [...li.querySelectorAll("input")]
          .filter((input) => {
            const type = (input.getAttribute("type") || "text").toLowerCase();
            const value = norm(input.value || input.getAttribute("value") || "");
            const placeholder = norm(input.getAttribute("placeholder") || "");
            return ["", "text", "time"].includes(type)
              && (/^\d{1,2}:\d{2}$/.test(value) || /^\d{1,2}:\d{2}$/.test(placeholder) || /^(von|bis)$/i.test(placeholder) || input.size <= 8);
          });
        const values = inputs.slice(-2).map((input) => norm(input.value || input.getAttribute("value") || ""));
        const start = timeToMinutes(values[0]) ?? dienst.start;
        const end = timeToMinutes(values[1]) ?? dienst.end;
        return {
          start: clamp(start, dienst.start, dienst.end),
          end: clamp(Math.max(end, start), dienst.start, dienst.end)
        };
      }

      function readQuals(li) {
        const quals = new Set();
        const text = norm(li.innerText || li.textContent || "");
        const matches = text.match(/\b(RA|RS|San|He|EKA|ZF|NFS|NotSan|RettSan|RettAss)\b/g) || [];
        for (const match of matches) quals.add(match);
        return [...quals];
      }

      function readSollSanitaeter() {
        const rows = [...document.querySelectorAll("tr")];
        for (const row of rows) {
          const cells = [...row.querySelectorAll("td, th")].map((cell) => norm(cell.textContent || ""));
          if (!cells.length || !/Sanit(ä|ae)?ter/i.test(cells.join(" "))) continue;
          const sollCell = cells[2] || cells.find((cell) => /^\d+$/.test(cell));
          const value = Number((sollCell || "").match(/\d+/)?.[0] || 0);
          if (value > 0) return value;
        }
        return null;
      }

      function buildCoverage(dienst, helpers, soll) {
        const points = new Set([dienst.start, dienst.end]);
        helpers.forEach((helper) => {
          points.add(helper.start);
          points.add(helper.end);
        });
        const sorted = [...points].sort((a, b) => a - b).filter((point) => point >= dienst.start && point <= dienst.end);
        const segments = [];
        for (let i = 0; i < sorted.length - 1; i++) {
          const start = sorted[i];
          const end = sorted[i + 1];
          if (end <= start) continue;
          const count = helpers.filter((helper) => helper.qualified && helper.start <= start && helper.end >= end).length;
          const previous = segments[segments.length - 1];
          if (previous && previous.count === count && (previous.count >= soll) === (count >= soll)) {
            previous.end = end;
          } else {
            segments.push({ start, end, count });
          }
        }
        return segments;
      }

      function buildTicks(dienst) {
        const ticks = [{ minute: dienst.start, label: minutesToLabel(dienst.start) }];
        const firstHour = Math.ceil(dienst.start / 60) * 60;
        for (let minute = firstHour; minute < dienst.end; minute += 60) {
          if (minute !== dienst.start) ticks.push({ minute, label: minutesToLabel(minute) });
        }
        if (!ticks.some((tick) => tick.minute === dienst.end)) ticks.push({ minute: dienst.end, label: minutesToLabel(dienst.end) });
        return ticks;
      }

      function pill(text, variant = "") {
        const el = document.createElement("span");
        el.className = `hg-pill${variant ? ` hg-pill-${variant}` : ""}`;
        el.textContent = text;
        return el;
      }

      function timeToMinutes(value) {
        const match = norm(value).match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour > 23 || minute > 59) return null;
        return hour * 60 + minute;
      }

      function minutesToLabel(value) {
        const hour = Math.floor(value / 60);
        const minute = value % 60;
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }

      function percent(dienst, minute) {
        return ((minute - dienst.start) / (dienst.end - dienst.start)) * 100;
      }

      function percentWidth(dienst, start, end) {
        return ((end - start) / (dienst.end - dienst.start)) * 100;
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function debounce(fn, waitMs) {
        let timer = null;
        return () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(fn, waitMs);
        };
      }
    }
  });
})();
