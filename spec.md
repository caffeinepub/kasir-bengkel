# Specification

## Summary
**Goal:** Change the Axle Excel import in the Inventory page to use the ID column as a unique key, upserting items instead of always inserting new ones.

**Planned changes:**
- When processing an Axle-exported Excel upload, check each item's ID against existing inventory records.
- If a matching ID is found, update that item's fields (name, price, stock, category, etc.) with values from the file.
- If no matching ID is found, insert the item as a new inventory entry.
- Items in inventory whose IDs are not present in the uploaded file are left unchanged.

**User-visible outcome:** After uploading an Axle Excel file, existing inventory items with matching IDs are updated in place rather than duplicated, while new IDs are added as new items and unaffected items remain unchanged.
