(() => {
  "use strict";

  const MOD_ID = "dienstGantt";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Dienst-Gantt",
    defaultEnabled: false,
    match: (loc) => loc && (
      loc.pathname === "/einteilung_dienst.php"
      || loc.pathname === "/einteilung_dienst_positionen.php"
      || loc.pathname === "/einteilung_termin.php"
    ),
    run: ({ norm }) => {
      const CHART_ID = "hiorg-dienst-gantt";
      const STYLE_ID = "hiorg-dienst-gantt-style";
      const MEDICAL_QUALIFICATIONS = [
        { rank: 0, patterns: [/keine\s+med\.?\s+qualifikation/i, /keine\s+medizinische\s+qualifikation/i] },
        { rank: 1, patterns: [/erste\s+hilfe/i, /^eh$/i, /^he$/i] },
        { rank: 2, patterns: [/eka(?:\s+san)?/i] },
        { rank: 3, patterns: [/sanit[aä]ter/i, /^san$/i] },
        { rank: 4, patterns: [/rettungshelfer/i, /^rh$/i] },
        { rank: 5, patterns: [/rettungssanit[aä]ter/i, /^rs$/i, /^rettsan$/i] },
        { rank: 6, patterns: [/rettungsassistent/i, /^ra$/i, /^rettass$/i] },
        { rank: 7, patterns: [/notfallsanit[aä]ter/i, /^nfs$/i, /^notsan$/i] },
        { rank: 8, patterns: [/arzt|[aä]rztin/i] },
        { rank: 9, patterns: [/notarzt|not[aä]rztin/i] }
      ];
      const TACTICAL_QUALIFICATIONS = [
        { rank: 1, patterns: [/gruppenf[uü]hrer/i, /^gf$/i] },
        { rank: 2, patterns: [/zugf[uü]hrer/i, /^zf$/i] },
        { rank: 3, patterns: [/verbands?f[uü]hrer/i, /^vf$/i] }
      ];
      const LISTS = [
        { selector: "#einteilung_fest, #et_posbox_fest, #eingeteilte-personen", status: "fest", title: "Eingeteilt" },
        { selector: "#einteilung_meld, #et_posbox_meld, #gemeldete-personen", status: "gemeldet", title: "Gemeldet" }
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
#${CHART_ID} .hg-chart{ overflow-x:visible; padding-bottom:2px; width:100%; }
#${CHART_ID} .hg-grid{ display:grid; grid-template-columns:minmax(140px, 24%) minmax(0, 1fr); gap:0; width:100%; min-width:0; }
#${CHART_ID} .hg-label, #${CHART_ID} .hg-time, #${CHART_ID} .hg-row-label, #${CHART_ID} .hg-row-track{ border-bottom:1px solid #eef2f6; }
#${CHART_ID} .hg-label{ padding:0 10px 8px 0; font-weight:700; color:#53616f; }
#${CHART_ID} .hg-time{ position:relative; height:30px; }
#${CHART_ID} .hg-tick{ position:absolute; top:0; bottom:0; width:1px; background:#dde5ed; }
#${CHART_ID} .hg-tick strong{ position:absolute; top:0; left:4px; transform:translateX(-50%); padding:0 3px; background:#fff; color:#53616f; font-size:12px; font-weight:600; white-space:nowrap; }
#${CHART_ID} .hg-tick:first-child strong{ left:0; transform:none; }
#${CHART_ID} .hg-tick:last-child strong{ left:auto; right:0; transform:none; }
#${CHART_ID} .hg-row-label{ min-height:44px; padding:8px 10px 8px 0; }
#${CHART_ID} .hg-name{ font-weight:700; line-height:1.15; overflow-wrap:anywhere; }
#${CHART_ID} .hg-meta{ margin-top:3px; color:#66788a; font-size:12px; line-height:1.25; }
#${CHART_ID} .hg-row-track{ position:relative; min-height:44px; padding:9px 0; background:linear-gradient(to right, rgba(221,229,237,.65) 1px, transparent 1px); }
#${CHART_ID} .hg-bar{ position:absolute; top:9px; height:24px; border-radius:7px; overflow:hidden; color:#fff; font-size:12px; line-height:24px; padding:0 6px; white-space:nowrap; text-overflow:ellipsis; box-shadow:inset 0 -1px 0 rgba(0,0,0,.18); }
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

        const roots = [
          ...LISTS.map((cfg) => document.querySelector(cfg.selector)).filter(Boolean),
          document.querySelector("#et_helferlisten")
        ].filter(Boolean);
        for (const root of roots) {
          const obs = new MutationObserver(debounced);
          const isListWrapper = root.id === "et_helferlisten";
          obs.observe(root, {
            childList: true,
            subtree: !isListWrapper,
            attributes: !isListWrapper,
            attributeFilter: isListWrapper ? undefined : ["class", "style"]
          });
        }
      }

      function render() {
        const dienst = readDienst();
        if (!dienst) return;

        const helpers = readHelpers(dienst);
        const requirements = readRequirements();
        const coverageRows = requirements.map((requirement) => ({
          requirement,
          coverage: buildCoverage(dienst, helpers, requirement)
        }));
        const complete = coverageRows.length > 0
          && coverageRows.every((row) => row.coverage.length > 0 && row.coverage.every((seg) => seg.count >= row.requirement.count));

        const chart = ensureChartHost();
        if (!chart) return;

        chart.innerHTML = "";
        chart.appendChild(buildHeader(dienst, helpers, requirements, complete));

        if (!helpers.length) {
          const empty = document.createElement("div");
          empty.className = "hg-empty";
          empty.textContent = "Noch keine eingeteilten oder gemeldeten Personen für eine Zeitübersicht gefunden.";
          chart.appendChild(empty);
          return;
        }

        chart.appendChild(buildLegend());
        chart.appendChild(buildChart(dienst, helpers, coverageRows));
      }

      function ensureChartHost() {
        let chart = document.getElementById(CHART_ID);
        if (chart) return chart;

        chart = document.createElement("section");
        chart.id = CHART_ID;

        const firstList = document.querySelector("#einteilung_fest, #et_posbox_fest, #eingeteilte-personen")
          || [...document.querySelectorAll("fieldset, section, h2")].find((el) => /eingeteilte|helfer/i.test(el.textContent || ""));
        const anchor = firstList || document.querySelector("main")?.firstElementChild || document.body.firstElementChild;
        if (!anchor || !anchor.parentNode) return null;

        anchor.parentNode.insertBefore(chart, anchor);
        return chart;
      }

      function buildHeader(dienst, helpers, requirements, complete) {
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
        requirements.forEach((requirement) => summary.appendChild(pill(`Soll ${requirement.label}: ${requirement.count}`)));
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

      function buildChart(dienst, helpers, coverageRows) {
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

        for (const row of coverageRows) {
          const coverageLabel = document.createElement("div");
          coverageLabel.className = "hg-row-label hg-coverage-label";
          coverageLabel.innerHTML = `<span></span><div class="hg-meta"></div>`;
          coverageLabel.querySelector("span").textContent = `${row.requirement.label}-Abdeckung`;
          coverageLabel.querySelector(".hg-meta").textContent = `benötigt: ${row.requirement.count} gleichzeitig`;
          const coverageTrack = document.createElement("div");
          coverageTrack.className = "hg-row-track hg-coverage-track";
          coverageTrack.style.backgroundSize = `${100 / Math.max(1, Math.ceil((dienst.end - dienst.start) / 60))}% 100%`;
          for (const seg of row.coverage) {
            const el = document.createElement("div");
            el.className = `hg-segment ${seg.count >= row.requirement.count ? "hg-segment-ok" : "hg-segment-bad"}`;
            el.style.left = `${percent(dienst, seg.start)}%`;
            el.style.width = `${Math.max(.5, percentWidth(dienst, seg.start, seg.end))}%`;
            el.title = `${minutesToLabel(seg.start)} - ${minutesToLabel(seg.end)} Uhr: ${seg.count}/${row.requirement.count}`;
            el.textContent = `${seg.count}/${row.requirement.count}`;
            coverageTrack.appendChild(el);
          }
          grid.appendChild(coverageLabel);
          grid.appendChild(coverageTrack);
        }

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
              if (helper) {
                helper.index = helpers.length;
                helpers.push(helper);
              }
            }
          });
        }
        const statusOrder = { fest: 0, gemeldet: 1 };
        return helpers.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || a.index - b.index);
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
          ranks: readQualificationRanks(li, quals),
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
        qualificationTexts(li).forEach((value) => {
          const text = norm(value);
          if (!text) return;
          const matches = text.match(/\b(RA|RS|San|He|EH|EKA|RH|GF|ZF|VF|NFS|NotSan|RettSan|RettAss)\b/g) || [];
          for (const match of matches) quals.add(match);
          if (qualificationRank(text, MEDICAL_QUALIFICATIONS) >= 0 || qualificationRank(text, TACTICAL_QUALIFICATIONS) >= 0) quals.add(text);
        });
        return [...quals];
      }

      function qualificationTexts(root) {
        const clone = root.cloneNode(true);
        clone.querySelectorAll("input, button, select, textarea, svg, img, .hiorg-wa-btn").forEach((el) => el.remove());
        const values = [clone.innerText || clone.textContent || ""];
        root.querySelectorAll("[title]").forEach((el) => values.push(el.getAttribute("title") || ""));
        root.querySelectorAll("select option:checked").forEach((el) => values.push(el.textContent || "", el.value || ""));
        return values;
      }

      function readQualificationRanks(root, quals = readQuals(root)) {
        const texts = [...qualificationTexts(root), ...quals];
        return {
          medical: Math.max(-1, ...texts.map((text) => qualificationRank(text, MEDICAL_QUALIFICATIONS))),
          tactical: Math.max(-1, ...texts.map((text) => qualificationRank(text, TACTICAL_QUALIFICATIONS)))
        };
      }

      function qualificationRank(value, definitions) {
        const text = norm(String(value || ""));
        if (!text) return -1;
        if (/^-?\d+$/.test(text) && definitions === MEDICAL_QUALIFICATIONS) return Number(text);
        return definitions.reduce((rank, entry) => (entry.patterns.some((pattern) => pattern.test(text)) ? Math.max(rank, entry.rank) : rank), -1);
      }

      function readRequirements() {
        const requirements = readRequirementTable();
        if (requirements.length) return requirements;
        const soll = readSollSanitaeter();
        return [{ dimension: "medical", rank: 3, count: soll || 2, label: "San/RD" }];
      }

      function readRequirementTable() {
        const requirementTable = document.querySelector("#et_ap_liste");
        if (!requirementTable) return [];

        const requirements = [
          ...readDimensionRequirements(requirementTable, "status_q1", "medical", "San/RD"),
          ...readDimensionRequirements(requirementTable, "status_q2", "tactical", "Taktik")
        ];
        return mergeRequirements(requirements);
      }

      function readDimensionRequirements(table, className, dimension, fallbackLabel) {
        const definitions = dimension === "medical" ? MEDICAL_QUALIFICATIONS : TACTICAL_QUALIFICATIONS;
        return [...table.querySelectorAll(`tbody.${className} tr[data-soll]`)]
          .map((row) => {
            const count = readSollValue(row);
            const rowRank = Number(row.getAttribute("data-rang"));
            const labelText = readRequirementLabel(row) || fallbackLabel;
            const textRank = qualificationRank(`${labelText} ${row.textContent || ""}`, definitions);
            const rank = Number.isFinite(rowRank) && rowRank >= 0 ? rowRank : textRank;
            if (count <= 0 || rank < 0) return null;
            return { dimension, rank, count, label: labelText };
          })
          .filter(Boolean);
      }

      function readRequirementLabel(row) {
        const qual = [...row.querySelectorAll(".qualiblock:not(.placeholder)")]
          .map((el) => norm(el.getAttribute("title") || el.textContent || ""))
          .find(Boolean);
        return qual || "";
      }

      function mergeRequirements(requirements) {
        const merged = new Map();
        for (const requirement of requirements) {
          const key = `${requirement.dimension}:${requirement.rank}:${requirement.label}`;
          const existing = merged.get(key);
          if (existing) existing.count = Math.max(existing.count, requirement.count);
          else merged.set(key, { ...requirement });
        }
        return [...merged.values()].sort((a, b) => a.dimension.localeCompare(b.dimension) || b.rank - a.rank);
      }

      function readSollSanitaeter() {
        const requirementTable = document.querySelector("#et_ap_liste");

        const qualifiedSumRow = requirementTable?.querySelector("tbody.status_summe tr[data-soll]");
        if (qualifiedSumRow && /Qualifizierte\s*\(min\.\)/i.test(qualifiedSumRow.textContent || "")) {
          const value = readSollValue(qualifiedSumRow);
          if (value > 0) return value;
        }

        const medicalRows = requirementTable
          ? [...requirementTable.querySelectorAll("tbody.status_q1 tr[data-soll]")]
          : [];
        for (const row of medicalRows) {
          const text = norm(row.textContent || "");
          const titles = [...row.querySelectorAll(".qualiblock[title]")].map((el) => norm(el.getAttribute("title") || "")).join(" ");
          if (!/(Sanit|Rettung|Notfall|\bSan\b|\bRS\b|\bRA\b|NotSan|NFS)/i.test(`${text} ${titles}`)) continue;
          const value = readSollValue(row);
          if (value > 0) return value;
        }

        const positionRows = requirementTable
          ? [...requirementTable.querySelectorAll("tbody.status_komplett:not(.status_summe) tr.et_ap_entry[data-soll]")]
          : [];
        const positionSum = positionRows.reduce((sum, row) => {
          if (!isQualifiedRequirementRow(row)) return sum;
          return sum + readSollValue(row);
        }, 0);
        if (positionSum > 0) return positionSum;

        const rows = [...document.querySelectorAll("tr[data-soll], tr")];
        for (const row of rows) {
          const text = norm(row.textContent || "");
          const titles = [...row.querySelectorAll("[title]")].map((el) => norm(el.getAttribute("title") || "")).join(" ");
          if (!/(Sanit|Rettung|Notfall|Qualifizierte\s*\(min\.\)|\bSan\b|\bRS\b|\bRA\b|NotSan|NFS)/i.test(`${text} ${titles}`)) continue;
          const value = readSollValue(row);
          if (value > 0) return value;
        }
        return null;
      }

      function isQualifiedRequirementRow(row) {
        if (!row) return false;
        const text = norm(row.textContent || "");
        const titles = [...row.querySelectorAll("[title]")].map((el) => norm(el.getAttribute("title") || "")).join(" ");
        if (/Praktikant|Sonstige\s*\(max\.\)|Erste Hilfe/i.test(`${text} ${titles}`)) return false;
        return /(Sanit|Rettung|Notfall|\bSan\b|\bRS\b|\bRA\b|NotSan|NFS)/i.test(`${text} ${titles}`);
      }

      function readSollValue(row) {
        const dataSoll = Number(row?.getAttribute("data-soll") || 0);
        if (dataSoll > 0) return dataSoll;
        const statusText = norm(row?.querySelector("td:first-child, th:first-child")?.textContent || "");
        const fraction = statusText.match(/\b\d+\s*\/\s*(\d+)\b/);
        if (fraction) return Number(fraction[1]);
        return 0;
      }

      function buildCoverage(dienst, helpers, requirement) {
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
          const count = helpers.filter((helper) => helperMeetsRequirement(helper, requirement) && helper.start <= start && helper.end >= end).length;
          const previous = segments[segments.length - 1];
          if (previous && previous.count === count && (previous.count >= requirement.count) === (count >= requirement.count)) {
            previous.end = end;
          } else {
            segments.push({ start, end, count });
          }
        }
        return segments;
      }

      function helperMeetsRequirement(helper, requirement) {
        return (helper.ranks?.[requirement.dimension] ?? -1) >= requirement.rank;
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
