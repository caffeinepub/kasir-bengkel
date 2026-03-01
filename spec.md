# Specification

## Summary
**Goal:** Revert the backend and key frontend pages of Kasir Bengkel to their Draft Version 15 state.

**Planned changes:**
- Revert `backend/main.mo` to Draft Version 15, restoring all types, persistent state, and query/update methods (inventory, transactions, work orders, shop settings, user profiles, reports, access control)
- Revert `frontend/src/pages/CashierPage.tsx` to Draft Version 15, restoring cart logic, customer/vehicle info fields, and receipt dialog
- Revert `frontend/src/pages/InventoryPage.tsx` to Draft Version 15, restoring search, stock management, low-stock indicators, and Excel import/export
- Revert `frontend/src/pages/ServicePage.tsx` to Draft Version 15, restoring work order creation/completion/deletion, search, and cashier navigation with pre-filled customer data

**User-visible outcome:** The application behaves exactly as it did in Draft Version 15, with all previously working features in the cashier, inventory, and service pages restored.
