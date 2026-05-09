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
      const RESCUE_QUAL_RE = /^(san|rs|ra|nfs|notsan|rettsan|rettass)$/i;
      const QUAL_RE = /\b(RA|RS|San|He|EKA|ZF|NFS|NotSan|RettSan|RettAss)\b/g;

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

        for (const rootInfo of findPersonListRoots()) {
          const obs = new MutationObserver(debounced);
          obs.observe(rootInfo.root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
        }

        const requirementsTable = document.getElementById("et_ap_liste");
        if (requirementsTable) {
          const obs = new MutationObserver(debounced);
          obs.observe(requirementsTable, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-soll"] });
        }
      }

      function render() {
        const dienst = readDienst();
        if (!dienst) return;

        const requirements = readRequirements();
        const helpers = readHelpers(dienst);
        const coverageRows = requirements
          .filter((req) => !req.max && req.target > 0)
          .map((req) => ({ req, segments: buildCoverage(dienst, helpers, req) }));
        const complete = coverageRows.length > 0 && coverageRows.every((row) => row.segments.every((seg) => seg.count >= row.req.target));

        const chart = ensureChartHost();
        if (!chart) return;

        chart.innerHTML = "";
        chart.appendChild(buildHeader(dienst, helpers, requirements, coverageRows, complete));

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

        const firstList = findPersonListRoots()[0];
        const anchor = firstList?.root || document.querySelector("main")?.firstElementChild || document.body.firstElementChild;
        if (!anchor || !anchor.parentNode) return null;

        anchor.parentNode.insertBefore(chart, anchor);
        return chart;
      }

      function buildHeader(dienst, helpers, requirements, coverageRows, complete) {
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
        requirements.forEach((req) => summary.appendChild(pill(`${req.label}: ${req.max ? "max. " : ""}${req.target}`)));
        if (!requirements.length) summary.appendChild(pill("Keine Besetzungsanforderung erkannt", "warn"));
        if (coverageRows.length) {
          summary.appendChild(pill(complete ? "durchgehend vollständig" : "Lücken vorhanden", complete ? "ok" : "bad"));
        }

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
          grid.appendChild(buildCoverageLabel(row.req));
          grid.appendChild(buildCoverageTrack(dienst, row.req, row.segments));
        }

        for (const helper of helpers) {
          grid.appendChild(buildHelperLabel(helper));
          grid.appendChild(buildHelperTrack(dienst, helper));
        }

        outer.appendChild(grid);
        return outer;
      }

      function buildCoverageLabel(req) {
        const label = document.createElement("div");
        label.className = "hg-row-label hg-coverage-label";
        label.innerHTML = `<span></span><div class="hg-meta"></div>`;
        label.querySelector("span").textContent = `${req.label}-Abdeckung`;
        label.querySelector(".hg-meta").textContent = `benötigt: ${req.target} gleichzeitig`;
        return label;
      }

      function buildCoverageTrack(dienst, req, segments) {
        const track = document.createElement("div");
        track.className = "hg-row-track hg-coverage-track";
        track.style.backgroundSize = `${100 / Math.max(1, Math.ceil((dienst.end - dienst.start) / 60))}% 100%`;
        for (const seg of segments) {
          const el = document.createElement("div");
          el.className = `hg-segment ${seg.count >= req.target ? "hg-segment-ok" : "hg-segment-bad"}`;
          el.style.left = `${percent(dienst, seg.start)}%`;
          el.style.width = `${Math.max(.5, percentWidth(dienst, seg.start, seg.end))}%`;
          el.title = `${minutesToLabel(seg.start)} - ${minutesToLabel(seg.end)} Uhr: ${seg.count}/${req.target}`;
          el.textContent = `${seg.count}/${req.target}`;
          track.appendChild(el);
        }
        return track;
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
        for (const rootInfo of findPersonListRoots()) {
          const items = rootInfo.root.matches("li") ? [rootInfo.root] : [...rootInfo.root.querySelectorAll("li[data-uid], li.helfer, li")];
          for (const li of items) {
            if (li.closest(`#${CHART_ID}`)) continue;
            const helper = readHelper(li, rootInfo.status, dienst);
            if (helper) helpers.push(helper);
          }
        }
        return helpers.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name, "de"));
      }

      function findPersonListRoots() {
        const roots = [];
        const addRoot = (root, status) => {
          if (!root || root.closest?.(`#${CHART_ID}`) || roots.some((entry) => entry.root === root)) return;
          roots.push({ root, status });
        };

        document.querySelectorAll("#et_posbox_fest, #eingeteilte-personen").forEach((root) => addRoot(root, "fest"));
        document.querySelectorAll("#et_posbox_meld, #gemeldete-personen").forEach((root) => addRoot(root, "gemeldet"));

        document.querySelectorAll("fieldset, section").forEach((root) => {
          const title = norm(root.querySelector("legend, h2")?.textContent || "");
          if (/eingeteilte\s+personen/i.test(title)) addRoot(root, "fest");
          if (/gemeldete\s+personen/i.test(title)) addRoot(root, "gemeldet");
        });

        return roots;
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
          positionIds: readPositionIds(li),
          start: times.start,
          end: times.end,
          u18: note === "U18",
          note
        };
      }

      function readName(li) {
        const explicit = li.querySelector(".name, .helfer-name, .username, a[href*='adresse.php']");
        if (explicit) {
          const val = cleanName(explicit.textContent || "");
          if (looksLikeName(val)) return val;
        }

        const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || parent.closest(`#${CHART_ID}`)) return NodeFilter.FILTER_REJECT;
            if (parent.matches("input, button, select, textarea, script, style")) return NodeFilter.FILTER_REJECT;
            if (parent.closest("button, select, textarea, .hiorg-wa-btn")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let node = walker.nextNode();
        while (node) {
          const val = cleanName(node.nodeValue || "");
          if (looksLikeName(val)) return val;
          node = walker.nextNode();
        }

        const clone = li.cloneNode(true);
        clone.querySelectorAll("input, button, select, textarea, svg, img, .hiorg-wa-btn").forEach((el) => el.remove());
        const text = norm(clone.innerText || clone.textContent || "");
        const beforeQual = cleanName(text.split(/\b(?:RA|RS|San|He|EKA|ZF|NFS|NotSan|RettSan|RettAss)\b/)[0] || "");
        if (looksLikeName(beforeQual)) return beforeQual;
        return "";
      }

      function cleanName(text) {
        return norm(text).replace(/^[○●◯\s-]+/, "").replace(/\s+/g, " ").trim();
      }

      function looksLikeName(text) {
        return /^[\p{L}][\p{L}' .-]{2,}$/u.test(text)
          && !/^(RA|RS|San|He|EKA|ZF|NFS|NotSan|RettSan|RettAss)$/i.test(text)
          && !/\d{1,2}:\d{2}/.test(text)
          && !/^(von|bis|ändern|liste|externe|einteilen)$/i.test(text);
      }

      function readHelperTimes(li, dienst) {
        const inputs = [...li.querySelectorAll("input")]
          .filter((input) => {
            const type = (input.getAttribute("type") || "text").toLowerCase();
            const value = norm(input.value || input.getAttribute("value") || "");
            const placeholder = norm(input.getAttribute("placeholder") || "");
            return ["", "text", "time"].includes(type)
              && (/^\d{1,2}:\d{2}$/.test(value) || /^\d{1,2}:\d{2}$/.test(placeholder) || /^(von|bis)$/i.test(placeholder) || /^(von|bis)$/i.test(value) || input.size <= 8);
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
        (text.match(QUAL_RE) || []).forEach((qual) => quals.add(qual));
        li.querySelectorAll(".qualiblock:not(.placeholder)").forEach((el) => {
          const value = norm(el.textContent || "");
          if (looksLikeQualification(value)) quals.add(value);
        });
        return [...quals];
      }

      function readPositionIds(li) {
        return [...li.classList]
          .map((className) => className.match(/^ap_(\d+)$/)?.[1] || null)
          .filter(Boolean);
      }

      function extractQualsFromText(text) {
        const quals = new Set(text.match(QUAL_RE) || []);
        const genericMatches = norm(text).match(/\b[\p{L}][\p{L}0-9+.-]{1,12}\b/gu) || [];
        genericMatches.filter(looksLikeQualification).forEach((qual) => quals.add(qual));
        return [...quals];
      }

      function looksLikeQualification(text) {
        return /^[\p{L}][\p{L}0-9+.-]{1,12}$/u.test(text)
          && !/^(von|bis|Filter|Qualifikation|Qualifizierte|Sonstige|Personen|Person|Helfer|Helferin|min|max|fest|gemeldet|unter|keine|passende|Position)$/i.test(text)
          && !/^\d+$/.test(text);
      }

      function readRequirements() {
        const assignmentRequirements = readRequirementsFromAssignmentTable();
        if (assignmentRequirements.length) return assignmentRequirements;

        const requirements = [];
        const add = (req) => {
          if (!req || !req.label || !req.target || req.target < 1) return;
          const key = req.label.toLowerCase();
          if (requirements.some((existing) => existing.label.toLowerCase() === key)) return;
          requirements.push({ ...req, quals: req.quals?.length ? req.quals : inferRequirementQuals(req.label) });
        };

        readRequirementsFromTables().forEach(add);
        readRequirementsFromSummary().forEach(add);
        return requirements;
      }

      function readRequirementsFromAssignmentTable() {
        const table = document.getElementById("et_ap_liste");
        if (!table) return [];

        const requirements = [];
        table.querySelectorAll("tbody.status_komplett > tr").forEach((row) => {
          const target = Number(row.dataset.soll || "") || readTargetFromCountCell(row.querySelector("td"));
          const cells = [...row.children];
          const labelText = norm(cells.slice(1).map((cell) => cell.textContent || "").join(" "));
          const isQualifiedSum = /Qualifizierte/i.test(labelText);
          const isOtherMax = /Sonstige/i.test(labelText);
          const isMax = isOtherMax || /\(max\.\)|max\.|Praktikant/i.test(norm(row.textContent || "") + " " + [...row.querySelectorAll("[title]")].map((el) => el.getAttribute("title") || "").join(" "));

          if (!target && !isOtherMax) return;

          if (isQualifiedSum) {
            requirements.push({
              label: "Qualifizierte",
              target,
              max: false,
              kind: "qualified",
              quals: inferRequirementQuals("Qualifizierte")
            });
            return;
          }

          if (isOtherMax) {
            if (target) {
              requirements.push({ label: "Sonstige", target, max: true, kind: "other", quals: [] });
            }
            return;
          }

          if (!row.classList.contains("et_ap_entry")) return;

          const quals = readRequirementQuals(row);
          const driver = norm(cells[cells.length - 1]?.textContent || "");
          const labelParts = quals.length ? [quals.join("/")] : ["Position"];
          if (driver) labelParts.push(`FS ${driver}`);

          requirements.push({
            label: labelParts.join(" + "),
            target,
            max: isMax,
            kind: "position",
            apId: row.getAttribute("data-apid") || "",
            quals,
            driver
          });
        });

        const minPositionIds = requirements
          .filter((req) => req.kind === "position" && !req.max && req.apId)
          .map((req) => req.apId);
        requirements.forEach((req) => {
          if (req.kind === "qualified" && minPositionIds.length) req.apIds = minPositionIds;
        });

        return dedupeRequirements(requirements);
      }

      function readRequirementQuals(row) {
        return [...row.querySelectorAll(".qualiblock:not(.placeholder)")]
          .map((el) => norm(el.textContent || ""))
          .filter(Boolean);
      }

      function readTargetFromCountCell(cell) {
        const text = norm(cell?.textContent || "");
        return Number(text.match(/\/\s*(\d+)/)?.[1] || 0);
      }

      function dedupeRequirements(requirements) {
        const seen = new Set();
        return requirements.filter((req) => {
          const key = [req.kind || "", req.apId || "", req.label, req.target, req.max ? "max" : "min"].join(":").toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      function readRequirementsFromTables() {
        const result = [];
        document.querySelectorAll("tr").forEach((row) => {
          const cells = [...row.querySelectorAll("td, th")].map((cell) => norm(cell.textContent || ""));
          if (cells.length < 2 || /Anforderung/i.test(cells[0])) return;
          const label = cells[0];
          const sollText = cells[2] || cells.find((cell) => /(?:max\.)?\s*\d+/.test(cell)) || "";
          const target = Number(sollText.match(/\d+/)?.[0] || 0);
          if (!target || /^(Ist|Soll|Status)$/i.test(label)) return;
          result.push({ label: shortenRequirementLabel(label), target, max: /max\.?/i.test(sollText) || /max\.?/i.test(label), quals: extractQualsFromText(label) });
        });
        return result;
      }

      function readRequirementsFromSummary() {
        const result = [];
        const seen = new Set();
        const nodes = [...document.querySelectorAll("body *")]
          .filter((el) => {
            const text = norm(el.textContent || "");
            return !el.closest(`#${CHART_ID}`) && text.length <= 300 && /\/\s*\d+|\(min\.\)|\(max\.\)/i.test(text);
          });

        for (const el of nodes) {
          const text = norm(el.textContent || "");
          const target = Number(text.match(/\/\s*(\d+)/)?.[1] || 0);
          if (!target) continue;

          const quals = extractQualsFromText(text).filter((q) => !/^He$/i.test(q));
          const label = /Qualifiz/i.test(text)
            ? "Qualifizierte"
            : (quals.length ? quals.join("/") : "Besetzung");
          const key = `${label}:${target}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          result.push({ label, target, quals, max: /max\.?/i.test(text) });
        }

        document.querySelectorAll("body *").forEach((el) => {
          const ownText = norm([...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.nodeValue || "").join(" "));
          if (!/Qualifiz|Sonstige/i.test(ownText)) return;
          const row = el.closest("tr") || el.parentElement;
          const rowText = norm(row?.textContent || "");
          const target = Number(rowText.match(/\/\s*(\d+)/)?.[1] || rowText.match(/\b(?:max\.)?\s*(\d+)\b/i)?.[1] || 0);
          if (!target) return;
          const label = /Sonstige/i.test(ownText) ? "Sonstige" : "Qualifizierte";
          const key = `${label}:${target}`.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          result.push({ label, target, max: /max\.?/i.test(rowText) || /Sonstige/i.test(ownText) });
        });

        return result;
      }

      function shortenRequirementLabel(label) {
        if (/Sanit/i.test(label)) return "San/RD";
        if (/Qualifiz/i.test(label)) return "Qualifizierte";
        if (/Sonstige/i.test(label)) return "Sonstige";
        return label;
      }

      function inferRequirementQuals(label) {
        if (/San|Qualifiz/i.test(label)) return ["San", "RS", "RA", "NFS", "NotSan", "RettSan", "RettAss"];
        const quals = extractQualsFromText(label);
        return quals.length ? quals : [];
      }

      function buildCoverage(dienst, helpers, req) {
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
          const count = helpers.filter((helper) => matchesRequirement(helper, req) && helper.start <= start && helper.end >= end).length;
          const previous = segments[segments.length - 1];
          if (previous && previous.count === count && (previous.count >= req.target) === (count >= req.target)) {
            previous.end = end;
          } else {
            segments.push({ start, end, count });
          }
        }
        return segments;
      }

      function matchesRequirement(helper, req) {
        if (req.apId) return helper.positionIds.includes(req.apId);
        if (req.kind === "qualified" || /Qualifiz/i.test(req.label)) {
          if (req.apIds?.length) return helper.positionIds.some((apId) => req.apIds.includes(apId));
          return helper.quals.some((qual) => RESCUE_QUAL_RE.test(qual));
        }
        if (!req.quals?.length) return true;
        return helper.quals.some((qual) => req.quals.some((needed) => qual.toLowerCase() === needed.toLowerCase()));
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
