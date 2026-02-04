(() => {
  "use strict";

  const MOD_ID = "formulareWhatsApp";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Formulare: WhatsApp-Icon neben Nummern",
    defaultEnabled: true,
    pages: ["/formulare.php"],
    run: ({ norm }) => {
      const DEFAULT_CC = "+49";

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

      // konservativ für DE-Mobilnummern
      const PHONE_RX = /(?:(?:\+|00)\s*49|0)\s*(?:1[5-7]\d)\s*(?:[\d\s\/-]{5,})\d/g;

      function isInside(el, selector) {
        return !!(el && el.closest && el.closest(selector));
      }

      function buildButton(rawPhone) {
        const digits = toWhatsAppDigits(rawPhone);
        const btn = document.createElement("span");
        btn.className = WA_CLASS;
        btn.innerHTML = svgWhatsApp(!digits);

        if (digits) {
          btn.classList.add(WA_OK_CLASS);
          btn.title = `WhatsApp öffnen (${rawPhone})`;
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            window.open(`https://wa.me/${encodeURIComponent(digits)}`, "_blank", "noopener,noreferrer");
          });
        } else {
          btn.classList.add(WA_DISABLED_CLASS);
          btn.title = `Keine WhatsApp-geeignete Nummer (${rawPhone})`;
        }
        return btn;
      }

      function replacePhonesInTextNode(textNode) {
        const text = textNode.nodeValue || "";
        if (!PHONE_RX.test(text)) return;
        PHONE_RX.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let last = 0;
        let m;

        while ((m = PHONE_RX.exec(text)) !== null) {
          const start = m.index;
          const end = start + m[0].length;
          const rawPhone = norm(m[0]);

          if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));

          const phoneSpan = document.createElement("span");
          phoneSpan.textContent = text.slice(start, end);
          frag.appendChild(phoneSpan);
          frag.appendChild(buildButton(rawPhone));

          last = end;
        }

        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

        textNode.parentNode.replaceChild(frag, textNode);
      }

      function scan() {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              const p = node.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;

              if (isInside(p, "script,style,textarea,pre,code")) return NodeFilter.FILTER_REJECT;
              if (isInside(p, `.${WA_CLASS}`)) return NodeFilter.FILTER_REJECT;

              const t = (node.nodeValue || "").trim();
              if (!t) return NodeFilter.FILTER_REJECT;

              return PHONE_RX.test(t) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          }
        );

        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(replacePhonesInTextNode);
      }

      scan();

      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "childList" && (m.addedNodes?.length || 0) > 0) {
            scan();
            break;
          }
        }
      });
      obs.observe(document.body, { subtree: true, childList: true });
    }
  });
})();
