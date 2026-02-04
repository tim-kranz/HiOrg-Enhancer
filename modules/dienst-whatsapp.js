(() => {
  "use strict";

  const MOD_ID = "dienstWhatsApp";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Dienste: WhatsApp-Button (Listen)",
    defaultEnabled: true,
    match: (loc) => loc && (loc.pathname === "/einteilung_dienst.php" || loc.pathname === "/einteilung_dienst_positionen.php"),
    run: ({ norm }) => {
      const DEFAULT_CC = "+49";
      const PHONE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
      const MAX_PARALLEL_FETCHES = 2;

      const LIST_ROOT_SELS = ["#et_helferlisten", "#et_posbox_freie", "#et_posbox_fest", "#et_posbox_meld", "#et_posbox_abs", "#et_posbox_zu"];
      const BOX_SEL = "li[data-uid]";
      const AFTER_SEL = "img.btn_bemerkung.btn-icon-gly2-inline, img.btn_bemerkung.btn-icon-gly2";

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

        const m =
          html.match(/<input[^>]*\bid=["']handy["'][^>]*\bname=["']handy["'][^>]*\bvalue=["']([^"']*)["'][^>]*>/i) ||
          html.match(/<input[^>]*\bname=["']handy["'][^>]*\bvalue=["']([^"']*)["'][^>]*>/i);

        const raw = m ? norm(m[1]) : "";
        const phone = raw || null;

        cacheSet(cacheKey, phone);
        return phone;
      }

      function ensureButton(li) {
        if (li.querySelector(`.${WA_CLASS}`)) return;

        const anchor = li.querySelector(AFTER_SEL);
        if (!anchor) return;

        const uid = li.getAttribute("data-uid");
        if (!uid) return;

        const btn = document.createElement("span");
        btn.className = WA_CLASS;
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

        anchor.insertAdjacentElement("afterend", btn);

        limit(async () => {
          const phone = await fetchHandyFromAdresse(uid);
          const digits = phone ? toWhatsAppDigits(phone) : null;

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
      }

      function scanAndAttach() {
        for (const rootSel of LIST_ROOT_SELS) {
          const root = document.querySelector(rootSel);
          if (!root) continue;
          root.querySelectorAll(BOX_SEL).forEach(ensureButton);
        }
      }

      scanAndAttach();

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
    }
  });
})();
