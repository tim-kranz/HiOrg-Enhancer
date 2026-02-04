// ==UserScript==
// @name         HiOrg Enhancer
// @namespace    https://tampermonkey.net/
// @version      1.3.0
// @description  index.php: ersetzt Kürzel durch Vollnamen; login.php: setzt OV=rkbn, erkennt Chrome-Autofill ohne Klick und submitted automatisch; einteilung_dienst.php: WhatsApp-Button pro Mitglied (Telefon aus adresse.php?user_id=...).
// @match        https://www.hiorg-server.de/index.php*
// @match        https://www.hiorg-server.de/login.php*
// @match        https://www.hiorg-server.de/einteilung_dienst.php*
// @match        https://www.hiorg-server.de/einteilung_dienst_positionen.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // =========================================================
  // Konfiguration
  // =========================================================
  const DEFAULT_CC = "+49";                 // bei führender "0" wird +49 angenommen
  const PHONE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 Tage
  const MAX_PARALLEL_FETCHES = 2;

  // =========================================================
  // Shared Helpers
  // =========================================================
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
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value: value ?? null }));
  } catch {}
}

// WhatsApp erwartet digits (ohne +) im Pfad: https://wa.me/<number>
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


  // =========================================================
  // Modul A: index.php – Vollnamen statt Kürzel
  // =========================================================
  function runIndexFullNames() {
    const STATUS_CELL_SELECTOR = [
      "td.et_vstatus_voll",
      "td.et_vstatus_neutral",
      "td.et_vstatus_bedarf_dringend",
      'td[class*="et_vstatus_"]'
    ].join(",");

    const DEBOUNCE_MS = 120;
    let timer = null;

    function flipNameOrder(title) {
      const t = norm(title);
      if (!t) return null;
      const parts = t.split(" ");
      if (parts.length < 2) return t;

      const lastName = parts[0];
      const firstName = parts.slice(1).join(" ");
      return norm(`${firstName} ${lastName}`);
    }

    function shouldProcessSpan(span) {
      const title = span.getAttribute("title");
      if (!title) return false;

      const txt = norm(span.textContent);
      if (!txt) return false;

      // schon Vollname?
      if (txt.includes(" ")) return false;

      const parts = norm(title).split(" ");
      return parts.length >= 2;
    }

    function replaceInCell(cell) {
      const spans = cell.querySelectorAll("span[title]");
      spans.forEach((sp) => {
        if (!shouldProcessSpan(sp)) return;

        const fullName = flipNameOrder(sp.getAttribute("title"));
        if (!fullName) return;

        if (!sp.dataset.hiorgShort) sp.dataset.hiorgShort = norm(sp.textContent);
        if (norm(sp.textContent) === fullName) return;

        sp.textContent = fullName;

        const originalTitle = sp.getAttribute("title");
        sp.setAttribute("title", `${originalTitle} (Kürzel: ${sp.dataset.hiorgShort})`);
      });
    }

    function apply() {
      document.querySelectorAll(STATUS_CELL_SELECTOR).forEach(replaceInCell);
    }

    function schedule() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(apply, DEBOUNCE_MS);
    }

    apply();

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          const target = m.target && m.target.nodeType === 1 ? m.target : null;

          const touchesStatusCell =
            (target && target.closest && target.closest(STATUS_CELL_SELECTOR)) ||
            [...(m.addedNodes || [])].some(
              (n) =>
                n.nodeType === 1 &&
                (n.matches?.(STATUS_CELL_SELECTOR) ||
                  n.querySelector?.(STATUS_CELL_SELECTOR) ||
                  n.closest?.(STATUS_CELL_SELECTOR))
            );

          if (touchesStatusCell) { schedule(); break; }
        } else if (m.type === "characterData") {
          const p = m.target && m.target.parentElement;
          if (p && p.closest && p.closest(STATUS_CELL_SELECTOR)) { schedule(); break; }
        }
      }
    });

    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }

  // =========================================================
  // Modul B: login.php – Auto-Login (rkbn) ohne Zusatzklick
  // =========================================================
  function runLoginAuto(ovValue) {
    const OV = ovValue;

    const SELECTORS = {
      plz: 'input#plz[name="plz"]',
      ovGoBtn: 'button[type="submit"][name="askforovsubmit"][value="1"]',
      form: 'form#loginform, form[name="login"]',
      user: 'input#username[name="username"]',
      pass: 'input#password[name="password"]',
      ov: 'input#ov[name="ov"]',
      loginBtn: 'button[type="submit"][name="submit"][value="Login"]'
    };

    function setNativeValue(input, value) {
      const last = input.value;
      const proto = Object.getPrototypeOf(input);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && typeof desc.set === "function") desc.set.call(input, value);
      else input.value = value;

      if (last !== value) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    function looksAutofilled(el) {
      try { return el.matches(":-webkit-autofill"); } catch { return false; }
    }

    function installAutofillDetector(onAutofill) {
      const style = document.createElement("style");
      style.textContent = `
@keyframes hiorgAutofillStart { from { opacity: 1; } to { opacity: 1; } }
input:-webkit-autofill { animation-name: hiorgAutofillStart; animation-duration: 0.01s; }
`;
      document.documentElement.appendChild(style);

      document.addEventListener("animationstart", (e) => {
        if (e.animationName !== "hiorgAutofillStart") return;
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (t.id === "username" || t.id === "password") onAutofill();
      }, true);
    }

    function submitLogin(form) {
      const btn = document.querySelector(SELECTORS.loginBtn);
      if (form && typeof form.requestSubmit === "function") { form.requestSubmit(btn || undefined); return true; }
      if (btn) { btn.click(); return true; }
      if (form) { form.submit(); return true; }
      return false;
    }

    async function step1_enterOvAndGo() {
      const plz = await waitFor(SELECTORS.plz);
      const btn = await waitFor(SELECTORS.ovGoBtn);
      if (!plz || !btn) return false;
      setNativeValue(plz, OV);
      btn.click();
      return true;
    }

    async function step2_waitAutofillAndSubmit() {
      const form = await waitFor(SELECTORS.form);
      const user = await waitFor(SELECTORS.user);
      const pass = await waitFor(SELECTORS.pass);
      const ov = await waitFor(SELECTORS.ov);
      if (!form || !user || !pass || !ov) return false;

      if ((ov.value || "").trim() !== OV) setNativeValue(ov, OV);

      let submitted = false;

      const trySubmit = () => {
        if (submitted) return;

        const userOk = (user.value || "").trim().length > 0 || looksAutofilled(user);
        const passOk = (pass.value || "").trim().length > 0 || looksAutofilled(pass);

        if (userOk && passOk) {
          user.focus(); pass.focus(); pass.blur(); user.blur();
          submitted = submitLogin(form);
        }
      };

      installAutofillDetector(() => {
        setTimeout(trySubmit, 50);
        setTimeout(trySubmit, 250);
      });

      const end = Date.now() + 30000;
      while (!submitted && Date.now() < end) {
        trySubmit();
        await sleep(200);
      }

      return submitted;
    }

    (async () => {
      const url = new URL(location.href);

      if (url.pathname === "/login.php" && !url.searchParams.has("ov")) {
        await step1_enterOvAndGo();
        return;
      }

      if (url.pathname === "/login.php" && url.searchParams.get("ov") === OV) {
        await step2_waitAutofillAndSubmit();
        return;
      }
    })();
  }

  // =========================================================
  // Modul C: einteilung_dienst.php – WhatsApp Button pro Mitglied
  // =========================================================
  function runDienstWhatsAppButtons() {


    // Ziel: in jeder .et_helferbox nach dem .btn_bemerkung ein WA-Icon einhängen
const LIST_ROOT_SELS = ["#et_helferlisten", "#et_posbox_freie", "#et_posbox_fest", "#et_posbox_meld", "#et_posbox_abs", "#et_posbox_zu"];
const BOX_SEL = "li[data-uid]";
const AFTER_SEL = "img.btn_bemerkung.btn-icon-gly2-inline, img.btn_bemerkung.btn-icon-gly2";

    const WA_CLASS = "hiorg-wa-btn";
    const WA_DISABLED_CLASS = "hiorg-wa-disabled";
    const WA_OK_CLASS = "hiorg-wa-ok";

    // Simple Styles (kein Farbzwang, nutzt currentColor)
    const style = document.createElement("style");
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
.${WA_DISABLED_CLASS}{
  cursor:not-allowed;
  opacity:.45;
}
.${WA_OK_CLASS}{
  color:#1fa855; /* grün */
}
`;
    document.documentElement.appendChild(style);


function svgWhatsApp(disabled) {
  return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="16" height="16"
     fill="currentColor"
     viewBox="0 0 16 16"
     style="${disabled ? 'opacity:.45' : ''}">
  <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
</svg>`;
}

    // Concurrency limiter (sehr klein, reicht)
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

      // same-origin fetch, Cookies werden mitgesendet
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        cacheSet(cacheKey, null);
        return null;
      }

      const html = await resp.text();

      // robust: input id="handy" name="handy" value="..."
      const m = html.match(/<input[^>]*\bid=["']handy["'][^>]*\bname=["']handy["'][^>]*\bvalue=["']([^"']*)["'][^>]*>/i)
             || html.match(/<input[^>]*\bname=["']handy["'][^>]*\bvalue=["']([^"']*)["'][^>]*>/i);

      const raw = m ? norm(m[1]) : "";
      const phone = raw || null;

      cacheSet(cacheKey, phone);
      return phone;
    }

    function ensureButton(li) {
      // schon vorhanden?
      if (li.querySelector(`.${WA_CLASS}`)) return;

      const anchor = li.querySelector(AFTER_SEL);
      if (!anchor) return;

      const uid = li.getAttribute("data-uid");
      if (!uid) return;

      const btn = document.createElement("span");
      btn.className = WA_CLASS;
      btn.title = "WhatsApp öffnen";

      // initial: disabled (bis Nummer da ist)
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

      // Nummer laden (mit Limit)
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

// initial
scanAndAttach();

// Observer: beobachte alle Roots, die existieren
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


  // =========================================================
  // Router
  // =========================================================
  const path = location.pathname;

  if (path === "/index.php") {
    runIndexFullNames();
    return;
  }

  if (path === "/login.php") {
    runLoginAuto("rkbn");
    return;
  }

  if (path === "/einteilung_dienst.php") {
    runDienstWhatsAppButtons();
    return;
  }
  if (path === "/einteilung_dienst_positionen.php") {
  runDienstWhatsAppButtons();
  return;
  }
})();
