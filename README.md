# Taprint: QR-based self-service printing

| Phase | Status |
|---|---|
| 1. Foundation (React/Vite/Tailwind, design system) | Done, tested, builds |
| 2. Backend logic and contract (migrations, pricing, state machine, OpenAPI) | Pricing/state logic tested; migrations syntax-checked only |
| 3. Customer interface (kiosk QR, upload, preview, print settings, quote, review) | Done against a mock API; 18 tests pass; builds |
| 4. Orders: server re-pricing, pricing snapshot, state machine | Done in mock + tested; PHP state machine tested |
| 5. UPI payment: QR, polling, signed-webhook handling, idempotency | Verification logic tested in PHP (15 checks) and mirrored in mock (10 tests); no real provider yet |
| 6+ Laravel controllers/queues, admin dashboard, real provider adapter | Not started |

## Run the frontend (no backend needed)
    cd frontend && npm install
    npm run dev        # open http://localhost:5173/kiosk, then open the QR link (or paste it in a 2nd tab)
    npm test           # 28 tests
    npm run build

`VITE_USE_MOCK=true` (default) uses `src/services/mockApi.js`, an in-browser stand-in that follows
`docs/openapi.yaml`. Set `VITE_USE_MOCK=false` once the Laravel API exists.

Mock limits: Office/TXT files report a conversion failure (conversion is a backend job);
PDFs and JPG/PNG preview. Prices shown are computed by a JS port of the PHP pricing service
(parity-tested against the same worked examples) and are labelled "Demo pricing" in the UI.

## Backend logic tests (no Composer needed)
    php backend/tests/run.php     # 37 checks: pricing, page ranges, order state machine, payment integrity

`backend/database/migrations/*` is syntax-checked only. Copy `backend/app` and `backend/database`
into a fresh `composer create-project laravel/laravel` app to continue.

## Payment integrity rules (enforced in backend/app/Services/Payments and mirrored in the mock)
- Webhooks need a valid HMAC-SHA256 signature over `{timestamp}.{body}` within a 5-minute window (replay block).
- The webhook body is only a hint about which payment to check. The order is marked paid only after a
  server-side provider lookup confirms success AND order reference, amount and currency match.
- Event ids are unique (idempotent); duplicates and already-paid orders are no-ops.
- Money for an expired/cancelled order is flagged for review instead of marking it paid.
- `PaymentProvider` and `PaymentStore` are interfaces: a Razorpay/Cashfree adapter and an Eloquent store
  (with DB transaction + row lock in `applyResult`) still need to be written.
- In the demo, the Pay page has a clearly labelled SANDBOX panel that drives the fake provider. It never
  sets an order's status directly.

## Known limitations
- Real PDF.js rendering and responsive layouts were not checked in a browser (none available in the build
  sandbox); only jsdom tests and a production build were run. Please try 360px, 768px and desktop widths.
- Printing has not been tried on a real printer (none in the build sandbox); see "Printing after payment".
- Lint: 0 errors, 6 warnings (fast-refresh export rule, set-state-in-effect).

## Editing before printing (Word, PDF, images)
Flow: Upload → **Edit** → Print settings → Review → Pay. The Edit step depends on the file:

| File | What the customer can do |
|---|---|
| Word, PDF, TXT, Excel, PowerPoint (as converted PDF) | Page strip with rotate, copy, add blank, move earlier/later, remove, undo/redo, position on paper (fit / centre / top-left / fill), empty-page hint |
| Word, PDF, TXT | **Edit text**: rich-text editor (bold, italic, underline, alignment, lists, size). Saving rebuilds a new print PDF; the original upload is never modified |
| JPG, PNG | 1/2/4/6 images per page, different images or copies of each image, fit or fill, margin, rotation, order, paper orientation |

- Edits travel as `settings.edits` (see `docs/openapi.yaml`). The server validates them against the real document
  (`PagePlan`) and derives the billable page count itself; `page_range` then selects among the output pages.
  Pages the customer adds as blanks are billed. A client cannot submit a page count or a price.
- Word: LibreOffice converts to HTML and back (`OfficeHtmlBridge`). **PDF text editing is lossy**: the text is read out
  of the PDF (`PdfTextExtractor`) and the pages are rebuilt from it, so pictures and exact layout are not kept, and
  scanned PDFs (no text) are refused with a clear message. Excel/PowerPoint get page edits only.
- All edited HTML passes a whitelist sanitiser (`HtmlSanitizer`: no scripts, handlers, external resources; only small
  inline images) before it is stored or given to LibreOffice, and is shown in a script-less sandboxed iframe.
- A document cannot be text-edited once it is part of a live order (409).

### Keep the original PDF design (in-place editing)
PDFs are **not rebuilt**. The **Annotate** tool adds marks on top of the untouched original page: *text*
(optionally with a white patch to replace old text), *cover* (white-out) and *highlight*. At print time the page is
rasterised at 300 dpi (Poppler) and the marks are drawn over it, so fonts, images and layout stay exactly as they were.
Limits: overlay text is Latin only (core Helvetica), text is horizontal, and the printed page is a 300 dpi image.
Marks never change the price. The old "Edit text" (rebuild) is kept for Word/TXT only.

