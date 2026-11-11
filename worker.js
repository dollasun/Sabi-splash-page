// Cloudflare Worker entry for getsabi.ng.
// Routes POST /api/waitlist to the Brevo function in functions/api/waitlist.js
// (written as a Pages Function, reused here unchanged). Everything else is a static file.
import { onRequestPost } from "./functions/api/waitlist.js";

const json = (body, status, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/waitlist") {
      if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
      try {
        return await onRequestPost({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (err) {
        console.log("waitlist error", err && err.message);
        return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
      }
    }

    if (pathname.startsWith("/api/")) return json({ ok: false, error: "Not found." }, 404);

    return env.ASSETS.fetch(request);
  },
};
