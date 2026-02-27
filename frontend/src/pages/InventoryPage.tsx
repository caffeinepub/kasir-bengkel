import { useState } from 'react';
import {
  useInventoryItems,
  useAddInventoryItem,
  useUpdateInventoryItemQuantity,
  useDeleteInventoryItem,
  useUpdateAllItems,
} from '../hooks/useQueries';
import { InventoryItem, ItemKind } from '../backend';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Pencil, Trash2, Upload, Download, Loader2, Package, Wrench } from 'lucide-react';
import { formatRupiah } from '../lib/utils';
import { buildXlsx, readXlsx } from '../lib/xlsx';
import { toast } from 'sonner';

interface ItemFormData {
  name: string;
  sellingPrice: string;
  purchasePrice: string;
  quantity: string;
  kind: ItemKind;
}

const emptyForm: ItemFormData = {
  name: '',
  sellingPrice: '',
  purchasePrice: '',
  quantity: '',
  kind: ItemKind.goods,
};

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const addItem = useAddInventoryItem();
  const updateQty = useUpdateInventoryItemQuantity();
  const deleteItem = useDeleteInventoryItem();
  const updateAllItems = useUpdateAllItems();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'goods' | 'services'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<ItemFormData>(emptyForm);
  const [editStockValue, setEditStockValue] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      activeTab === 'all' ||
      (activeTab === 'goods' && item.kind === ItemKind.goods) ||
      (activeTab === 'services' && item.kind === ItemKind.service);
    return matchSearch && matchTab;
  });

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama item wajib diisi');
      return;
    }
    const sellingPrice = parseInt(formData.sellingPrice) || 0;
    const purchasePrice = parseInt(formData.purchasePrice) || 0;

    if (formData.kind === ItemKind.goods) {
      const qty = parseInt(formData.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error('Stok harus lebih dari 0 untuk barang');
        return;
      }
      try {
        await addItem.mutateAsync({
          id: generateId(),
          name: formData.name.trim(),
          sellingPrice: BigInt(sellingPrice),
          purchasePrice: BigInt(purchasePrice),
          quantity: BigInt(qty),
          kind: ItemKind.goods,
        });
        toast.success('Barang berhasil ditambahkan');
        setShowAddDialog(false);
        setFormData(emptyForm);
      } catch {
        toast.error('Gagal menambahkan barang');
      }
    } else {
      try {
        await addItem.mutateAsync({
          id: generateId(),
          name: formData.name.trim(),
          sellingPrice: BigInt(sellingPrice),
          purchasePrice: BigInt(purchasePrice),
          quantity: null,
          kind: ItemKind.service,
        });
        toast.success('Jasa berhasil ditambahkan');
        setShowAddDialog(false);
        setFormData(emptyForm);
      } catch {
        toast.error('Gagal menambahkan jasa');
      }
    }
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    if (item.kind === ItemKind.goods) {
      setEditStockValue(item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '0');
    }
    setShowEditDialog(true);
  };

  const handleEditStock = async () => {
    if (!selectedItem) return;
    const newQty = parseInt(editStockValue);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Stok tidak valid');
      return;
    }
    try {
      await updateQty.mutateAsync({ itemId: selectedItem.id, newQuantity: BigInt(newQty) });
      toast.success('Stok berhasil diperbarui');
      setShowEditDialog(false);
      setSelectedItem(null);
    } catch {
      toast.error('Gagal memperbarui stok');
    }
  };

  const handleOpenDelete = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await deleteItem.mutateAsync(selectedItem.id);
      toast.success('Item berhasil dihapus');
      setShowDeleteDialog(false);
      setSelectedItem(null);
    } catch {
      toast.error('Gagal menghapus item');
    }
  };

  const handleExport = async () => {
    try {
      const headers = ['ID', 'Nama', 'Harga Jual', 'Harga Beli', 'Stok', 'Tipe'];
      const rows = items.map((item) => [
        item.id,
        item.name,
        Number(item.sellingPrice),
        Number(item.purchasePrice),
        item.kind === ItemKind.goods
          ? (item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 0)
          : '',
        item.kind === ItemKind.goods ? 'goods' : 'service',
      ]);
      const buffer = await buildXlsx(headers, rows);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventori.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data berhasil diekspor');
    } catch {
      toast.error('Gagal mengekspor data');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      // readXlsx expects ArrayBuffer
      const buffer = await file.arrayBuffer();
      const rows = await readXlsx(buffer);

      if (rows.length < 2) {
        toast.error('File kosong atau format tidak valid');
        return;
      }

      // Build a map of existing items by ID for upsert logic
      const existingMap = new Map<string, InventoryItem>();
      for (const item of items) {
        existingMap.set(item.id, item);
      }

      const toUpdate: InventoryItem[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const id = String(row[0] ?? '').trim();
        const name = String(row[1] ?? '').trim();
        const sellingPrice = parseInt(String(row[2] ?? '0')) || 0;
        const purchasePrice = parseInt(String(row[3] ?? '0')) || 0;
        const quantityRaw = row[4];
        const kindRaw = String(row[5] ?? '').trim().toLowerCase();

        if (!name) continue;

        const kind: ItemKind = kindRaw === 'service' ? ItemKind.service : ItemKind.goods;
        const quantity: bigint | undefined =
          kind === ItemKind.goods
            ? BigInt(parseInt(String(quantityRaw ?? '0')) || 0)
            : undefined;

        const itemId = id || generateId();

        const inventoryItem: InventoryItem = {
          id: itemId,
          name,
          sellingPrice: BigInt(sellingPrice),
          purchasePrice: BigInt(purchasePrice),
          quantity,
          kind,
        };

        toUpdate.push(inventoryItem);
      }

      if (toUpdate.length === 0) {
        toast.error('Tidak ada data valid untuk diimpor');
        return;
      }

      await updateAllItems.mutateAsync(toUpdate);
      toast.success(`${toUpdate.length} item berhasil diimpor`);
    } catch {
      toast.error('Gagal mengimpor data');
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const goodsCount = items.filter((i) => i.kind === ItemKind.goods).length;
  const servicesCount = items.filter((i) => i.kind === ItemKind.service).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventori</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola produk dan layanan bengkel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={items.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Ekspor
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild disabled={importLoading}>
              <span>
                {importLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Impor
              </span>
            </Button>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImport}
              disabled={importLoading}
            />
          </label>
          <Button size="sm" onClick={() => { setFormData(emptyForm); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Package className="w-4 h-4" />
            Total Item
          </div>
          <div className="text-2xl font-bold text-foreground">{items.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Package className="w-4 h-4" />
            Barang
          </div>
          <div className="text-2xl font-bold text-foreground">{goodsCount}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Wrench className="w-4 h-4" />
            Jasa
          </div>
          <div className="text-2xl font-bold text-foreground">{servicesCount}</div>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="goods">Barang</TabsTrigger>
            <TabsTrigger value="services">Jasa</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Item</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Harga Jual</TableHead>
              <TableHead className="text-right">Harga Beli</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Tidak ada item ditemukan
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.kind === ItemKind.goods ? (
                      <Badge variant="outline" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        Barang
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <Wrench className="w-3 h-3 mr-1" />
                        Jasa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatRupiah(Number(item.sellingPrice))}</TableCell>
                  <TableCell className="text-right">{formatRupiah(Number(item.purchasePrice))}</TableCell>
                  <TableCell className="text-right">
                    {item.kind === ItemKind.goods ? (
                      <span
                        className={
                          item.quantity !== undefined && item.quantity !== null && Number(item.quantity) > 0
                            ? 'text-foreground'
                            : 'text-destructive font-medium'
                        }
                      >
                        {item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 0}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.kind === ItemKind.goods && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Stok"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(item)}
                        title="Hapus"
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Item Baru</DialogTitle>
            <DialogDescription>Tambahkan produk atau layanan ke inventori</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Tipe Item</Label>
              <Select
                value={formData.kind}
                onValueChange={(v) => setFormData({ ...formData, kind: v as ItemKind, quantity: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ItemKind.goods}>Barang</SelectItem>
                  <SelectItem value={ItemKind.service}>Jasa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nama Item *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama produk atau layanan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Harga Jual (Rp)</Label>
                <Input
                  type="number"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Harga Beli (Rp)</Label>
                <Input
                  type="number"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            {formData.kind === ItemKind.goods && (
              <div className="space-y-1">
                <Label>Stok Awal *</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                  min="1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={addItem.isPending}>
              {addItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Stok</DialogTitle>
            <DialogDescription>
              Perbarui jumlah stok untuk <strong>{selectedItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Jumlah Stok</Label>
              <Input
                type="number"
                value={editStockValue}
                onChange={(e) => setEditStockValue(e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Batal</Button>
            <Button onClick={handleEditStock} disabled={updateQty.isPending}>
              {updateQty.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Item</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selectedItem?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              {deleteItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
