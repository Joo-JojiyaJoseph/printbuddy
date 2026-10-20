# Setup guide: MySQL, cache fix, and receiving payments

## 1. Why you saw "database is locked"
SQLite allows one writer at a time. Laravel's rate limiter writes to the **cache** on every request, so with
`CACHE_STORE=database` on SQLite two requests collide. Two fixes, do both:

1. Use **MySQL** (below). 
2. Keep the cache and sessions out of the database: in `backend/.env` set
   `CACHE_STORE=file`, `SESSION_DRIVER=file`, `QUEUE_CONNECTION=sync`.

## 2. Switch to MySQL on Windows
1. Install MySQL (MySQL Installer, XAMPP or Laragon). Make sure it is running (port 3306).
2. Create the database and a user (MySQL Workbench, phpMyAdmin or the `mysql` command line):
   ```sql
   CREATE DATABASE printbuddy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'printbuddy'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
   GRANT ALL PRIVILEGES ON printbuddy.* TO 'printbuddy'@'localhost';
   FLUSH PRIVILEGES;
   ```
   (With XAMPP you may simply use user `root` with an empty password for a local test. Do not do that in production.)
3. Enable the PHP MySQL driver: open the `php.ini` that `php --ini` reports, make sure these lines have no `;` in front,
   then restart the terminal: `extension=pdo_mysql` and `extension=mbstring`.
4. Edit `backend/.env`:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=printbuddy
   DB_USERNAME=printbuddy
   DB_PASSWORD=choose-a-strong-password
   CACHE_STORE=file
   SESSION_DRIVER=file
   QUEUE_CONNECTION=sync
   ```
5. From `backend/` run:
   ```
   php artisan config:clear
   php artisan migrate --seed
   ```
   `--seed` creates the demo kiosk (default pricing comes from the migrations). Your old SQLite data is not copied (it was test data).
6. Restart `php artisan serve`.

If `migrate` says "could not find driver", step 3 was not applied to the php.ini that the command line uses.

## 3. Receiving payments into your account
The system does **not** store a UPI ID or a QR image of yours. A QR shown to a customer must be created for the exact amount of
*that* order, and the money must be confirmed by a payment provider, otherwise anyone could claim "I paid". So you connect a
payment gateway account; the gateway creates the QR and the money settles into **your bank account** (set in the gateway dashboard).

Built in: **Razorpay UPI QR**. You can enter the keys in the admin panel (**Admin → Payment gateway**, encrypted, no `.env` editing) or use `.env` as below; the panel wins when both are set.
1. Create a Razorpay account and complete KYC (business or individual). In *Settings → Bank account* add the bank account
   where you want the money. Razorpay settles to it.
2. Dashboard → *Account & Settings → API keys* → generate keys. Put them in `backend/.env` (never in the frontend, never in git):
   ```
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
   RAZORPAY_WEBHOOK_SECRET=a-long-random-string-you-choose
   ```
   Use `rzp_test_...` keys first to test.
3. QR Codes must be enabled on your Razorpay account (Razorpay support enables the UPI QR product for you if it is missing).
   The same keys also switch on the **Card, netbanking or wallet** button on the Pay page (Razorpay Checkout). For that, keep
   *Settings → Payment capture* on **automatic** in the Razorpay dashboard, otherwise payments stay "authorized" and the order is
   not marked paid.
4. Optional but recommended: Webhook. Dashboard → *Webhooks* → add `https://YOUR-PUBLIC-URL/api/v1/webhooks/razorpay`, secret =
   `RAZORPAY_WEBHOOK_SECRET`, events **qr_code.credited** and **order.paid**. This needs a public https address. On a kiosk PC without one,
   skip it: the customer's screen asks Razorpay directly every few seconds, and the order is marked paid only after Razorpay confirms
   the exact amount. (A tunnel such as Cloudflare Tunnel or ngrok gives you a public URL if you want webhooks.)
5. `php artisan config:clear`, restart the server, and make one real small payment to test.

While testing without Razorpay keep `PAYMENT_PROVIDER=fake`: it shows a sandbox QR and a "Customer pays" button. It is refused in production.

Why not just a personal UPI QR? A static UPI QR has no way for the server to know the payment happened, so the print would have to be
released by a person pressing "paid". If you want that mode anyway, it needs a staff-confirm screen; it is **not** included because it
breaks the rule that only verified payments release a print.

## 4. Printing on the kiosk PC
Set `PRINT_DRIVER=sumatra` and `SUMATRA_PATH=C:\Path\To\SumatraPDF.exe` (and `PRINTER_NAME` if not the default printer).
`PRINT_DRIVER=file` only saves the print-ready PDF to `storage/app/printed`.
