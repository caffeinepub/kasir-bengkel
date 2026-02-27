# Specification

## Summary
**Goal:** Fix Excel re-import on the Inventory page to update existing items by ID instead of duplicating them, and rename the import/export buttons to simpler labels.

**Planned changes:**
- When importing an Excel file, match rows against existing items using the item ID (ID Barang) as the primary key; update matching items with the new field values from Excel instead of skipping or duplicating them
- Rows in Excel with an ID not found in the app are added as new items; items not present in the Excel file remain unchanged
- Rename the "Impor Excel" button to "Unggah" and the "Ekspor Excel" button to "Unduh" on the Inventory page

**User-visible outcome:** Users can export inventory to Excel, edit names/prices/stock in the file, re-import it, and see the changes reflected in the app. The import and export buttons are labeled "Unggah" and "Unduh" respectively.
