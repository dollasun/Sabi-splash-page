# sabi. — early-access splash page

A mobile-first, static splash page for **sabi.** with one Vercel serverless function for waitlist sign-ups.

```
index.html        page markup
styles.css        mobile-first styles (phones first, then ≥560 / ≥760 / ≥900px)
main.js           smooth scroll, menu, reveals, FAQ, join modal + form
api/waitlist.js   validates sign-ups and forwards them to your storage
assets/           hero photo, video poster, walkthrough video, favicon
```

No build step and no dependencies.

## Saving sign-ups (important)

`/api/waitlist` validates each sign-up server-side, then POSTs it as JSON to the URL in the
**`WAITLIST_WEBHOOK_URL`** environment variable. **Until that variable is set, sign-ups are accepted but not stored anywhere.**

Any endpoint that accepts a JSON POST works, for example a Google Apps Script web app that appends to a Sheet, a Zapier/Make webhook, or Formspree.

Set it in Vercel → Project → Settings → Environment Variables, then redeploy:

```
vercel env add WAITLIST_WEBHOOK_URL production
vercel --prod
```

Payload sent to the webhook:

```json
{
  "email": "ada@example.com",
  "area": "Lekki",
  "first_name": "Ada",
  "whatsapp": "+2348012345678",
  "age_confirmed": true,
  "submitted_at": "2026-11-07T05:02:04.720Z",
  "source": "sabi-splash"
}
```

## Editing

- Colours and type: CSS variables at the top of `styles.css`.
- Area list: update both the `<select>` in `index.html` and `AREAS` in `api/waitlist.js`.
- First name and WhatsApp are optional. To make one required, add a check in `main.js` (`checks`) and `api/waitlist.js`.

## Local preview

`vercel dev` serves the page and the API together.
