# Source Structure

`frontend/` contains browser-facing code: routing, rendering, UI state, panels, forms, cart UI, checkout UI, and interaction handlers.

`backend/` contains domain and persistence logic used by the prototype: data models, local storage repositories, users, vendors, products, payments, wallet settlement, withdrawals, and shared business types.

If a module touches the DOM, reads UI state, shows toast messages, or renders HTML, keep it in `frontend/`. If a module owns business rules, stored records, money movement, role detection, or catalog persistence, keep it in `backend/`.
