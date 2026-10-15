# PrintBuddy: QR-based self-service printing

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
- Page rotation/reordering and a post-settings "final preview" are not implemented.
- No real payment provider, admin UI, real server-side validation or document conversion yet.
- Lint: 0 errors, 6 warnings (fast-refresh export rule, set-state-in-effect).
