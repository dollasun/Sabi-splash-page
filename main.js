/* sabi. splash page interactions */
(() => {
  "use strict";

  const CONFIG = {
    // Where sign-ups are POSTed. The bundled Vercel function forwards them on (see README).
    signupEndpoint: "/api/waitlist",
    requestTimeoutMs: 15000,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = matchMedia("(min-width: 760px)");
  const raf = requestAnimationFrame;

  $("#yr").textContent = new Date().getFullYear();

  /* ---------------- Header state ---------------- */
  const header = $("#top-bar");
  const headerH = () => header.getBoundingClientRect().height;

  /* ---------------- Smooth scroll ---------------- */
  let scrollAnim = 0;
  const cancelScroll = () => { if (scrollAnim) { cancelAnimationFrame(scrollAnim); scrollAnim = 0; } };
  ["wheel", "touchstart", "keydown"].forEach(t => addEventListener(t, cancelScroll, { passive: true }));

  // Gentle S-curve: slow start, long glide, soft landing
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function scrollToTarget(target, onDone) {
    cancelScroll();
    const maxY = document.documentElement.scrollHeight - innerHeight;
    const y = target.id === "top" ? 0
      : Math.min(maxY, Math.max(0, target.getBoundingClientRect().top + scrollY - headerH() + 1));
    const startY = scrollY;
    const dist = y - startY;
    if (reduceMotion.matches || Math.abs(dist) < 2) {
      scrollTo(0, y);
      onDone && onDone();
      return;
    }
    const duration = Math.min(2400, Math.max(1100, 900 + Math.abs(dist) * 0.55));
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / duration);
      scrollTo(0, startY + dist * easeInOutCubic(p));
      if (p < 1) scrollAnim = raf(step);
      else { scrollAnim = 0; onDone && onDone(); }
    };
    scrollAnim = raf(step);
  }

  document.addEventListener("click", e => {
    const link = e.target.closest("a[data-scroll]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target, () => {
      // Move focus for keyboard + screen-reader users without a second jump
      if (id !== "top") {
        const heading = target.querySelector("h2") || target;
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    });
    history.replaceState(null, "", id === "top" ? location.pathname : "#" + id);
  });

  /* ---------------- Active nav + header border ---------------- */
  const navLinks = $$(".nav-link");
  const indicator = $(".nav-indicator");
  const sections = navLinks.map(a => document.getElementById(a.getAttribute("href").slice(1)));
  let ticking = false;
  let activeId = null;

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    let activeLink = null;
    navLinks.forEach(a => {
      const on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("active", on);
      if (on) { a.setAttribute("aria-current", "true"); activeLink = a; }
      else a.removeAttribute("aria-current");
    });
    if (activeLink) {
      indicator.style.width = activeLink.offsetWidth + "px";
      indicator.style.transform = `translateX(${activeLink.offsetLeft}px)`;
      indicator.style.opacity = "1";
    } else {
      indicator.style.opacity = "0";
    }
  }

  function onScroll() {
    ticking = false;
    header.classList.toggle("scrolled", scrollY > 8);
    const probe = innerHeight * 0.4;
    let current = null;
    sections.forEach(s => {
      if (!s) return;
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) current = s.id;
    });
    setActive(current);
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; raf(onScroll); } }, { passive: true });
  addEventListener("resize", () => { activeId = "__"; onScroll(); }, { passive: true });
  onScroll();

  /* ---------------- Reveal on scroll ---------------- */
  const revealEls = $$("[data-reveal]");
  // Stagger siblings that share a parent
  const groups = new Map();
  revealEls.forEach(el => {
    const g = groups.get(el.parentElement) || [];
    g.push(el);
    groups.set(el.parentElement, g);
  });
  groups.forEach(list => list.forEach((el, i) => el.style.setProperty("--d", `${Math.min(i, 6) * 0.08}s`)));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* ---------------- Walkthrough video: play when in view ---------------- */
  const video = $("#film");
  let userPaused = false;
  let autoPausing = false;
  if (video) {
    // The pause event fires asynchronously, so the flag is consumed inside the handler itself
    video.addEventListener("pause", () => {
      if (autoPausing) autoPausing = false;
      else userPaused = true;
    });
    video.addEventListener("play", () => { userPaused = false; });
    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting && !userPaused) {
          video.play().catch(() => {});
        } else if (!en.isIntersecting && !video.paused) {
          autoPausing = true;
          video.pause();
        }
      }, { threshold: 0.55 }).observe(video);
    }
  }

  /* ---------------- FAQ accordion ---------------- */
  $$(".qa-q").forEach(btn => {
    btn.addEventListener("click", () => {
      const qa = btn.closest(".qa");
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      qa.classList.toggle("open", open);
    });
  });

  /* ---------------- Join modal ---------------- */
  const modal = $("#join-modal");
  const panel = $(".modal-panel", modal);
  const form = $("#signup");
  const viewForm = $("#view-form");
  const viewDone = $("#view-done");
  const submitBtn = $("#f-submit");
  const field = id => document.getElementById(id);
  let lastOpener = null;
  let closing = false;
  let closeTimer = 0;
  let submitted = false;

  const supportsDialog = typeof modal.showModal === "function";

  function openModal(opener) {
    if (modal.open && !closing) return;
    clearTimeout(closeTimer);
    closing = false;
    lastOpener = opener || document.activeElement;
    cancelScroll();
    document.documentElement.classList.add("modal-open");
    modal.style.removeProperty("--drag");
    if (!modal.open) {
      if (supportsDialog) modal.showModal(); else modal.setAttribute("open", "");
    }
    // Focus something calm first; on desktop jump straight to the email field
    panel.scrollTop = 0;
    raf(() => raf(() => {
      modal.classList.add("is-open");
      if (!submitted && desktop.matches) field("f-email").focus({ preventScroll: true });
      else if (submitted) viewDone.focus({ preventScroll: true });
      else { panel.setAttribute("tabindex", "-1"); panel.focus({ preventScroll: true }); }
    }));
  }

  function finishClose() {
    modal.classList.remove("is-open", "dragging");
    modal.style.removeProperty("--drag");
    document.documentElement.classList.remove("modal-open");
    closing = false;
    if (modal.open) { if (supportsDialog) modal.close(); else modal.removeAttribute("open"); }
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal.open || closing) return;
    closing = true;
    modal.classList.remove("is-open", "dragging");
    modal.style.removeProperty("--drag");
    closeTimer = setTimeout(finishClose, reduceMotion.matches ? 0 : 480);
  }

  document.addEventListener("click", e => {
    const opener = e.target.closest("[data-open-join]");
    if (opener) { e.preventDefault(); openModal(opener); return; }
    if (e.target.closest("[data-close-join]")) { e.preventDefault(); closeModal(); }
  });
  // Esc: animate out instead of the browser's instant close
  modal.addEventListener("cancel", e => { e.preventDefault(); closeModal(); });
  // If the browser closes it anyway, tidy up
  modal.addEventListener("close", () => {
    clearTimeout(closeTimer);
    if (modal.classList.contains("is-open") || document.documentElement.classList.contains("modal-open")) {
      modal.classList.remove("is-open", "dragging");
      document.documentElement.classList.remove("modal-open");
      closing = false;
    }
  });
  if (!supportsDialog) {
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.open) closeModal(); });
  }

  // Swipe the sheet down to dismiss (phones)
  const grab = $(".modal-grab", modal);
  let dragStart = null;
  grab.addEventListener("pointerdown", e => {
    if (desktop.matches) return;
    dragStart = { y: e.clientY, t: performance.now() };
    modal.classList.add("dragging");
    grab.setPointerCapture(e.pointerId);
  });
  grab.addEventListener("pointermove", e => {
    if (!dragStart) return;
    const dy = Math.max(0, e.clientY - dragStart.y);
    modal.style.setProperty("--drag", dy + "px");
  });
  const endDrag = e => {
    if (!dragStart) return;
    const dy = Math.max(0, e.clientY - dragStart.y);
    const v = dy / Math.max(1, performance.now() - dragStart.t);
    dragStart = null;
    modal.classList.remove("dragging");
    if (dy > 120 || (dy > 30 && v > 0.6)) closeModal();
    else modal.style.removeProperty("--drag");
  };
  grab.addEventListener("pointerup", endDrag);
  grab.addEventListener("pointercancel", endDrag);

  /* ---------------- Form validation ---------------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normalisePhone(raw) {
    const d = raw.replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 11 && d[0] === "0") return "+234" + d.slice(1);
    if (d.length === 13 && d.startsWith("234")) return "+" + d;
    return null; // invalid
  }

  function setErr(input, errId, msg) {
    field(errId).textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  const checks = {
    "f-email": () => {
      const v = field("f-email").value.trim();
      return !v ? "Enter your email so we can reach you."
        : !EMAIL_RE.test(v) ? "Check your email address. It should look like name@example.com." : "";
    },
    "f-area": () => (field("f-area").value ? "" : "Choose your area so we know where to launch first."),
    "f-phone": () => (normalisePhone(field("f-phone").value) === null
      ? "Use a Nigerian number, like 0801 234 5678 or +234 801 234 5678." : ""),
    "f-consent": () => (field("f-consent").checked ? "" : "Please confirm you're 18 or older to join."),
  };
  const errIds = { "f-email": "e-email", "f-area": "e-area", "f-phone": "e-phone", "f-consent": "e-consent" };

  function validateField(id) {
    const msg = checks[id]();
    setErr(field(id), errIds[id], msg);
    return !msg;
  }

  function validateAll() {
    let firstBad = null;
    Object.keys(checks).forEach(id => { if (!validateField(id) && !firstBad) firstBad = field(id); });
    return firstBad;
  }

  // Re-check live once a field has been flagged; check on blur once the user has typed
  Object.keys(checks).forEach(id => {
    const el = field(id);
    const recheck = () => { if (el.getAttribute("aria-invalid") === "true") validateField(id); };
    el.addEventListener("input", recheck);
    el.addEventListener("change", recheck);
    if (id !== "f-consent" && id !== "f-area") {
      el.addEventListener("blur", () => { if (el.value.trim()) validateField(id); });
    }
  });

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
    submitBtn.setAttribute("aria-busy", String(on));
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    field("e-form").textContent = "";
    const bad = validateAll();
    if (bad) {
      bad.focus();
      if (!reduceMotion.matches) {
        submitBtn.classList.remove("shake");
        void submitBtn.offsetWidth;
        submitBtn.classList.add("shake");
      }
      return;
    }

    const firstName = field("f-name").value.trim();
    const payload = {
      email: field("f-email").value.trim().toLowerCase(),
      area: field("f-area").value,
      first_name: firstName,
      whatsapp: normalisePhone(field("f-phone").value) || "",
      age_confirmed: true,
      company: field("f-company").value, // honeypot
      submitted_at: new Date().toISOString(),
    };

    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs);
    try {
      const res = await fetch(CONFIG.signupEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let msg = "";
        try { msg = (await res.json()).error || ""; } catch {}
        throw new Error(msg || "server");
      }
      submitted = true;
      field("done-title").textContent = firstName ? `Thank you, ${firstName}.` : "Thank you.";
      viewForm.hidden = true;
      viewDone.hidden = false;
      panel.scrollTop = 0;
      viewDone.focus({ preventScroll: true });
    } catch (err) {
      field("e-form").textContent = err.name === "AbortError" || err.message === "server" || err instanceof TypeError
        ? "We couldn't save your details. Check your connection and try again."
        : err.message;
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  });
})();
