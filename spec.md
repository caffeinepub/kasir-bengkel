# Specification

## Summary
**Goal:** Add Excel (.xlsx) import and export functionality to the Inventory page, allowing users to bulk-download and bulk-upload inventory items.

**Planned changes:**
- Add a "Download Excel" button to the Inventory page toolbar that exports all inventory items (Name, Type, Purchase Price, Selling Price, Stock, Unit) as a formatted .xlsx file with bold headers and numeric values stored as numbers.
- Add a "Download Template" button near the upload area that generates a .xlsx template file with bold headers and one example row.
- Add an "Upload Excel" button to the Inventory page toolbar that opens a file picker for .xlsx files, parses the uploaded file, validates rows (required name, valid type, valid numeric fields), and bulk-imports items into the inventory.
- Handle both semicolon (;) and comma (,) column separators during import for regional Excel compatibility.
- After a successful import, automatically refresh the inventory list.
- Report invalid rows to the user with clear error messages indicating which rows failed and why.
- Prompt the user to skip or overwrite duplicate items (matched by name) during import.

**User-visible outcome:** Users can export their full inventory to a formatted Excel file, download a pre-filled template to prepare import data, and bulk-import inventory items from a .xlsx file with validation feedback and duplicate handling.