### Extras
- **Page numbers and watermark** (Edit step): "n / total" at the bottom and a diagonal light-grey watermark on every page.
- **Savings tips** (Print settings): the server prices alternatives (both sides, black & white) and the customer
  can apply one with a tap. The price shown is always the server's.
- **Privacy auto-erase**: after a successful print the session's files are scheduled for deletion
  (`PRINT_ERASE_MINUTES`, default 10) and the confirmation page says so. Deletion happens lazily on the next
  request, so no scheduler or queue worker is needed.

### One phone per QR code
The first phone to scan owns the session (a random id stored in that phone's browser; only its hash is kept on the
server). Another phone opening the same code sees "This QR code is in use" (HTTP 423) until the session ends, expires
or is cancelled with **Cancel this session** on the kiosk screen (which then shows a fresh code). Run `php artisan migrate`.
Combining files uses `pdfunite` (Poppler), else `qpdf`, else Ghostscript; install any one of them on the kiosk PC.

## Security checklist (what is in place)
- **Sessions:** 48-character random token, only its SHA-256 is stored; time-limited; revocable; one phone per QR code (HTTP 423 for others).
- **Payments and prices:** decided by the server only; a client can never send a price or mark an order paid; webhooks are signature-checked.
- **Uploads:** type is detected from the file's content (not its name), size and count limits, conversion in a time-limited process with no shell.
- **Edited text** is passed through a whitelist HTML sanitiser and shown in a sandboxed iframe. Overlay marks are validated and clamped by the server.
- **Privacy:** files are scheduled for deletion after printing (`PRINT_ERASE_MINUTES`) and when a session expires.
- **API headers:** `nosniff`, no framing, `Content-Security-Policy: default-src 'none'`, `no-store`, HSTS over HTTPS (`SecurityHeaders` middleware).
- **Rate limits** on session creation, uploads, quotes, previews, webhooks and admin login.
- **Site headers (frontend):** set in `vite.config.js` (`npm run preview`) and `frontend/public/_headers`. For nginx add the same headers:
  `add_header Content-Security-Policy "default-src 'self'; script-src 'self'; ..." always;` (copy the value from `public/_headers`).
- **You must still do in production:** serve over HTTPS, `APP_DEBUG=false`, a strong `APP_KEY`, a real `PAYMENT` provider secret in `.env` (never in the frontend), restrict CORS to your site, and keep the database file outside the web root.
- The strict site CSP could not be tested in a real browser here; if a preview or PDF page is blocked after deploying, check the browser console for the blocked source and relax only that directive.

## Admin panel
Staff screens for orders, payments, printer, kiosks, reports, pricing and staff live at `/admin`. See [`docs/ADMIN.md`](docs/ADMIN.md) (the first admin is created by `php artisan db:seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`).

## Setup: MySQL, payments, printer
See [`docs/SETUP.md`](docs/SETUP.md) for MySQL on Windows, the "database is locked" fix, Razorpay keys and the QR, and printer settings.

Brand and logo: [`docs/BRAND.md`](docs/BRAND.md). See also [`docs/CPANEL.md`](docs/CPANEL.md) for hosting on cPanel (what it can and cannot do, required PHP extensions, step-by-step).

## Performance notes
* The website loads one screen at a time (route-level code splitting). The first page is about 35 kB gzipped of app code plus shared React; the 130 kB PDF engine downloads only when a PDF screen opens and is not preloaded.
* Pricing rates (including switched-off ones) are cached; quotes do not hit the database for rates.
* For production run `php artisan config:cache route:cache event:cache`, use `composer install --no-dev --optimize-autoloader`, enable PHP OPcache, and serve `frontend/dist` with gzip or brotli (the hashed `/assets/*` files can be cached for a year).

## Slides and handouts (pages per sheet)
Any document, including PowerPoint, can be printed **1, 2, 4, 6 or 9 pages per sheet** (Configure screen, "Pages per sheet").
The chosen pages (after the page range and any edits) are packed in reading order, each page fitted whole into its own box with a thin
outline; a landscape sheet puts 2 side by side, a portrait sheet stacks them. The live preview pages through the printed sheets.
Pricing is per printed side, so 10 slides at 2 per sheet cost 5 sides (server: `PrintPricingService`; `pages_per_sheet` in the quote).
The file that is printed is built by `PrintFileComposer` (needs Poppler `pdftoppm`, like other edits). Images keep their own layout editor.
The smart assistant suggests "2 per sheet" for wide, slide-like documents.

## Smart features (on-device, no AI account needed)
- **Smart assistant** (Print options step): looks at a few pages of the document on the customer's phone and offers one-tap
  suggestions: black & white when no colour is found (or colour when a B/W choice would grey out charts or photos), and
  landscape/portrait when the pages are wide/tall. Every suggestion has a "Why?" pop-up. The check uses simple pixel analysis in
  the browser (`utils/analyze.js`); **nothing is sent to any AI service**, and the server still decides the price.
