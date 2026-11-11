// Cloudflare Pages Function: POST /api/waitlist
// Saves the signup to a Brevo list and emails you a notification.
//
// Environment variables (Cloudflare > your Pages project > Settings > Variables and Secrets):
//   BREVO_API_KEY   (Secret)    your Brevo API key
//   BREVO_LIST_ID   (Text)      numeric ID of your "Sabi Waitlist" list, e.g. 3
//   NOTIFY_EMAIL    (Text)      the inbox that should receive new-signup alerts
//   SENDER_EMAIL    (Text)      a verified Brevo sender, e.g. hello@getsabi.ng

const BREVO = "https://api.brevo.com/v3";

// Must match the <option>s in index.html exactly
const AREAS = [
  "Ikeja", "Lekki", "Victoria Island", "Ikoyi", "Yaba", "Surulere", "Ajah",
  "Gbagada", "Festac", "Ikorodu", "Other Lagos area", "Outside Lagos",
];

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // Honeypot: real users never fill this hidden field. Bots do.
  if (data.company) return json({ ok: true });

  const email = String(data.email || "").trim().toLowerCase();
  const area = String(data.area || "").trim();
  const firstName = String(data.first_name || "").trim().slice(0, 60);
  const whatsapp = normalizeNigerianPhone(data.whatsapp);
  const consent = data.consent === true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return json({ ok: false, field: "email", error: "Please enter a valid email." }, 400);
  }
  if (!AREAS.includes(area)) {
    return json({ ok: false, field: "area", error: "Please choose your area." }, 400);
  }
  if (data.whatsapp && !whatsapp) {
    return json({ ok: false, field: "phone", error: "Please enter a valid Nigerian number, e.g. 0801 234 5678." }, 400);
  }
  if (!consent) {
    return json({ ok: false, field: "consent", error: "Please confirm you're 18 or older to join." }, 400);
  }

  const headers = {
    "api-key": env.BREVO_API_KEY,
    "content-type": "application/json",
    accept: "application/json",
  };

  // 1) Create or update the contact in Brevo and add to the waitlist
  const attributes = {
    FIRSTNAME: firstName || undefined,
    AREA: area,
    WHATSAPP: whatsapp || undefined,
    CONSENT_18_CONTACT: true,
    CONSENT_AT: new Date().toISOString(),
    SIGNUP_SOURCE: "getsabi.ng waitlist",
  };

  const contactRes = await fetch(`${BREVO}/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      attributes,
      listIds: [Number(env.BREVO_LIST_ID)],
      updateEnabled: true, // re-submissions update instead of failing
    }),
  });

  if (!contactRes.ok) {
    const detail = await contactRes.text();
    console.log("Brevo contact error", contactRes.status, detail);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 502);
  }

  // 2) Notify your inbox (failure here should not fail the signup)
  try {
    await fetch(`${BREVO}/smtp/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender: { name: "sabi. waitlist", email: env.SENDER_EMAIL },
        to: [{ email: env.NOTIFY_EMAIL }],
        replyTo: { email },
        subject: `New waitlist signup: ${area}`,
        htmlContent: `
          <h3>New sabi. waitlist signup</h3>
          <p><b>Email:</b> ${esc(email)}<br>
          <b>Area:</b> ${esc(area)}<br>
          <b>First name:</b> ${esc(firstName || "-")}<br>
          <b>WhatsApp:</b> ${esc(whatsapp || "-")}<br>
          <b>Time:</b> ${new Date().toISOString()}</p>`,
      }),
    });
  } catch (e) {
    console.log("Notify email failed", e);
  }

  return json({ ok: true });
}

// Converts 0801 234 5678 / 801... / 234801... / +234801... into +2348012345678
function normalizeNigerianPhone(raw) {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[789]\d{9}$/.test(d) ? `+234${d}` : "";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
