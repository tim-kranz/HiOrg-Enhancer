(() => {
  "use strict";

  const MOD_ID = "sessionKeepAlive";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Session: dauerhaft aktiv halten",
    defaultEnabled: true,
    match: () => true,
    run: () => {
      const BAR_SELECTOR = "#sessionTimeout-bar";
      const SAFE_REMAINING_SECONDS = 1700;
      const CHECK_INTERVAL_MS = 10000;

      function getRemainingSeconds(bar) {
        const ariaNow = Number(bar?.getAttribute("aria-valuenow"));
        if (Number.isFinite(ariaNow)) return ariaNow;

        const label = document.querySelector("#sessionTimeout-minutes")?.textContent || "";
        const minMatch = label.match(/(\d+)\s*min/i);
        if (minMatch) return Number(minMatch[1]) * 60;
        return null;
      }

      function keepAlive(bar) {
        if (!bar || !(bar instanceof HTMLElement)) return;

        const remaining = getRemainingSeconds(bar);
        if (remaining !== null && remaining >= SAFE_REMAINING_SECONDS) return;

        bar.click();
      }

      function setup(bar) {
        if (!bar || bar.dataset.heKeepAliveReady === "1") return;
        bar.dataset.heKeepAliveReady = "1";

        keepAlive(bar);
        window.setInterval(() => keepAlive(bar), CHECK_INTERVAL_MS);

        const observer = new MutationObserver(() => keepAlive(bar));
        observer.observe(bar, {
          attributes: true,
          attributeFilter: ["aria-valuenow", "title"]
        });
      }

      function apply() {
        const bar = document.querySelector(BAR_SELECTOR);
        if (bar) setup(bar);
      }

      apply();

      const rootObserver = new MutationObserver(() => apply());
      rootObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  });
})();
