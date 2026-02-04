(() => {
  "use strict";

  const MOD_ID = "formulareWhatsApp";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "WhatsApp (Formulare) v2",
    defaultEnabled: true,
    pages: ["/formulare.php"],
    run: ({ norm }) => {
      const DEFAULT_CC = "+49";
      const PHONE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
      const MAX_PARALLEL_FETCHES = 2;

      const WA_CLASS = "hiorg-wa-btn";
      const WA_DISABLED_CLASS = "hiorg-wa-disabled";
      const WA_OK_CLASS = "hiorg-wa-ok";

      const HELPER_TABLE_HEADER_RX = /(helfer|name|mitglied)/i;
      const HELPER_LIST_RX = /(helfer|dienst)/i;

      if (!document.getElementById("hiorg-wa-style")) {
        const style = document.createElement("style");
        style.id = "hiorg-wa-style";
        style.textContent = `
.${WA_CLASS}{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:16px;
  height:16px;
  margin-left:6px;
  vertical-align:middle;
  cursor:pointer;
  color:#4a4a4a;
}
.${WA_CLASS} svg{ width:16px; height:16px; display:block; }
.${WA_DISABLED_CLASS}{ cursor:not-allowed; opacity:.45; }
.${WA_OK_CLASS}{ color:#1fa855; }
        `;
        document.documentElement.appendChild(style);
      }

      function cacheGet(key) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return { hit: false, value: null };
          const obj = JSON.parse(raw);
          if (!obj || typeof obj !== "object") return { hit: false, value: null };
          if (typeof obj.ts !== "number") return { hit: false, value: null };
          if (Date.now() - obj.ts > PHONE_CACHE_TTL_MS) return { hit: false, value: null };
          return { hit: true, value: ("value" in obj) ? obj.value : null };
        } catch {
          return { hit: false, value: null };
        }
      }

      function cacheSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value: value ?? null })); } catch {}
      }

      function isMobileNumber(rawPhone) {
        const raw = norm(rawPhone);
        if (!raw) return false;

        let s = raw.replace(/[^\d+]/g, "");
        if (!s) return false;

        if (s.startsWith("00")) s = "+" + s.slice(2);

        if (s.startsWith("+")) {
          const digits = s.slice(1).replace(/\D/g, "");
          const ccDigits = DEFAULT_CC.replace(/\D/g, "");
          if (digits.startsWith(ccDigits)) {
            s = "0" + digits.slice(ccDigits.length);
          } else {
            s = digits;
          }
        } else {
          s = s.replace(/\D/g, "");
        }

        return s.startsWith("01");
      }

      function toWhatsAppDigits(rawPhone) {
        const raw = norm(rawPhone);
        if (!raw) return null;

        if (!isMobileNumber(raw)) return null;

        let s = raw.replace(/[^\d+]/g, "");
        if (!s) return null;

        if (s.startsWith("00")) s = "+" + s.slice(2);

        if (s.startsWith("+")) {
          const digits = s.slice(1).replace(/\D/g, "");
          return digits.length >= 6 ? digits : null;
        }

        if (s.startsWith("0")) {
          const rest = s.replace(/^0+/, "");
          const ccDigits = DEFAULT_CC.replace(/\D/g, "");
          const digits = (ccDigits + rest).replace(/\D/g, "");
          return digits.length >= 6 ? digits : null;
        }

        const digits = s.replace(/\D/g, "");
        return digits.length >= 6 ? digits : null;
      }

      function extractInputValue(html, field) {
        const patterns = [
          new RegExp(`<input[^>]*\\bid=["']${field}["'][^>]*\\bvalue=["']([^"']*)["'][^>]*>`, "i"),
          new RegExp(`<input[^>]*\\bname=["']${field}["'][^>]*\\bvalue=["']([^"']*)["'][^>]*>`, "i")
        ];

        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) return norm(match[1]);
        }

        return "";
      }

      function svgWhatsApp(disabled) {
        return `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="${disabled ? "opacity:.45" : ""}">
  <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
</svg>`;
      }

      let active = 0;
      const queue = [];
      function limit(fn) {
        return new Promise((resolve, reject) => {
          queue.push({ fn, resolve, reject });
          pump();
        });
      }
      function pump() {
        while (active < MAX_PARALLEL_FETCHES && queue.length) {
          const job = queue.shift();
          active++;
          Promise.resolve()
            .then(job.fn)
            .then(job.resolve, job.reject)
            .finally(() => { active--; pump(); });
        }
      }

      async function fetchHandyFromAdresse(uid) {
        const cacheKey = `hiorg_phone_${uid}`;
        const cached = cacheGet(cacheKey);
        if (cached.hit) return cached.value;

        const url = `/adresse.php?user_id=${encodeURIComponent(uid)}`;
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) { cacheSet(cacheKey, null); return null; }

        const html = await resp.text();

        const fields = ["handy", "telpriv", "teldienst"];
        const candidates = fields.map((field) => extractInputValue(html, field)).filter(Boolean);

        let phone = "";
        let digits = null;
        for (const candidate of candidates) {
          phone = candidate;
          digits = toWhatsAppDigits(candidate);
          if (digits) break;
        }

        if (!phone && candidates.length) {
          phone = candidates[0];
        }

        const result = {
          phone: phone || null,
          digits: digits || null
        };

        cacheSet(cacheKey, result);
        return result;
      }

      function normalizeText(text) {
        return norm(text || "").replace(/\s+/g, " ").trim();
      }

      function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      function buildNameKeys(text) {
        const cleaned = normalizeText(text)
          .replace(/\([^)]*\)/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!cleaned) return [];

        const withoutComma = cleaned.replace(/,/g, " ").replace(/\s+/g, " ").trim();
        const parts = withoutComma.split(" ").filter(Boolean);
        const keys = new Set();

        if (parts.length >= 2) {
          const first = parts[0];
          const last = parts[parts.length - 1];
          keys.add(`${last} ${first}`);
          keys.add(`${first} ${last}`);
        }

        keys.add(withoutComma);

        return Array.from(keys).map((key) => normalizeText(key));
      }

      async function fetchMemberMap() {
        const resp = await fetch("/adrliste.php?fm=1", { credentials: "include" });
        if (!resp.ok) return new Map();

        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = doc.querySelectorAll("#adrlisttable tbody tr[role='row']");
        const map = new Map();

        rows.forEach((row) => {
          const uid = row.querySelector("input[name='userIds[]']")?.value;
          if (!uid) return;

          const nameCell = row.querySelector("td:nth-child(2)");
          const firstNameCell = row.querySelector("td:nth-child(3)");

          const dataText = normalizeText(nameCell?.getAttribute("data-text") || nameCell?.dataset?.text || "");
          const firstName = normalizeText(firstNameCell?.textContent || "");

          if (!dataText) return;

          let lastName = dataText;
          if (firstName) {
            const rx = new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i");
            lastName = normalizeText(dataText.replace(rx, " "));
          }

          const keyLastFirst = normalizeText(`${lastName} ${firstName}`.trim());
          const keyFirstLast = normalizeText(`${firstName} ${lastName}`.trim());

          const keys = [dataText, keyLastFirst, keyFirstLast].filter(Boolean);
          keys.forEach((key) => {
            if (key && !map.has(key)) {
              map.set(key, uid);
            }
          });
        });

        return map;
      }

      let memberMapPromise = null;
      function getMemberMap() {
        if (!memberMapPromise) memberMapPromise = fetchMemberMap();
        return memberMapPromise;
      }

      function svgButton(disabled) {
        const btn = document.createElement("span");
        btn.className = WA_CLASS;
        btn.innerHTML = svgWhatsApp(disabled);
        if (disabled) {
          btn.classList.add(WA_DISABLED_CLASS);
        }
        return btn;
      }

      function getHelperNodesFromTables() {
        const nodes = new Set();
        document.querySelectorAll("table").forEach((table) => {
          const headerCells = table.querySelectorAll("thead th");
          const headerRow = headerCells.length ? headerCells : table.querySelectorAll("tr th");
          if (!headerRow.length) return;

          const nameIndices = [];
          headerRow.forEach((th, index) => {
            if (HELPER_TABLE_HEADER_RX.test(normalizeText(th.textContent))) {
              nameIndices.push(index);
            }
          });
          if (!nameIndices.length) return;

          const rows = table.querySelectorAll("tbody tr");
          rows.forEach((row) => {
            const cells = Array.from(row.children);
            nameIndices.forEach((idx) => {
              const cell = cells[idx];
              if (cell) nodes.add(cell);
            });
          });
        });
        return nodes;
      }

      function getHelperNodesFromLists() {
        const nodes = new Set();
        document.querySelectorAll("ul,ol").forEach((list) => {
          const key = `${list.id} ${list.className}`;
          if (!HELPER_LIST_RX.test(key)) return;
          list.querySelectorAll("li").forEach((li) => nodes.add(li));
        });
        return nodes;
      }

      function getHelperNodesFallback() {
        const nodes = new Set();
        document.querySelectorAll("[data-helfer],[data-helper]").forEach((el) => nodes.add(el));
        return nodes;
      }

      function gatherHelperNodes() {
        const nodes = new Set();
        getHelperNodesFromTables().forEach((node) => nodes.add(node));
        getHelperNodesFromLists().forEach((node) => nodes.add(node));
        getHelperNodesFallback().forEach((node) => nodes.add(node));
        return Array.from(nodes);
      }

      async function ensureButton(node) {
        if (!node || node.querySelector(`.${WA_CLASS}`)) return;

        const nameText = normalizeText(node.textContent || "");
        if (!nameText) return;

        const nameKeys = buildNameKeys(nameText);
        if (!nameKeys.length) return;

        const memberMap = await getMemberMap();
        let uid = null;
        for (const key of nameKeys) {
          uid = memberMap.get(key);
          if (uid) break;
        }
        if (!uid) return;

        const btn = svgButton(true);
        btn.title = "WhatsApp laden";
        node.appendChild(btn);

        limit(async () => {
          const result = await fetchHandyFromAdresse(uid);
          const phone = result?.phone ?? null;
          const digits = result?.digits ?? null;

          if (digits) {
            btn.classList.remove(WA_DISABLED_CLASS);
            btn.classList.add(WA_OK_CLASS);
            btn.innerHTML = svgWhatsApp(false);
            btn.title = `WhatsApp öffnen (${phone})`;
            btn.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              window.open(`https://wa.me/${encodeURIComponent(digits)}`, "_blank", "noopener,noreferrer");
            });
          } else {
            btn.classList.remove(WA_OK_CLASS);
            btn.classList.add(WA_DISABLED_CLASS);
            btn.innerHTML = svgWhatsApp(true);
            btn.title = phone ? `Keine WhatsApp-geeignete Nummer (${phone})` : "Keine Handynummer hinterlegt";
          }
        }).catch(() => {
          btn.classList.remove(WA_OK_CLASS);
          btn.classList.add(WA_DISABLED_CLASS);
          btn.innerHTML = svgWhatsApp(true);
          btn.title = "Nummer konnte nicht geladen werden";
        });
      }

      function scanAndAttach() {
        const nodes = gatherHelperNodes();
        nodes.forEach((node) => ensureButton(node));
      }

      scanAndAttach();

      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "childList" && (m.addedNodes?.length || 0) > 0) {
            scanAndAttach();
            break;
          }
        }
      });
      obs.observe(document.body, { subtree: true, childList: true });
    }
  });
})();
