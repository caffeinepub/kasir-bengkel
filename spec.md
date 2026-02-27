# Specification

## Summary
**Goal:** Redesign the Cashier page product panel to show a unified, configurable set of up to 10 pinned items, and replace the split search inputs with a single unified search bar that shows popup suggestions.

**Planned changes:**
- Replace the split Jasa/Barang product grid with a single unified panel showing at most 10 pinned items at a time
- Add a "Select Displayed Items" button/dialog that lets the user pick which inventory items (up to 10) are pinned; selection is persisted in localStorage
- Remove the separate Jasa and Barang search inputs and replace them with one unified search bar that queries all inventory items
- Add a dropdown popup on the unified search bar that appears after typing 1+ characters, showing matching items; clicking a result adds it to the cart

**User-visible outcome:** On the Cashier page, users see a single compact product panel with up to 10 user-chosen pinned items, a gear/settings button to manage which items are pinned, and one search bar with live popup suggestions for quickly adding any inventory item to the cart.
