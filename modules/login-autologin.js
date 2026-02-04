(() => {
  "use strict";

  const MOD_ID = "loginAutoLogin";

  window.HiOrgEnhancer?.registerModule({
    id: MOD_ID,
    name: "Login: Auto-Login (rkbn)",
    defaultEnabled: true,
    pages: ["/login.php"],
    run: ({ waitFor, sleep }) => {
      const OV = "rkbn";

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
        }
      })();
    }
  });
})();
