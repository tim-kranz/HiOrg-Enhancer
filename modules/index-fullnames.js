(() => {
  "use strict";

  const MOD_ID = "indexFullNames";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Namen",
    defaultEnabled: true,
    pages: ["/index.php"],
    run: ({ norm }) => {
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

        if (txt.includes(" ")) return false; // schon Vollname
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
  });
})();
