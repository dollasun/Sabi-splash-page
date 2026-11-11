// Vercel serverless function: receives early-access sign-ups.
// Validates server-side, then forwards the sign-up as JSON to WAITLIST_WEBHOOK_URL
// (Google Apps Script, Zapier, Make, Formspree, your own API...).
// If WAITLIST_WEBHOOK_URL is not set, the sign-up is NOT stored anywhere (see README).

const AREAS = new Set([
  "Ikeja", "Lekki", "Victoria Island", "Ikoyi", "Yaba", "Surulere", "Ajah",
  "Gbagada", "Festac", "Ikorodu", "Other Lagos area", "Outside Lagos",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same rules as functions/api/waitlist.js (Cloudflare):
// 0801 234 5678 / 801... / 234801... / +234801... -> +2348012345678
function normalizeNigerianPhone(raw) {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[789]\d{9}$/.test(d) ? `+234${d}` : "";
}

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Something went wrong. Please try again." });
  }

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (clean(body.company, 200)) return res.status(200).json({ ok: true });

  const email = clean(body.email, 254).toLowerCase();
  const area = clean(body.area, 40);
  const firstName = clean(body.first_name, 60);
  const rawPhone = clean(body.whatsapp, 20);
  const whatsapp = normalizeNigerianPhone(rawPhone);

  // Accepts both form scripts: waitlist-form.js sends `consent`, the older main.js sent `age_confirmed`
  const consent = body.consent === true || body.age_confirmed === true;

  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, field: "email", error: "Please enter a valid email." });
  if (!AREAS.has(area)) return res.status(400).json({ ok: false, field: "area", error: "Please choose your area." });
  if (rawPhone && !whatsapp) return res.status(400).json({ ok: false, field: "phone", error: "Please enter a valid Nigerian number, e.g. 0801 234 5678." });
  if (!consent) return res.status(400).json({ ok: false, field: "consent", error: "Please confirm you're 18 or older to join." });

  const signup = {
    email,
    area,
    first_name: firstName,
    whatsapp,
    age_confirmed: true,
    submitted_at: new Date().toISOString(),
    source: "sabi-splash",
  };

  const webhook = process.env.WAITLIST_WEBHOOK_URL;
  if (!webhook) {
    // No destination configured: do not log personal data.
    console.warn("[waitlist] WAITLIST_WEBHOOK_URL not set; sign-up was not stored.");
    return res.status(200).json({ ok: true, stored: false });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signup),
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`webhook status ${r.status}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[waitlist] forward failed:", err.message);
    return res.status(502).json({ error: "We couldn't save your details. Please try again in a moment." });
  }
}
