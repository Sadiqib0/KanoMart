# Kano Mart Marketplace Prototype

This is a static bilingual English/Hausa marketplace homepage for Kano Mart. The browser-ready file is `dist/app.js`, generated from the TypeScript source in `src/app.ts`.

Open `index.html` in a browser to use it. Search history, failed demand, vendor requests, and cart count are saved in `localStorage` so the admin dashboard can show what users are looking for during prototype testing.

## TypeScript

Install dependencies once:

```bash
npm install
```

Build the browser JavaScript after editing `src/app.ts`:

```bash
npm run build
```

Type-check without writing files:

```bash
npm run typecheck
```

## Included

- Mobile-first homepage with header, language toggle, cart, and vendor registration CTA.
- Bilingual hero, large marketplace search, search results, and saved-demand empty state.
- Food, fashion, and children category structure in English and Hausa.
- Payment options in English and Hausa: card, bank transfer, USSD, wallet, and pay on delivery.
- Vendor registration flow with local admin visibility.
- Admin dashboard for search history, popular searches, failed searches, demand trends, vendor performance, order records, and payment status.
- Generated hero asset saved at `assets/kano-market-hero.png`.

## Production note

For launch, move search history and vendor registration from browser `localStorage` to a backend database so the business can access demand data across all users and devices.
