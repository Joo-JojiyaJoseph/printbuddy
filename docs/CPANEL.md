# Hosting on cPanel: what you need and how

## Read this first: what cPanel can and cannot do
Taprint has three parts. Only some fit shared hosting:

| Part | On cPanel (shared hosting) |
|---|---|
| React website (the screens) | Yes. It is just static files. |
| Laravel API + MySQL | Yes, if the host offers PHP 8.3+ and SSH/Terminal. |
| **Printing to the kiosk's printer** | **No.** A server in a data centre cannot reach a printer in your shop. |
| Word / Excel / PowerPoint / TXT conversion (LibreOffice) | Usually not installed on shared hosting. |
| PDF editing marks, combining files (Poppler `pdftoppm`, `pdfunite`; or `qpdf` / Ghostscript) | Often missing. Ask the host. |

So with the API on cPanel, payments, uploads of PDF/pictures and pricing work, but **nothing prints** and some file types are refused
until you add a small "print agent" program on the kiosk PC that fetches paid jobs and prints them (not included yet).
Two setups that work today:

* **A. Everything on the kiosk PC (simplest, prints now).** Windows PC with Laragon/XAMPP (PHP 8.3, MySQL), Poppler, LibreOffice,
  SumatraPDF. Phones reach it over the shop Wi-Fi, or from anywhere through a free Cloudflare Tunnel. You may still host only the
  React website on cPanel.
* **B. API on a VPS (not shared cPanel) near the kiosk.** Still needs the print agent for the printer.

If you still want the API on cPanel, follow the steps below.

## What to enable / install on the cPanel account
1. **PHP 8.3 or newer**: cPanel → *MultiPHP Manager* (or *Select PHP Version*) → pick 8.3+ for the API domain.
2. **PHP extensions** (same screen, tick them): `pdo_mysql`, `mbstring`, `fileinfo`, `iconv`, `dom` (xml), `curl`, `openssl`, `gd`, `zip`.
3. **Allowed functions**: `proc_open` must NOT be in the disabled list (*MultiPHP INI Editor*, `disable_functions`). The app uses it to run converters.
4. **MySQL**: cPanel → *MySQL Databases*: create a database, create a user, add the user to the database with ALL PRIVILEGES.
   cPanel prefixes names, e.g. `cpuser_printbuddy` and `cpuser_pbuser`.
5. **SSH / Terminal** access (cPanel → *Terminal*) and **Composer**. If Composer is missing, run composer on your own PC
   (`composer install --no-dev --optimize-autoloader` with PHP 8.3) and upload the finished `vendor/` folder.
6. **SSL**: *SSL/TLS Status* → run AutoSSL so both domains are https.
7. Ask your host if these exist: `pdftoppm`, `pdfunite` (package *poppler-utils*), `qpdf`, `soffice` (LibreOffice). Shared hosts rarely install them.
   If missing: set `CONVERSION_DRIVER=none` (Word/Excel/PowerPoint refused, PDF and pictures still work).

## Upload and configure the API
1. Create a sub-domain `api.yourdomain.com` (cPanel → *Domains*). **Set its document root to `printbuddy/backend/public`**
   (a folder next to `public_html`, not inside it) so `.env` and source code are never web-accessible.
2. Upload the `backend` folder to `~/printbuddy/backend` (File Manager or Git). Include `vendor/` if you built it locally.
3. In Terminal:
   ```
   cd ~/printbuddy/backend
   cp .env.example .env        # then edit it (below)
   composer install --no-dev --optimize-autoloader    # skip if you uploaded vendor/
   php artisan key:generate
   php artisan migrate --force --seed
   chmod -R 775 storage bootstrap/cache
   php artisan config:cache && php artisan route:cache
   ```
4. `.env` values:
   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_DATABASE=cpuser_printbuddy
   DB_USERNAME=cpuser_pbuser
   DB_PASSWORD=...
   CACHE_STORE=file
   SESSION_DRIVER=file
   QUEUE_CONNECTION=sync
   PAYMENT_PROVIDER=razorpay          # see docs/SETUP.md for keys
   RAZORPAY_KEY_ID=...  RAZORPAY_KEY_SECRET=...  RAZORPAY_WEBHOOK_SECRET=...
   CONVERSION_DRIVER=none             # unless soffice exists
   PRINT_DRIVER=file                  # cPanel cannot reach your printer
   ```
   After any `.env` change: `php artisan config:clear && php artisan config:cache`.
5. Razorpay webhook (now possible, you have a public https address): `https://api.yourdomain.com/api/v1/webhooks/razorpay`, event `qr_code.credited`.
6. No queue worker is needed (`QUEUE_CONNECTION=sync`). Expired files are cleaned lazily on requests.

## Upload the website
On your PC, in `frontend/`, create `.env.production`:
```
VITE_USE_MOCK=false
VITE_API_BASE=https://api.yourdomain.com/api/v1
```
then `npm install && npm run build`. Upload everything inside `frontend/dist/` to `public_html/` (the included `.htaccess` makes
page links like `/s/<code>/upload` work and adds browser security headers).

## Check it
* `https://api.yourdomain.com/up` shows OK.
* `https://yourdomain.com/kiosk` shows a QR code; scan it with a phone and upload a PDF.
* If you see a blank page or CORS error, `FRONTEND_URL` must exactly match the website address (https, no trailing slash).
