# Taprint brand

* **Name:** Taprint  ·  **Tagline:** Tap In. Print Out.  ·  **Descriptor:** SELF-SERVICE PRINTING
* **Palette (teal + coral):**
  | Role | Colour |
  |---|---|
  | Brand teal | `#0E7C86` |
  | Deep teal (buttons, text on white) | `#0A4A52` |
  | Bright teal (logo printer) | `#14A3AE` |
  | Coral accent, only for money / action moments (Pay) | `#FF6B4A`, button shade `#D6401F` |
  | Ink (text) | `#10242B` |
  | Mist / background | `#EEF8F8`, cards white |
  Status colours stay standard: green success `#12A679`, red errors, amber warnings.
* **Where it lives:** colour tokens at the top of `frontend/src/styles/index.css`; the logo in `src/components/ui/Logo.jsx` (`<Logo full tagline />`); the coral button is `<Button variant="pay">`.
* **Logo:** a deep-teal tile with a bright-teal printer, a paper with a tiny QR "finder" pattern going in, a printed page coming out, a coral status light and a coral tap ripple. Drawn from scratch with simple shapes (no stock art).
* **Files** (`frontend/public/`): `favicon.svg`, `logo-mark.svg/.png`, `logo-lockup.svg/.png` (icon + name + tagline + descriptor). The lockup text uses Plus Jakarta Sans / Segoe UI / Arial; use the `.png` when the look must be identical everywhere.
* **Contrast:** body text and button labels are at least 4.5:1 against their background (that is why buttons use deep teal / deep coral, not the brightest shades).
* Before launch, check the name for trademark clashes (India: ipindia.gov.in) and book the domain / app-store name.

Technical identifiers such as `config/printbuddy.php`, cache keys and the default database name `printbuddy` were left unchanged on purpose so existing installs keep working; customers never see them.
