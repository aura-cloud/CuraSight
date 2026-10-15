# CuraSight

## Files
- seed.js / run-seed.bat : load the Kaggle CSV into MongoDB Atlas (one time)
- server.js : Express API (POST /api/decode, GET /api/health)
- public/index.html : the UI, served by the server
- curasight-demo.html : old offline demo with 12 sample medicines

## Run the app (PowerShell, inside this folder)
1. npm install
2. $env:MONGO_URI="mongodb+srv://USER:PASSWORD@cluster0.zbuuq8u.mongodb.net/?appName=Cluster0"
3. npm start
4. Open http://localhost:3000 and click "Use sample"

Never share your real MONGO_URI.

## Next: image reading (OpenCV pre-processing + Tesseract.js + verification step)

## Authentication and user history
- `public/auth.html` : separate login / sign-up page
- `/api/signup`, `/api/login`, `/api/logout`, `/api/me` : account/session endpoints
- `/api/decode` and `/api/suggest` require an authenticated session
- Each decoded prescription is stored in the MongoDB `history` collection under the logged-in user's ID
- The History button in the app shows only that user's previous prescriptions

The account password is stored as a salted `scrypt` hash; the browser receives an HTTP-only session cookie. No raw password is stored.

For deployment, use HTTPS so the session cookie is also marked `Secure` (`NODE_ENV=production`).

## Pharmacies near me (live location)
- `GET /api/pharmacies?lat&lon&r` and `GET /api/geocode?q` : login required, 20 requests/min per IP
- Data comes from OpenStreetMap (free, no key, needs internet; coverage varies by area). Jan Aushadhi Kendras are marked when found.
- The browser location (live, updates after ~250 m of movement) is only used to look up shops and is never stored.
- Browsers allow live location only on `localhost` or HTTPS.

## Medicine schedule and reminders
- `schedule.js` reads the directions on each prescription line (twice daily, 1-0-1, before food, x 5 days, SOS...). Plain text rules, no AI.
- After decoding, a schedule card lets the user correct times, days and food notes, then download a calendar file (.ics) with alarms.
- Optional browser reminders work only while CuraSight is open in a tab; they are cleared on logout.

## Pages (all need login; each page has the same top menu linking back to Home)
- `/` Home: upload or type a prescription and decode it. After decoding, links lead to Schedule, Pharmacies and History.
- `/pharmacies.html` Pharmacies near the user (live location or searched area)
- `/schedule.html` Medicine schedule and calendar reminders for a chosen prescription (`?h=<history id>` opens a specific one)
- `/history.html` Previous prescriptions: View (opens it on Home), Schedule, Delete, Clear all
- `public/common.js` shared login check, menu, language switch and device reminders; `public/app.css` shared styles
- History API: `DELETE /api/history/:id` and `DELETE /api/history` were added; `/api/decode` now also returns `historyId`.

## Savings, report, account and better photo reading
- `/savings.html` Savings dashboard (totals, by month, biggest savings). API: `GET /api/stats`. "Save this page as PDF" uses the browser print dialog.
- `/report.html?h=<history id>` Printable prescription report (choose "Save as PDF" in the print window). Linked from Home (after decoding) and History.
- `/account.html` Change name, change password (signs out other devices), delete account and all history. API: `POST /api/account/name`, `POST /api/account/password`, `DELETE /api/account` (5 wrong passwords per 15 min per user).
- Photo reading (Home): rotate button, two clean-up passes (contrast + local black/white) and the better read is kept, text tidy-up (O/0, l/1, Tab/Cap/Syp prefixes), clinic/address lines left out (with a "show all lines" switch), hard-to-read lines listed. Tesseract.js 5.1.1 is downloaded from jsDelivr on first use, so the first read needs internet. Handwriting is still not reliable.
