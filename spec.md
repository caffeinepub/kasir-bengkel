# Specification

## Summary
**Goal:** Fix the broken Work Order button on the Service page and revert the Cashier and Inventory pages to their stable Draft Version 15 state.

**Planned changes:**
- Fix the Work Order button in `ServicePage.tsx` so clicking it correctly opens the work order detail or completion dialog without errors.
- Revert `CashierPage.tsx` to its Draft Version 15 implementation, removing all changes from Versions 16–19.
- Revert `InventoryPage.tsx` to its Draft Version 15 implementation, removing all changes from Versions 16–19.

**User-visible outcome:** The Work Order button on the Service page is fully functional, and the Cashier and Inventory pages behave exactly as they did in Version 15, with no regressions from later versions.
