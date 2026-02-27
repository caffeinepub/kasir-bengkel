import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatRupiah } from '@/lib/utils';
import {
  useInventoryItems,
  useAddInventoryItem,
  useDeleteInventoryItem,
  useUpdateInventoryQuantity,
} from '@/hooks/useQueries';
import { ProductType, type InventoryItem } from '@/backend';
import { downloadXlsx, parseXlsxAsync, type XlsxRow } from '@/lib/xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  type: 'goods' | 'service';
  purchasePrice: string;
  sellingPrice: string;
  quantity: string;
  unit: string;
}

const defaultForm: FormState = {
  name: '',
  type: 'goods',
  purchasePrice: '',
  sellingPrice: '',
  quantity: '',
  unit: '',
};

// ─── Import validation ────────────────────────────────────────────────────────

interface ImportRow {
  name: string;
  type: 'goods' | 'service';
  purchasePrice: number;
  sellingPrice: number;
  quantity: number | null;
  unit: string;
}

interface ImportError {
  row: number;
  message: string;
}

function parseImportRows(rows: string[][]): { valid: ImportRow[]; errors: ImportError[] } {
  const valid: ImportRow[] = [];
  const errors: ImportError[] = [];

  // Skip header row (row index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c?.trim())) continue; // skip empty rows

    const rowNum = i + 1;
    const [rawName, rawType, rawPurchase, rawSelling, rawStock, rawUnit] = row.map(c => (c ?? '').trim());

    const rowErrors: string[] = [];

    // Name
    if (!rawName) rowErrors.push('Name is required');

    // Type
    const typeLower = rawType?.toLowerCase() ?? '';
    let type: 'goods' | 'service' | null = null;
    if (typeLower === 'goods' || typeLower === 'barang') type = 'goods';
    else if (typeLower === 'service' || typeLower === 'jasa') type = 'service';
    else rowErrors.push(`Type must be "Goods" or "Service" (got "${rawType}")`);

    // Purchase price
    const purchasePrice = parseFloat(rawPurchase?.replace(/[^0-9.-]/g, '') ?? '');
    if (isNaN(purchasePrice) || purchasePrice < 0) rowErrors.push('Purchase Price must be a valid non-negative number');

    // Selling price
    const sellingPrice = parseFloat(rawSelling?.replace(/[^0-9.-]/g, '') ?? '');
    if (isNaN(sellingPrice) || sellingPrice < 0) rowErrors.push('Selling Price must be a valid non-negative number');

    // Stock / quantity
    let quantity: number | null = null;
    if (type === 'goods') {
      const q = parseFloat(rawStock?.replace(/[^0-9.-]/g, '') ?? '');
      if (isNaN(q) || q < 0) rowErrors.push('Stock must be a valid non-negative number for Goods');
      else quantity = Math.round(q);
    }

    // Unit
    if (!rawUnit) rowErrors.push('Unit is required');

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, message: rowErrors.join('; ') });
    } else {
      valid.push({
        name: rawName,
        type: type!,
        purchasePrice: Math.round(purchasePrice),
        sellingPrice: Math.round(sellingPrice),
        quantity,
        unit: rawUnit,
      });
    }
  }

  return { valid, errors };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const addItem = useAddInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const updateQty = useUpdateInventoryQuantity();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [deleteId, setDeleteId] = useState<bigint | null>(null);

  // Excel import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importErrorsOpen, setImportErrorsOpen] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importSuccessOpen, setImportSuccessOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [duplicateRows, setDuplicateRows] = useState<ImportRow[]>([]);
  const [pendingImport, setPendingImport] = useState<ImportRow[]>([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // ─── Filtered items ─────────────────────────────────────────────────────────
  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Form helpers ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setForm({
      name: item.name,
      type: item.productType === ProductType.goods ? 'goods' : 'service',
      purchasePrice: String(item.purchasePrice),
      sellingPrice: String(item.sellingPrice),
      quantity: item.quantity != null ? String(item.quantity) : '',
      unit: '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) return;
    const purchasePrice = BigInt(parseInt(form.purchasePrice) || 0);
    const sellingPrice = BigInt(parseInt(form.sellingPrice) || 0);
    const productType = form.type === 'goods' ? ProductType.goods : ProductType.service;
    const quantity = form.type === 'goods' ? BigInt(parseInt(form.quantity) || 0) : null;

    if (editItem) {
      // Update quantity only (backend limitation)
      if (form.type === 'goods' && quantity !== null) {
        await updateQty.mutateAsync({ itemId: editItem.id, newQuantity: quantity });
      }
    } else {
      const id = BigInt(Date.now());
      await addItem.mutateAsync({ id, name, sellingPrice, purchasePrice, quantity, productType });
    }
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (deleteId == null) return;
    await deleteItem.mutateAsync(deleteId);
    setDeleteId(null);
  }

  // ─── Excel Export ────────────────────────────────────────────────────────────
  function handleExportExcel() {
    const headers: XlsxRow = [
      { v: 'Name', t: 's', bold: true },
      { v: 'Type', t: 's', bold: true },
      { v: 'Purchase Price', t: 's', bold: true },
      { v: 'Selling Price', t: 's', bold: true },
      { v: 'Stock', t: 's', bold: true },
      { v: 'Unit', t: 's', bold: true },
    ];

    const dataRows: XlsxRow[] = items.map(item => [
      { v: item.name, t: 's' },
      { v: item.productType === ProductType.goods ? 'Goods' : 'Service', t: 's' },
      { v: Number(item.purchasePrice), t: 'n' },
      { v: Number(item.sellingPrice), t: 'n' },
      { v: item.quantity != null ? Number(item.quantity) : 0, t: 'n' },
      { v: 'pcs', t: 's' },
    ]);

    downloadXlsx([headers, ...dataRows], 'inventory-export.xlsx');
  }

  // ─── Excel Template ──────────────────────────────────────────────────────────
  function handleDownloadTemplate() {
    const rows: XlsxRow[] = [
      [
        { v: 'Name', t: 's', bold: true },
        { v: 'Type', t: 's', bold: true },
        { v: 'Purchase Price', t: 's', bold: true },
        { v: 'Selling Price', t: 's', bold: true },
        { v: 'Stock', t: 's', bold: true },
        { v: 'Unit', t: 's', bold: true },
      ],
      [
        { v: 'Brake Pad', t: 's' },
        { v: 'Goods', t: 's' },
        { v: 50000, t: 'n' },
        { v: 75000, t: 'n' },
        { v: 10, t: 'n' },
        { v: 'pcs', t: 's' },
      ],
      [
        { v: 'Oil Change Service', t: 's' },
        { v: 'Service', t: 's' },
        { v: 30000, t: 'n' },
        { v: 50000, t: 'n' },
        { v: 0, t: 'n' },
        { v: 'job', t: 's' },
      ],
    ];
    downloadXlsx(rows, 'inventory-template.xlsx');
  }

  // ─── Excel Import ────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-uploaded
    e.target.value = '';

    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await parseXlsxAsync(buffer);

      if (rows.length < 2) {
        setImportErrors([{ row: 0, message: 'File is empty or has no data rows.' }]);
        setImportErrorsOpen(true);
        return;
      }

      const { valid, errors } = parseImportRows(rows);

      if (errors.length > 0) {
        setImportErrors(errors);
        setImportErrorsOpen(true);
        // Still proceed with valid rows if any
        if (valid.length === 0) return;
      }

      if (valid.length === 0) return;

      // Check for duplicates
      const existingNames = new Set(items.map(i => i.name.toLowerCase()));
      const dupes = valid.filter(r => existingNames.has(r.name.toLowerCase()));
      const nonDupes = valid.filter(r => !existingNames.has(r.name.toLowerCase()));

      if (dupes.length > 0) {
        setDuplicateRows(dupes);
        setPendingImport(valid);
        setDuplicateDialogOpen(true);
      } else {
        await doImport(nonDupes);
      }
    } catch (err) {
      setImportErrors([{ row: 0, message: `Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}` }]);
      setImportErrorsOpen(true);
    } finally {
      setImportLoading(false);
    }
  }

  async function doImport(rows: ImportRow[]) {
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const id = BigInt(Date.now() + i);
        await addItem.mutateAsync({
          id,
          name: r.name,
          sellingPrice: BigInt(r.sellingPrice),
          purchasePrice: BigInt(r.purchasePrice),
          quantity: r.quantity != null ? BigInt(r.quantity) : null,
          productType: r.type === 'goods' ? ProductType.goods : ProductType.service,
        });
        count++;
      } catch {
        // skip failed rows
      }
    }
    setImportSuccessCount(count);
    setImportSuccessOpen(true);
  }

  async function handleImportSkipDuplicates() {
    setDuplicateDialogOpen(false);
    const existingNames = new Set(items.map(i => i.name.toLowerCase()));
    const nonDupes = pendingImport.filter(r => !existingNames.has(r.name.toLowerCase()));
    await doImport(nonDupes);
  }

  async function handleImportOverwriteDuplicates() {
    setDuplicateDialogOpen(false);
    // Delete duplicates first, then import all
    const existingNames = new Map(items.map(i => [i.name.toLowerCase(), i.id]));
    for (const r of duplicateRows) {
      const id = existingNames.get(r.name.toLowerCase());
      if (id != null) {
        try { await deleteItem.mutateAsync(id); } catch { /* ignore */ }
      }
    }
    await doImport(pendingImport);
  }

  // ─── Margin calculation ──────────────────────────────────────────────────────
  const purchase = parseInt(form.purchasePrice) || 0;
  const selling = parseInt(form.sellingPrice) || 0;
  const margin = purchase > 0 ? (((selling - purchase) / purchase) * 100).toFixed(1) : null;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 p-6 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your goods and services
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>

        {/* Toolbar row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Excel buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Template
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="gap-2"
            >
              {importLoading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={items.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
              Loading inventory...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <FileSpreadsheet className="w-12 h-12 opacity-30" />
              <p className="text-lg font-medium">No items found</p>
              <p className="text-sm">Add items manually or upload an Excel file</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => {
                  const pp = Number(item.purchasePrice);
                  const sp = Number(item.sellingPrice);
                  const m = pp > 0 ? (((sp - pp) / pp) * 100).toFixed(1) : null;
                  return (
                    <TableRow key={String(item.id)}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.productType === ProductType.goods ? 'default' : 'secondary'}>
                          {item.productType === ProductType.goods ? 'Goods' : 'Service'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatRupiah(pp)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatRupiah(sp)}
                      </TableCell>
                      <TableCell className="text-right">
                        {m !== null ? (
                          <span className={parseFloat(m) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                            {m}%
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.productType === ProductType.goods
                          ? <span className={Number(item.quantity) === 0 ? 'text-destructive font-medium' : ''}>{String(item.quantity ?? 0)}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
                            className="h-8 w-8"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(item.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </ScrollArea>

      {/* ─── Add/Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription>
              {editItem ? 'Update item quantity.' : 'Fill in the details for the new inventory item.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Item name"
                disabled={!!editItem}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={v => setForm(f => ({ ...f, type: v as 'goods' | 'service' }))}
                disabled={!!editItem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goods">Goods (Barang)</SelectItem>
                  <SelectItem value="service">Service (Jasa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Purchase Price (Rp)</Label>
                <Input
                  type="number"
                  value={form.purchasePrice}
                  onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  placeholder="0"
                  disabled={!!editItem}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Selling Price (Rp)</Label>
                <Input
                  type="number"
                  value={form.sellingPrice}
                  onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  placeholder="0"
                  disabled={!!editItem}
                />
              </div>
            </div>

            {margin !== null && (
              <p className="text-sm text-muted-foreground">
                Margin:{' '}
                <span className={parseFloat(margin) >= 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-destructive font-medium'}>
                  {margin}%
                </span>
              </p>
            )}

            {form.type === 'goods' && (
              <div className="grid gap-1.5">
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={addItem.isPending || updateQty.isPending}
            >
              {(addItem.isPending || updateQty.isPending) && (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              )}
              {editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Import Errors Dialog ────────────────────────────────────────────── */}
      <Dialog open={importErrorsOpen} onOpenChange={setImportErrorsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Import Validation Errors
            </DialogTitle>
            <DialogDescription>
              The following rows could not be imported. Please fix them and try again.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-72">
            <div className="space-y-2 pr-2">
              {importErrors.map((err, i) => (
                <div key={i} className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm">
                  <span className="font-semibold text-destructive">Row {err.row}:</span>{' '}
                  <span className="text-foreground">{err.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setImportErrorsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Import Success Dialog ───────────────────────────────────────────── */}
      <Dialog open={importSuccessOpen} onOpenChange={setImportSuccessOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Import Successful
            </DialogTitle>
            <DialogDescription>
              {importSuccessCount} item{importSuccessCount !== 1 ? 's' : ''} have been successfully imported into your inventory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setImportSuccessOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Duplicate Items Dialog ──────────────────────────────────────────── */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Items Found</DialogTitle>
            <DialogDescription>
              The following {duplicateRows.length} item{duplicateRows.length !== 1 ? 's' : ''} already exist in your inventory:
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-48">
            <ul className="space-y-1 pr-2">
              {duplicateRows.map((r, i) => (
                <li key={i} className="text-sm px-2 py-1 rounded bg-muted text-muted-foreground">
                  {r.name}
                </li>
              ))}
            </ul>
          </ScrollArea>
          <p className="text-sm text-muted-foreground">
            Would you like to skip duplicates or overwrite existing items?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleImportSkipDuplicates} className="flex-1">
              Skip Duplicates
            </Button>
            <Button onClick={handleImportOverwriteDuplicates} className="flex-1">
              Overwrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
