# Specification

## Summary
**Goal:** Fix the broken Excel (.xlsx) download and restore all user-facing text to Indonesian language throughout the application.

**Planned changes:**
- Fix the custom XLSX writer in `frontend/src/lib/xlsx.ts` so the generated `.xlsx` file is valid and opens correctly in Microsoft Excel and LibreOffice Calc without errors
- Audit and translate all user-facing text (page titles, navigation labels, buttons, table headers, form labels, placeholders, toast notifications, dialogs, and modals) back to Indonesian language

**User-visible outcome:** Users can successfully download and open the inventory export as an Excel file, and all text throughout the application is displayed in Indonesian as it was before the recent changes.
