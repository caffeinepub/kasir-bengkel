import { useState, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useInventoryItems, useAddInventoryItem, useDeleteInventoryItem, useUpdateInventoryQuantity } from '@/hooks/useQueries';
import { ProductType, type InventoryItem } from '@/backend';
import { formatRupiah } from '@/lib/utils';
import { buildXlsx, readXlsx } from '@/lib/xlsx';

interface ItemForm {
  id: string;
  name: string;
  sellingPrice: string;
  purchasePrice: string;
  quantity: string;
  productType: ProductType;
}

const emptyForm = (): ItemForm => ({
  id: '',
  name: '',
  sellingPrice: '',
  purchasePrice: '',
  quantity: '',
  productType: ProductType.goods,
});

export default function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const addItem = useAddInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const updateQty = useUpdateInventoryQuantity();

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<ItemForm>>({});

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    duplicates: string[];
    errors: string[];
  }>({ success: 0, duplicates: [], errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      String(item.id).includes(search)
  );

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateForm(f: ItemForm): boolean {
    const errors: Partial<ItemForm> = {};
    if (!f.id || isNaN(Number(f.id)) || Number(f.id) < 0) errors.id = 'ID harus berupa angka positif';
    if (!f.name.trim()) errors.name = 'Nama tidak boleh kosong';
    if (!f.sellingPrice || isNaN(Number(f.sellingPrice)) || Number(f.sellingPrice) < 0)
      errors.sellingPrice = 'Harga jual tidak valid';
    if (!f.purchasePrice || isNaN(Number(f.purchasePrice)) || Number(f.purchasePrice) < 0)
      errors.purchasePrice = 'Harga beli tidak valid';
    if (f.productType === ProductType.goods) {
      if (!f.quantity || isNaN(Number(f.quantity)) || Number(f.quantity) <= 0)
        errors.quantity = 'Stok harus lebih dari 0';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Add ─────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!validateForm(form)) return;
    try {
      await addItem.mutateAsync({
        id: BigInt(form.id),
        name: form.name.trim(),
        sellingPrice: BigInt(form.sellingPrice),
        purchasePrice: BigInt(form.purchasePrice),
        quantity: form.productType === ProductType.goods ? BigInt(form.quantity) : null,
        productType: form.productType,
      });
      toast.success('Barang berhasil ditambahkan');
      setShowAddDialog(false);
      setForm(emptyForm());
      setFormErrors({});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists')) {
        toast.error('ID sudah digunakan, gunakan ID lain');
      } else {
        toast.error('Gagal menambahkan barang: ' + msg);
      }
    }
  }

  // ── Edit (quantity only) ─────────────────────────────────────────────────────
  function openEdit(item: InventoryItem) {
    setSelectedItem(item);
    setForm({
      id: String(item.id),
      name: item.name,
      sellingPrice: String(item.sellingPrice),
      purchasePrice: String(item.purchasePrice),
      quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '',
      productType: item.productType,
    });
    setFormErrors({});
    setShowEditDialog(true);
  }

  async function handleEdit() {
    if (!selectedItem) return;
    if (selectedItem.productType === ProductType.goods) {
      if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) < 0) {
        setFormErrors({ quantity: 'Stok tidak valid' });
        return;
      }
      try {
        await updateQty.mutateAsync({
          itemId: selectedItem.id,
          newQuantity: BigInt(form.quantity),
        });
        toast.success('Stok berhasil diperbarui');
        setShowEditDialog(false);
      } catch (e: unknown) {
        toast.error('Gagal memperbarui stok: ' + (e instanceof Error ? e.message : String(e)));
      }
    } else {
      toast.info('Jasa tidak memiliki stok untuk diperbarui');
      setShowEditDialog(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function openDelete(item: InventoryItem) {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  }

  async function handleDelete() {
    if (!selectedItem) return;
    try {
      await deleteItem.mutateAsync(selectedItem.id);
      toast.success('Barang berhasil dihapus');
      setShowDeleteDialog(false);
      setSelectedItem(null);
    } catch (e: unknown) {
      toast.error('Gagal menghapus barang: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // ── Export Excel ─────────────────────────────────────────────────────────────
  async function handleExport() {
    const headers = ['ID', 'Nama', 'Tipe', 'Stok', 'Harga Beli', 'Harga Jual'];
    const rows = items.map((item) => [
      Number(item.id),
      item.name,
      item.productType === ProductType.goods ? 'Barang' : 'Jasa',
      item.productType === ProductType.goods && item.quantity !== undefined && item.quantity !== null
        ? Number(item.quantity)
        : '',
      Number(item.purchasePrice),
      Number(item.sellingPrice),
    ]);
    try {
      const xlsxBytes = await buildXlsx(headers, rows);
      const blob = new Blob([xlsxBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventori.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('File Excel berhasil diunduh');
    } catch (e) {
      toast.error('Gagal mengekspor Excel');
    }
  }

  // ── Download Template ─────────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    const headers = ['ID', 'Nama', 'Tipe', 'Stok', 'Harga Beli', 'Harga Jual'];
    const rows = [
      [1, 'Contoh Barang', 'Barang', 10, 50000, 75000],
      [2, 'Contoh Jasa', 'Jasa', '', 0, 100000],
    ];
    try {
      const xlsxBytes = await buildXlsx(headers, rows);
      const blob = new Blob([xlsxBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_inventori.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template berhasil diunduh');
    } catch (e) {
      toast.error('Gagal mengunduh template');
    }
  }

  // ── Import Excel ─────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await readXlsx(buffer);
      if (rows.length < 2) {
        toast.error('File kosong atau tidak ada data');
        return;
      }

      const existingIds = new Set(items.map((i) => Number(i.id)));
      let successCount = 0;
      const duplicates: string[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;
        const [idStr, name, typeStr, qtyStr, purchasePriceStr, sellingPriceStr] = row;
        const id = Number(idStr);
        if (isNaN(id)) {
          errors.push(`Baris ${i + 1}: ID tidak valid`);
          continue;
        }
        if (existingIds.has(id)) {
          duplicates.push(`ID ${id} (${name})`);
          continue;
        }
        const productType =
          typeStr?.toLowerCase() === 'jasa' || typeStr?.toLowerCase() === 'service'
            ? ProductType.service
            : ProductType.goods;
        const sellingPrice = Number(sellingPriceStr) || 0;
        const purchasePrice = Number(purchasePriceStr) || 0;
        const quantity = productType === ProductType.goods ? Number(qtyStr) || 0 : null;

        try {
          await addItem.mutateAsync({
            id: BigInt(id),
            name: String(name).trim(),
            sellingPrice: BigInt(sellingPrice),
            purchasePrice: BigInt(purchasePrice),
            quantity: quantity !== null ? BigInt(quantity) : null,
            productType,
          });
          existingIds.add(id);
          successCount++;
        } catch (err) {
          errors.push(`Baris ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      setImportResult({ success: successCount, duplicates, errors });
      setShowImportResult(true);
    } catch (err) {
      toast.error('Gagal membaca file Excel');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventori</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola barang dan jasa bengkel Anda
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <FileSpreadsheet size={16} className="mr-1.5" />
            Unduh Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importLoading}>
            {importLoading ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Upload size={16} className="mr-1.5" />}
            Impor Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={16} className="mr-1.5" />
            Ekspor Excel
          </Button>
          <Button size="sm" onClick={() => { setForm(emptyForm()); setFormErrors({}); setShowAddDialog(true); }}>
            <Plus size={16} className="mr-1.5" />
            Tambah Barang
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari barang atau ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>Harga Beli</TableHead>
              <TableHead>Harga Jual</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {search ? 'Tidak ada barang yang cocok' : 'Belum ada barang. Tambahkan barang pertama Anda!'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={String(item.id)}>
                  <TableCell className="font-mono text-sm">{String(item.id)}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.productType === ProductType.goods ? 'default' : 'secondary'}>
                      {item.productType === ProductType.goods ? 'Barang' : 'Jasa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.productType === ProductType.goods ? (
                      <span className={Number(item.quantity) <= 5 ? 'text-destructive font-semibold' : ''}>
                        {String(item.quantity ?? 0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatRupiah(Number(item.purchasePrice))}</TableCell>
                  <TableCell>{formatRupiah(Number(item.sellingPrice))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDelete(item)}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Barang Baru</DialogTitle>
            <DialogDescription>Isi detail barang atau jasa yang ingin ditambahkan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ID Barang</Label>
              <Input
                type="number"
                placeholder="Masukkan ID unik"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
              {formErrors.id && <p className="text-xs text-destructive">{formErrors.id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input
                placeholder="Nama barang atau jasa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipe</Label>
              <Select
                value={form.productType}
                onValueChange={(v) => setForm({ ...form, productType: v as ProductType, quantity: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ProductType.goods}>Barang</SelectItem>
                  <SelectItem value={ProductType.service}>Jasa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.productType === ProductType.goods && (
              <div className="space-y-1.5">
                <Label>Stok Awal</Label>
                <Input
                  type="number"
                  placeholder="Jumlah stok"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
                {formErrors.quantity && <p className="text-xs text-destructive">{formErrors.quantity}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Harga Beli (Rp)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
                {formErrors.purchasePrice && <p className="text-xs text-destructive">{formErrors.purchasePrice}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Harga Jual (Rp)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
                {formErrors.sellingPrice && <p className="text-xs text-destructive">{formErrors.sellingPrice}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={addItem.isPending}>
              {addItem.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stok Barang</DialogTitle>
            <DialogDescription>
              {selectedItem?.productType === ProductType.goods
                ? 'Perbarui jumlah stok barang.'
                : 'Jasa tidak memiliki stok.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input value={form.name} disabled />
            </div>
            {selectedItem?.productType === ProductType.goods && (
              <div className="space-y-1.5">
                <Label>Stok Baru</Label>
                <Input
                  type="number"
                  placeholder="Jumlah stok"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
                {formErrors.quantity && <p className="text-xs text-destructive">{formErrors.quantity}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Batal</Button>
            <Button onClick={handleEdit} disabled={updateQty.isPending}>
              {updateQty.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Barang</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selectedItem?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              {deleteItem.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog open={showImportResult} onOpenChange={setShowImportResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hasil Impor Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-green-500" />
              <span>{importResult.success} barang berhasil diimpor</span>
            </div>
            {importResult.duplicates.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertCircle size={16} />
                  <span>{importResult.duplicates.length} data duplikat dilewati:</span>
                </div>
                <ul className="text-xs text-muted-foreground pl-6 list-disc space-y-0.5">
                  {importResult.duplicates.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle size={16} />
                  <span>{importResult.errors.length} baris gagal:</span>
                </div>
                <ul className="text-xs text-muted-foreground pl-6 list-disc space-y-0.5">
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowImportResult(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
