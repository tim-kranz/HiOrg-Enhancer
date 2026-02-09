(() => {
  "use strict";

  const MOD_ID = "indexToggleSections";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Index: Abschnitte einklappen",
    defaultEnabled: true,
    pages: ["/index.php"],
    run: ({ norm }) => {
      const SECTION_MARKER = "data-he-toggle-ready";
      const COLLAPSED_CLASS = "he-toggle-collapsed";
      const BTN_CLASS = "he-toggle-btn";

      if (!document.getElementById("he-toggle-style")) {
        const style = document.createElement("style");
        style.id = "he-toggle-style";
        style.textContent = `
.${BTN_CLASS}{
  margin-left:8px;
  font-size:12px;
  padding:2px 8px;
  border-radius:4px;
  border:1px solid rgba(0,0,0,.2);
  background:#f6f6f6;
  cursor:pointer;
}
.${BTN_CLASS}:hover{ background:#efefef; }
.${COLLAPSED_CLASS}{ display:none !important; }
        `;
        document.documentElement.appendChild(style);
      }

      const sections = [
        {
          heading: "Bitte machen Sie Angaben zu folgenden Diensten und Terminen:",
          matchContent: (el) => el && el.tagName === "FIELDSET",
          shouldStartCollapsed: (params) => !params.has("more_realzeit")
        },
        {
          heading: "Bitte Helferstunden eintragen:",
          matchContent: (el) => el && el.tagName === "TABLE",
          shouldStartCollapsed: () => true
        }
      ];

      function setCollapsed(content, button, collapsed) {
        content.classList.toggle(COLLAPSED_CLASS, collapsed);
        button.setAttribute("aria-expanded", String(!collapsed));
        button.textContent = collapsed ? "Ausklappen" : "Ausblenden";
      }

      function setupSection(headingEl, contentEl, config) {
        if (!headingEl || !contentEl) return;
        if (headingEl.getAttribute(SECTION_MARKER) === "1") return;
        headingEl.setAttribute(SECTION_MARKER, "1");

        const params = new URLSearchParams(window.location.search);
        const startCollapsed = config.shouldStartCollapsed
          ? config.shouldStartCollapsed(params)
          : true;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = BTN_CLASS;
        btn.setAttribute("aria-expanded", String(!startCollapsed));
        btn.textContent = startCollapsed ? "Ausklappen" : "Ausblenden";
        btn.addEventListener("click", () => {
          const collapsed = contentEl.classList.contains(COLLAPSED_CLASS);
          setCollapsed(contentEl, btn, !collapsed);
        });

        headingEl.appendChild(btn);
        setCollapsed(contentEl, btn, startCollapsed);
      }

      function apply() {
        const headings = Array.from(document.querySelectorAll("h3"));
        headings.forEach((heading) => {
          const headingText = norm(heading.textContent);
          const config = sections.find((section) => norm(section.heading) === headingText);
          if (!config) return;

          let next = heading.nextElementSibling;
          while (next && next.nodeType === 1 && !config.matchContent(next)) {
            next = next.nextElementSibling;
          }
          if (!next) return;

          setupSection(heading, next, config);
        });
      }

      apply();
    }
  });
})();
