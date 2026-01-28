// ==UserScript==
// @name         HiOrg: Vollnamen (index.php) + Auto-Login (rkbn)
// @namespace    https://tampermonkey.net/
// @version      1.2.0
// @description  index.php: ersetzt Kürzel durch Vollnamen; login.php: trägt OV ein, klickt weiter, wartet auf Autofill und klickt Login.
// @match        https://www.hiorg-server.de/index.php*
// @match        https://www.hiorg-server.de/login.php
// @match        https://www.hiorg-server.de/login.php?ov=rkbn
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
  // Modul B: login.php – Auto-Login (rkbn)
  // =========================================================
  function runLoginAuto(ovValue) {
    const OV = ovValue;

    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    async function waitFor(selector, { timeoutMs = 15000, intervalMs = 200 } = {}) {
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

      // native setter versuchen
      const proto = Object.getPrototypeOf(input);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && typeof desc.set === "function") {
        desc.set.call(input, value);
      } else {
        input.value = value;
      }

      if (last !== value) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    function clickButtonByNameValue(name, value) {
      return document.querySelector(
        `button[type="submit"][name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
      );
    }

    async function step1_enterOvAndGo() {
      const plz = await waitFor('input[name="plz"]#plz');
      if (!plz) return;

      setNativeValue(plz, OV);

      const btn = clickButtonByNameValue("askforovsubmit", "1");
      if (btn) btn.click();
    }

    async function step2_waitAutofillAndLogin() {
      const password = await waitFor('input[type="password"]');
      if (!password) return;

      const userSelector =
        'input[type="text"], input[type="email"], input[name*="user" i], input[name*="login" i]';

      const end = Date.now() + 30000;
      while (Date.now() < end) {
        const user = Array.from(document.querySelectorAll(userSelector)).find(
          (el) => el.offsetParent !== null && !el.disabled && !el.readOnly
        );

        const pwOk = password.value && password.value.length > 0;
        const userOk = user ? user.value && user.value.length > 0 : true;

        if (pwOk && userOk) {
          const loginBtn = clickButtonByNameValue("submit", "Login");
          if (loginBtn) loginBtn.click();
          return;
        }

        await sleep(300);
      }
    }

    (async () => {
      const url = new URL(location.href);

      if (url.pathname === "/login.php" && !url.searchParams.has("ov")) {
        await step1_enterOvAndGo();
        return;
      }

      if (url.pathname === "/login.php" && url.searchParams.get("ov") === OV) {
        await step2_waitAutofillAndLogin();
        return;
      }
    })();
  }

  // =========================================================
  // Router: je Seite das passende Modul starten
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
