(() => {
  "use strict";

  const MOD_ID = "dienstWhatsApp";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "WhatsApp (Dienste)",
    defaultEnabled: true,
    match: (loc) => loc && (
      loc.pathname === "/einteilung_dienst.php"
      || loc.pathname === "/einteilung_dienst_positionen.php"
      || loc.pathname === "/einteilung_termin.php"
      || loc.pathname === "/stdliste.php"
      || loc.pathname === "/personal_verfuegbarkeit.php"
      || loc.pathname === "/adrliste.php"
    ),
    run: ({ norm }) => {
      const DEFAULT_CC = "+49";
      const PHONE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
      const MAX_PARALLEL_FETCHES = 2;

      const LIST_ROOT_SELS = ["#et_helferlisten", "#et_posbox_freie", "#et_posbox_fest", "#et_posbox_meld", "#et_posbox_abs", "#et_posbox_zu"];
      const BOX_SEL = "li[data-uid]";
      const AFTER_SEL = "img.btn_bemerkung.btn-icon-gly2-inline, img.btn_bemerkung.btn-icon-gly2";
      const STD_ROW_SEL = "tr[row-id]";
      const VERF_ROW_SEL = "tr.user[data-user-id]";
      const ADR_ROW_SEL = "tr[role='row']";

      const WA_CLASS = "hiorg-wa-btn";
      const WA_DISABLED_CLASS = "hiorg-wa-disabled";
      const WA_OK_CLASS = "hiorg-wa-ok";

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

      // mini concurrency limiter
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

      function buildButton(uid) {
        const btn = document.createElement("span");
        btn.className = WA_CLASS;
        btn.dataset.uid = uid;
        btn.title = "WhatsApp öffnen";
        btn.classList.add(WA_DISABLED_CLASS);
        btn.innerHTML = svgWhatsApp(true);

        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const waDigits = btn.dataset.waDigits || "";
          if (!waDigits) return;
          window.open(`https://wa.me/${encodeURIComponent(waDigits)}`, "_blank", "noopener,noreferrer");
        });

        limit(async () => {
          const result = await fetchHandyFromAdresse(uid);
          const phone = result?.phone ?? null;
          const digits = result?.digits ?? null;

          if (digits) {
            btn.classList.remove(WA_DISABLED_CLASS);
            btn.classList.add(WA_OK_CLASS);
            btn.innerHTML = svgWhatsApp(false);
            btn.dataset.waDigits = digits;
            btn.title = `WhatsApp öffnen (${phone})`;
          } else {
            btn.classList.remove(WA_OK_CLASS);
            btn.classList.add(WA_DISABLED_CLASS);
            btn.innerHTML = svgWhatsApp(true);
            btn.dataset.waDigits = "";
            btn.title = phone ? `Keine WhatsApp-geeignete Nummer (${phone})` : "Keine Handynummer hinterlegt";
          }
        }).catch(() => {
          btn.classList.remove(WA_OK_CLASS);
          btn.classList.add(WA_DISABLED_CLASS);
          btn.innerHTML = svgWhatsApp(true);
          btn.dataset.waDigits = "";
          btn.title = "Nummer konnte nicht geladen werden";
        });

        return btn;
      }

      function ensureButtonInContainer(scope, uid, insertTarget, appendContainer = scope) {
        if (!scope || !uid || !appendContainer) return;
        if (scope.querySelector(`.${WA_CLASS}[data-uid="${uid}"]`)) return;

        const btn = buildButton(uid);

        if (insertTarget) {
          insertTarget.insertAdjacentElement("afterend", btn);
        } else {
          appendContainer.appendChild(btn);
        }
      }

      function ensureButton(li) {
        const anchor = li.querySelector(AFTER_SEL);
        if (!anchor) return;

        const uid = li.getAttribute("data-uid");
        ensureButtonInContainer(li, uid, anchor);
      }

      function ensureStdlisteButton(row) {
        const uid = row.querySelector("input.id")?.value || "";
        const anchor = row.querySelector("td a[href^='stunden.php?helferidstd=']");
        const cell = anchor?.closest("td") || row.querySelector("td");
        if (!cell) return;
        ensureButtonInContainer(row, uid, anchor ?? null, cell);
      }

      function ensureVerfuegbarkeitButton(row) {
        const uid = row.getAttribute("data-user-id") || "";
        const cell = row.querySelector("td") || row;
        ensureButtonInContainer(row, uid, cell.lastElementChild ?? null, cell);
      }

      function ensureAdrlisteButton(row) {
        const uid = row.querySelector("input[name='userIds[]']")?.value
          || row.querySelector("input[name='id_ary[]']")?.value
          || "";
        const cell = row.querySelector("td[data-text]") || row.querySelector("td:nth-child(2)") || row;
        ensureButtonInContainer(row, uid, cell.lastElementChild ?? null, cell);
      }

      function scanAndAttach() {
        for (const rootSel of LIST_ROOT_SELS) {
          const root = document.querySelector(rootSel);
          if (!root) continue;
          root.querySelectorAll(BOX_SEL).forEach(ensureButton);
        }
      }

      scanAndAttach();

      if (location.pathname === "/stdliste.php") {
        document.querySelectorAll(STD_ROW_SEL).forEach(ensureStdlisteButton);
      }
      if (location.pathname === "/personal_verfuegbarkeit.php") {
        document.querySelectorAll(VERF_ROW_SEL).forEach(ensureVerfuegbarkeitButton);
      }
      if (location.pathname === "/adrliste.php") {
        document.querySelectorAll(ADR_ROW_SEL).forEach(ensureAdrlisteButton);
      }

      for (const rootSel of LIST_ROOT_SELS) {
        const root = document.querySelector(rootSel);
        if (!root) continue;

        const obs = new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type === "childList" && (m.addedNodes?.length || 0) > 0) {
              scanAndAttach();
              break;
            }
          }
        });

        obs.observe(root, { subtree: true, childList: true });
      }

      if (location.pathname === "/stdliste.php") {
        const root = document.querySelector("table");
        if (root) {
          const obs = new MutationObserver(() => {
            document.querySelectorAll(STD_ROW_SEL).forEach(ensureStdlisteButton);
          });
          obs.observe(root, { subtree: true, childList: true });
        }
      }
      if (location.pathname === "/personal_verfuegbarkeit.php") {
        const root = document.querySelector("table");
        if (root) {
          const obs = new MutationObserver(() => {
            document.querySelectorAll(VERF_ROW_SEL).forEach(ensureVerfuegbarkeitButton);
          });
          obs.observe(root, { subtree: true, childList: true });
        }
      }
      if (location.pathname === "/adrliste.php") {
        const root = document.querySelector("table");
        if (root) {
          const obs = new MutationObserver(() => {
            document.querySelectorAll(ADR_ROW_SEL).forEach(ensureAdrlisteButton);
          });
          obs.observe(root, { subtree: true, childList: true });
        }
      }
    }
  });
})();