- **Savings tips** (server-priced), **page numbers and watermark**, **privacy auto-erase**, **one phone per QR code** and **End session**.
- **UI:** glass cards, animated gradients, a pop-up preview for uploaded files, confirmation pop-ups, and a success animation with
  confetti. Motion is switched off automatically for people who ask their device for reduced motion.
- A real language-model feature (for example "describe what you want to print") would need a server-side API key kept in `.env`
  and a privacy review of sending customers' documents to a third party. It is deliberately not included.

## Troubleshooting uploads and previews
- **No queue worker is needed.** Files are prepared inside the upload request (Word/Excel/PowerPoint can take up to a
  minute the first time while LibreOffice starts) and printing runs right after the payment is verified. Just run
  `php artisan serve` (and `npm run dev`). Keep `QUEUE_CONNECTION=sync` in `.env` (the new default).
- LibreOffice must be installed for Word/Excel/PowerPoint previews and for "Edit text" (set `SOFFICE_PATH` if it is not
  found). Poppler is needed for printing edited files.
- **"No pricing rule for …"**: missing rates now fall back to built-in defaults (A4 ₹2/₹8, A5 ₹1.50/₹6, Letter ₹2/₹8
  per side, B/W/colour); `php artisan migrate` also stores them so admins can edit them. An admin can switch a rate off.
- `.jfif` / `.jpe` photos are accepted as JPEG; a JPEG/PNG with an unfamiliar extension is accepted by its content.
  WebP and HEIC are refused with a clear message (save as JPG/PNG).
- **"database is locked" (SQLite)** and pages needing a hard refresh: in `backend/.env` use `CACHE_STORE=file`,
  `SESSION_DRIVER=file`, `QUEUE_CONNECTION=sync` (the database cache/session/queue all write to the same SQLite file
  on every request). The app now also waits up to 10 s for the lock and uses WAL mode. Stop any old
  `php artisan queue:work` window. Then run `php artisan config:clear`.
- **Several files at once**: tick the files on the Upload step. Pictures go onto shared sheets (e.g. 2 to a page);
  documents or a mix are combined into one PDF (Poppler `pdfunite`; set `PDFUNITE_PATH` if it is not on PATH) so they
  share one order and one payment.
- The Preview step follows paper size, orientation, colour, sides (front/back sheet) and scaling (fit / fill / actual size).
- **"Could not display this document" / "Edit text" errors**: the browser console (F12) shows the real reason.

## Pay and print
**Pay screen:** the customer taps **Pay now** (or Google Pay / PhonePe / Paytm / BHIM), which opens
the UPI app with the amount and reference taken from the server's payment record. On a computer, where `upi://`
links do nothing, the QR code is always shown last on the screen to scan with a phone UPI app. Opening an app proves nothing: the
page keeps polling the server and the order becomes `paid` only after server-side verification (webhook/poll).

## Printing after payment
When (and only when) the server marks an order `paid`, `EloquentPaymentStore` creates a `print_jobs` row and queues
`PrintOrderJob` (run immediately after the response, no worker), which runs `PrintJobService`:
1. Builds the print file. An unedited document printed whole is sent as-is; otherwise `PrintFileComposer` rasterises
   the needed pages (Poppler `pdftoppm`) and places them with the customer's order, rotation, blanks, position, page
   range and image-sheet layout (FPDF).
2. Sends it through the configured driver with copies, duplex, colour and paper as printer options.
3. Records `queued → preparing → sending → sent | failed`. The confirmation page shows this status.

Setup (`backend/.env`):

| Variable | Meaning |
|---|---|
| `PRINT_DRIVER` | `file` (dev: saves PDFs to `storage/app/printed`), `cups` (Linux/macOS `lp`), `sumatra` (Windows SumatraPDF). `file` is refused in production. |
| `PRINTER_NAME` | Printer name; empty = system default |
| `LP_PATH`, `SUMATRA_PATH`, `PDFTOPPM_PATH` | Binary locations when not on PATH |

Also required: Poppler installed and `php artisan migrate`. Printing starts automatically right after the payment response; no queue worker is needed.

- A paid order is never printed twice: a sent job is skipped, and a job that died mid-send is marked failed ("status
  unknown") for staff rather than reprinted.
- If printing fails the customer has still paid. The page says so; staff can retry with
  `POST /api/v1/admin/orders/{reference}/print/retry` (admin/operator).
- **"Sent" means the print system accepted the job**, not that paper came out (jam, empty tray and offline printers
  are not detected).
- Documents of orders with a print job in progress are not purged by the retention cleanup.

### Running the backend logic tests
    php backend/tests/run.php     # 131 checks incl. print composition rendered through Poppler and printer command building, and a real Word -> edit -> PDF round trip (needs LibreOffice; skipped if absent)
The Laravel 13 dependencies need PHP 8.4. Controllers, requests and routes were syntax-checked but not booted in the
build sandbox (PHP 8.3 only), so run `php artisan test` and click through the flow once on your machine.
