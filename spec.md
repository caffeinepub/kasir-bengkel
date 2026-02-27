# Specification

## Summary
**Goal:** Rename "Catalog/Katalog" to "Inventory", add buy/sell price fields, add a Goods/Service type selector, and update the Profit/Loss report to use the new price fields.

**Planned changes:**
- Rename all UI references of "Katalog"/"Catalog" to "Inventory", including sidebar label, page title, and route path (`/inventory`)
- Add `sellingPrice` (harga jual) and `purchasePrice` (harga beli) fields to the product/item data model; display both in the inventory list table and in add/edit dialogs
- Add an item type field (`goods` or `service`) to the data model; show a type selector in add/edit dialogs; hide qty/stock input when "Service" is selected and display "∞" in the inventory list for service items
- Update the Profit/Loss section in the Reports page to calculate gross profit as sum of `(sellingPrice - purchasePrice) × quantity` for sold goods items, respecting existing date filters

**User-visible outcome:** Users see an "Inventory" page (renamed from Katalog) where each item has buy/sell prices and a Goods/Service type. Service items show unlimited stock. The Reports page now shows a profit/loss figure derived from the difference between selling and purchase prices.
