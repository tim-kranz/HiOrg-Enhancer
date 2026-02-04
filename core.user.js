// ==UserScript==
// @name         HiOrg Enhancer lokal (fix)
// @namespace    https://tampermonkey.net/
// @version      1.3.1
// @description  index.php: ersetzt Kürzel durch Vollnamen; login.php: setzt OV=rkbn, erkennt Chrome-Autofill ohne Klick und submitted automatisch.
// @match        https://www.hiorg-server.de/index.php*
// @match        https://www.hiorg-server.de/login.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

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

    function norm(s) {
      return (s || "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

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

          if (touchesStatusCell) {
            schedule();
            break;
          }
        } else if (m.type === "characterData") {
          const p = m.target && m.target.parentElement;
          if (p && p.closest && p.closest(STATUS_CELL_SELECTOR)) {
            schedule();
            break;
          }
        }
      }
    });

    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  // =========================================================
  // Modul B: login.php – Auto-Login (rkbn) ohne Zusatzklick
  // =========================================================
  function runLoginAuto(ovValue) {
    const OV = ovValue;

    const SELECTORS = {
      // Step 1 (OV/PLZ Seite)
      plz: 'input#plz[name="plz"]',
      ovGoBtn: 'button[type="submit"][name="askforovsubmit"][value="1"]',

      // Step 2 (Login Form)
      form: 'form#loginform, form[name="login"]',
      user: 'input#username[name="username"]',
      pass: 'input#password[name="password"]',
      ov: 'input#ov[name="ov"]',
      loginBtn: 'button[type="submit"][name="submit"][value="Login"]'
    };

    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    async function waitFor(selector, { timeoutMs = 15000, intervalMs = 100 } = {}) {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const el = document.querySelector(selector);
        if (el) return el;
        await sleep(intervalMs);
      }
      return null;
    }

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
      try {
        return el.matches(":-webkit-autofill");
      } catch {
        return false;
      }
    }

    function installAutofillDetector(onAutofill) {
      const style = document.createElement("style");
      style.textContent = `
@keyframes hiorgAutofillStart { from { opacity: 1; } to { opacity: 1; } }
input:-webkit-autofill { animation-name: hiorgAutofillStart; animation-duration: 0.01s; }
`;
      document.documentElement.appendChild(style);

      document.addEventListener(
        "animationstart",
        (e) => {
          if (e.animationName !== "hiorgAutofillStart") return;
          const t = e.target;
          if (!(t instanceof HTMLInputElement)) return;
          if (t.id === "username" || t.id === "password") onAutofill();
        },
        true
      );
    }

    function submitLogin(form) {
      const btn = document.querySelector(SELECTORS.loginBtn);

      if (form && typeof form.requestSubmit === "function") {
        form.requestSubmit(btn || undefined);
        return true;
      }
      if (btn) {
        btn.click();
        return true;
      }
      if (form) {
        form.submit();
        return true;
      }
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
          user.focus();
          pass.focus();
          pass.blur();
          user.blur();
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

      // Step 1: /login.php (ohne ov) -> OV setzen + weiter
      if (url.pathname === "/login.php" && !url.searchParams.has("ov")) {
        await step1_enterOvAndGo();
        return;
      }

      // Step 2: /login.php?ov=rkbn -> Autofill erkennen + submitten
      if (url.pathname === "/login.php" && url.searchParams.get("ov") === OV) {
        await step2_waitAutofillAndSubmit();
        return;
      }
    })();
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
})();
