# Hosting on cPanel: what you need and how

## Read this first: what cPanel can and cannot do
Taprint has three parts. Only some fit shared hosting:

| Part | On cPanel (shared hosting) |
|---|---|
| React website (the screens) | Yes. It is just static files. |
| Laravel API + MySQL | Yes, if the host offers PHP 8.3+ and SSH/Terminal. |
| **Printing to the kiosk's printer** | **No.** A server in a data centre cannot reach a printer in your shop. |
| Word / Excel / PowerPoint to PDF | **Done in the customer's browser. Nothing to install on cPanel (no LibreOffice).** TXT is converted by PHP itself. |
| Combining several files into one | **Done in the customer's browser** (no `pdfunite`, `qpdf` or Ghostscript needed). |
| Poppler `pdftoppm` | Only the machine that actually prints needs it (the shop PC), not cPanel. |

So with the API on cPanel, payments, uploads (PDF, pictures, Word, Excel, PowerPoint, TXT) and pricing all work, but **nothing prints**
until you add a small "print agent" program on the kiosk PC that fetches paid jobs and prints them (not included yet).
Two setups that work today:

* **A. Everything on the kiosk PC (simplest, prints now).** Windows PC with Laragon/XAMPP (PHP 8.3, MySQL), Poppler,
  SumatraPDF (no LibreOffice needed). Phones reach it over the shop Wi-Fi, or from anywhere through a free Cloudflare Tunnel. You may still host only the
  React website on cPanel.
* **B. API on a VPS (not shared cPanel) near the kiosk.** Still needs the print agent for the printer.

If you still want the API on cPanel, follow the steps below.

## What to enable / install on the cPanel account
1. **PHP 8.3 or newer**: cPanel → *MultiPHP Manager* (or *Select PHP Version*) → pick 8.3+ for the API domain.
2. **PHP extensions** (same screen, tick them): `pdo_mysql`, `mbstring`, `fileinfo`, `iconv`, `dom` (xml), `curl`, `openssl`, `gd`, `zip`.
3. **Allowed functions**: `proc_open` must NOT be in the disabled list (*MultiPHP INI Editor*, `disable_functions`). The app uses it to run the printer and Poppler on the machine that prints.
4. **MySQL**: cPanel → *MySQL Databases*: create a database, create a user, add the user to the database with ALL PRIVILEGES.
   cPanel prefixes names, e.g. `cpuser_printbuddy` and `cpuser_pbuser`.
5. **SSH / Terminal** access (cPanel → *Terminal*) and **Composer**. If Composer is missing, run composer on your own PC
   (`composer install --no-dev --optimize-autoloader` with PHP 8.3) and upload the finished `vendor/` folder.
6. **SSL**: *SSL/TLS Status* → run AutoSSL so both domains are https.
7. **No LibreOffice, `pdfunite`, `qpdf` or Ghostscript is needed.** Keep `CONVERSION_DRIVER=none` in `.env` (the default). Word, Excel and
   PowerPoint are turned into PDF in the customer's browser and files are combined there too. Old binary `.doc`/`.xls`/`.ppt` files
   are not supported: the customer is asked to save them as `.docx`/`.xlsx`/`.pptx` or PDF.

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
5. Razorpay webhook (now possible, you have a public https address): `https://api.yourdomain.com/api/v1/webhooks/razorpay`, events `qr_code.credited` and `order.paid`.
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
