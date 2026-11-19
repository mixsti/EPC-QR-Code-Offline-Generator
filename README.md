# EPC QR Code Offline Generator

## Vibe Coded Slop - Use at your own risk.

Static, offline-capable EPC/SEPA payment QR generator. 
Deployed as Vercel project **`epc-qr`**.

A lightweight, fully offline EPC/SEPA QR code generator. Open `index.html` in a modern browser, fill in the payment details, and generate the QR code locally in your browser. No server calls; everything runs offline.

## Features
- Offline only: no network requests; all scripts are local
- IBAN validation: live check and readable spacing
- Fields: Recipient, IBAN, Amount (EUR), Payment reference OR Structured reference (RF, ISO 11649), Purpose code, BIC (rarely needed), Note to originator
- EPC payload guard: live byte counter and limit check (max 331 bytes)
- UX niceties: dark/light theme, tooltips, example data, searchable/duplicable saved payment references in browser local storage, EPC payload details
- Languages: English and German

## Quick Start
1. Clone or download the repository.
2. Open `index.html` in your browser (double-click is fine). Optionally serve it via a static file server.
3. Fill in the required fields (Recipient, IBAN, optionally Amount) and click "Generate QR code".
4. Generate the QR code and scan it with your banking app.

Note: The app works entirely offline. You can keep and use it without internet connectivity.

## Fields & Rules (Overview)
- Recipient: free text (required)
- IBAN: validated using Mod97; input with or without spaces
- Amount: decimal EUR value; formatted to two decimals on generate
- Payment reference vs. Structured reference: mutually exclusive (use one or the other)
- Purpose code: 1-4 alphanumeric characters (e.g., GDDS, SALA, CHAR)
- BIC: only needed for special/edge cases outside standard SEPA usage
- EPC payload: maximum length 331 bytes; live counter is shown

## Internationalization (i18n)
- Base strings: `assets/i18n-core.js` (English)
- Additional language: `assets/i18n/de.js` (German)
- The language selector is limited to English and German

## Project Structure
- `index.html`: UI, styles, and script loading
- `assets/app.js`: App logic (validation, payload build, QR render, i18n handling)
- `assets/qrcode.min.js`: QR library (local)
- `assets/i18n-core.js`: Base i18n (EN)
- `assets/i18n/de.js`: German translation
- `LICENSE`: MIT license

## Development
- No build step required; static files only
- For local testing, simply open `index.html`
- Or serve via any static server, e.g.:
  - Python: `python -m http.server 8080`
  - Node (npx): `npx serve .`

## Deploy (Vercel)
- Project name: `epc-qr`
- Static files only — no build step. Vercel serves `index.html` from the repo root.

## Privacy
- No data is transmitted. All inputs stay in the user's browser.

## License
MIT — see `LICENSE`.

## Credits
- QR code library: qrcode.js (local copy in `assets/qrcode.min.js`)
- Original upstream concept: [quasistatic-setup/EPC-QR-Code-Offline-Generator](https://github.com/quasistatic-setup/EPC-QR-Code-Offline-Generator)

## Notes on Release
- No Node or test tooling is required; this repo ships static assets only.
- Language selector uses `Intl.DisplayNames` to list languages.
