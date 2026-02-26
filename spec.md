# Specification

## Summary
**Goal:** Build BengkelPOS, a full-featured workshop cashier POS application with a Motoko backend for persistent data storage and a polished automotive-themed frontend.

**Planned changes:**

**Backend (Motoko Actor):**
- Store and manage shop settings (logo URL, shop name, address, phone number, thank-you message)
- Manage products/services catalog with name, category, unit price, and stock quantity (CRUD)
- Record transactions with line items (item, quantity, unit price, subtotal, timestamp, customer name, vehicle info, discount)
- Expose queries for daily/monthly sales totals, transaction counts, and top-selling items

**Frontend Pages:**
- **Cashier / New Transaction:** Search catalog, add items to cart, set quantities, apply optional discount, enter customer name and vehicle info (plate number, vehicle type), finalize transaction, and auto-trigger print receipt
- **Catalog Management:** List all services/parts with name, category, price, and stock; support add, edit, and delete; stock decrements automatically on sale
- **Transaction History:** Paginated list of past transactions with date, customer name, vehicle info, total; date range filter; click to view detail; reprint button per transaction
- **Reports:** Daily and monthly sales summaries (total revenue, transaction count, top-selling items) with date/month picker
- **Shop Settings:** Form to upload logo, edit shop name, address, phone number, and thank-you message; persisted to backend

**Receipt & Print:**
- Print-friendly receipt component showing shop logo, name, address, phone, transaction date/time, transaction ID, itemized list, grand total, and thank-you message
- Uses `window.print()` only; CSS print stylesheet hides all non-receipt UI

**UI/Theme:**
- Dark navy and orange-amber color palette with bold industrial typography
- Card-based layouts and persistent sidebar navigation with icons for all five sections
- Consistent active-state highlighting across all pages

**User-visible outcome:** A fully functional workshop POS app where staff can manage the catalog, process sales transactions with printed receipts, review transaction history, and view daily/monthly sales reports — all with a professional automotive aesthetic and data stored on-chain via the Motoko backend.
