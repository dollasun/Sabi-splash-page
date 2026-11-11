// sabi. waitlist: sends the #signup form to /api/waitlist (Cloudflare Function -> Brevo).
// Built for the markup in index.html. Load it BEFORE main.js:
//   <script src="/waitlist-form.js" defer></script>
//   <script src="/main.js" defer></script>
//
// It listens on document in the capture phase, so it runs first and stops any
// older submit handler in main.js from also firing. main.js keeps handling the
// modal open/close, FAQ, animations, etc.

(function () {
  const $ = (id) => document.getElementById(id);
  const ERR = { email: "e-email", area: "e-area", phone: "e-phone", consent: "e-consent" };
  const INPUT = { email: "f-email", area: "f-area", phone: "f-phone", consent: "f-consent" };

  function clearErrors() {
    Object.values(ERR).concat("e-form").forEach((id) => { const el = $(id); if (el) el.textContent = ""; });
    Object.values(INPUT).forEach((id) => { const el = $(id); if (el) el.removeAttribute("aria-invalid"); });
  }

  function showError(field, msg) {
    const el = $(ERR[field] || "e-form");
    if (el) el.textContent = msg;
    const input = $(INPUT[field]);
    if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); }
  }

  function validate(p) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return ["email", "Please enter a valid email."];
    if (!p.area) return ["area", "Please choose your area."];
    if (p.whatsapp) {
      const d = p.whatsapp.replace(/\D/g, "").replace(/^234/, "").replace(/^0/, "");
      if (!/^[789]\d{9}$/.test(d)) return ["phone", "Please enter a valid Nigerian number, e.g. 0801 234 5678."];
    }
    if (!p.consent) return ["consent", "Please confirm you're 18 or older to join."];
    return null;
  }

  function setBusy(btn, busy) {
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
    btn.classList.toggle("is-loading", busy);
  }

  function showDone(name) {
    if (name) $("done-title").textContent = `Thank you, ${name}.`;
    $("view-form").hidden = true;
    const done = $("view-done");
    done.hidden = false;
    done.focus();
  }

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!form || form.id !== "signup") return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const btn = $("f-submit");
    if (btn.disabled) return; // block double taps

    const fd = new FormData(form);
    const payload = {
      email: String(fd.get("email") || "").trim(),
      area: String(fd.get("area") || ""),
      first_name: String(fd.get("first_name") || "").trim(),
      whatsapp: String(fd.get("whatsapp") || "").trim(),
      consent: $("f-consent").checked,
      company: String(fd.get("company") || ""),
    };

    clearErrors();
    const bad = validate(payload);
    if (bad) return showError(bad[0], bad[1]);

    setBusy(btn, true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        form.reset();
        showDone(payload.first_name);
      } else {
        showError(out.field, out.error || "Something went wrong. Please try again.");
      }
    } catch {
      showError(null, "Connection problem. Please check your internet and try again.");
    } finally {
      setBusy(btn, false);
    }
  }, true);

  // Reset the modal to the form view each time it closes, so it's ready for reuse
  const modal = $("join-modal");
  if (modal) modal.addEventListener("close", () => {
    $("view-form").hidden = false;
    $("view-done").hidden = true;
    $("done-title").textContent = "Thank you.";
    clearErrors();
  });
})();
