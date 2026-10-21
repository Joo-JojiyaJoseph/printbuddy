# Admin panel

Open `/admin` (for example `http://localhost:5173/admin`). Staff sign in with an e-mail and password.

## 1. The first admin comes from the seeder
Put your login in `backend/.env`, then seed:
```
ADMIN_NAME=Your Name
ADMIN_EMAIL=you@yourshop.com
ADMIN_PASSWORD=choose-a-long-password      # 10+ characters
```
```
cd backend
php artisan migrate --seed
```
- The seeder creates this admin once. Running it again never changes an existing account's password.
- If `ADMIN_PASSWORD` is empty, local development uses `admin@taprint.test` / `Taprint@2026` (printed when seeding). **In production nothing is created** until you set a password.
- Forgot the password or need another account? `php artisan admin:create someone@shop.com --role=operator` (also resets a password when the e-mail exists).

Roles: **admin** (everything), **operator** (retry prints, cancel unpaid orders, re-check payments, test print, end sessions), **viewer** (read only).
The same command resets a password: run it again with the same e-mail. More staff can be added later in **Staff**.

The frontend must talk to the real API: in `frontend/.env` set `VITE_USE_MOCK=false` (and `VITE_API_BASE` if the API is on another address).
Without that the panel runs on built-in demo data (`admin@taprint.test` / `demo-password`), which is handy for trying the screens.

## 2. What each screen does
| Screen | Use |
|---|---|
| Dashboard | Today's revenue and orders, warnings (failed prints, payments to review, sandbox payments, LibreOffice missing, only when `CONVERSION_DRIVER=libreoffice`) |
| Orders | Search/filter every order; open one to see settings and payments; **Retry print** after a failed print; cancel an unpaid order |
| Payments | Payment list; **Re-check** asks the provider for the real status. There is no "mark as paid" button on purpose |
| QR sessions | See and end customer sessions |
| Printer & kiosks | Printer health (driver, Poppler, printer found), pick the printer by name, **Print test page**, last-24h print counts, recent failures; add/switch off kiosks and copy each kiosk's link |
| Payment gateway | Razorpay keys, webhook secret, connection test (admin only) |
| Reports | Revenue per day chart, totals, breakdown by paper, colour and kiosk, **CSV download** of paid orders |
| Pricing | Price per side for each paper and colour, double-sided discount, service fee, tax (admin only) |
| Settings | Upload limits, session and payment time, file retention, accepted file types, paper sizes (admin only) |
| Staff | Add, edit, remove staff; changing a role or password signs that person out (admin only) |
| Activity log | Who changed what (passwords, tokens and payment keys are never logged) |

## 3. Payment gateway and printer: set up in the panel, no `.env` editing
**Payment gateway** (admin only): choose Razorpay, paste the Key ID and Key Secret, press *Generate* for the webhook secret, **Save**, then **Test connection**.
The screen also shows the webhook URL and the events to tick (`qr_code.credited` for the UPI QR, `order.paid` for the card / netbanking window) for Razorpay's dashboard.
- Secrets are encrypted with the server's `APP_KEY` before they are stored and are never sent back to the browser: the screen only shows "saved". Type a new value to replace one; leave it empty to keep it.
- Razorpay cannot be selected until the Key ID and Key Secret exist. The webhook secret is optional (see below).
- **Webhook secret:** Razorpay signs every webhook it sends with this text; the server checks the signature and ignores anything that does not match, so nobody can fake a "payment received" message. You make it up yourself, enter the same text here and in Razorpay's webhook form, and it is not the Key Secret. Skip it on a local PC: Razorpay cannot reach a local address anyway, and the customer's screen checks with Razorpay every few seconds.
- Changing `APP_KEY` makes saved secrets unreadable; enter them again.

**Printer** (*Printer & kiosks*): under *Connection settings* choose how the server prints (SumatraPDF on Windows, CUPS on Linux/macOS), paste the program paths if they are not found automatically, and pick the printer by name. **Print test page** confirms it.
Each path only accepts the expected program (`SumatraPDF`, `lp`, `pdftoppm`) as a full path to a file that exists.
The server must run on the computer the printer is attached to (or one that can see it as a network printer). A shared cPanel host cannot reach a USB printer.
"Sent" means the print system accepted the job; jams, empty trays and offline printers are not detected.

Anything left empty here falls back to `backend/.env`, so existing installs keep working. Values saved in the panel win over `.env`.

## 4. Kiosks
Each kiosk has a code. Open `/kiosk?k=CODE` full-screen on that kiosk's display (no `k` = the `demo` kiosk). The kiosk must exist in the database (the seeder creates `demo`).

## 5. Scanner
Customers scan with their phone camera and upload the photo. A USB/network scanner would need a small local program (WIA on Windows, SANE on Linux) that sends the scan to the site. That is **not** included.

## 6. API
All endpoints are under `/api/v1/admin` and need `Authorization: Bearer <token>` from `POST /login`:
`/me, /dashboard, /orders, /payments, /sessions, /kiosks, /printer (GET/PUT), /printer/test, /reports/sales, /reports/orders.csv, /pricing, /settings, /integrations, /users, /audit`.

## Setting up a shop PC: Download setup
On a kiosk row (Printer & kiosks) or its detail page click **Download setup**: you get a zip with the print program and a ready `config.json` (server address and that kiosk's new print key). Unzip it on the shop PC and run `install-agent.bat`. Keep the zip private; it contains the key.

## Kiosks: details, orders and payments per kiosk
**Kiosks** (sidebar) lists every kiosk with today's sessions, paid orders, revenue and whether its shop PC is ready to print. Open a kiosk to see
revenue (today, 7 days, all time), sessions, orders, printed / failed counts and its latest orders and payments, with **View all** links that open
the Orders or Payments page already filtered to that kiosk. Orders and Payments also have a **Kiosk** filter, and Payments shows a Kiosk column.
