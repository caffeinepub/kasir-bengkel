import { useState, useRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2, Search, Upload, Download, Package, Wrench } from 'lucide-react';
import { formatRupiah } from '../lib/utils';
import { toast } from 'sonner';
import { buildXlsx, readXlsx } from '../lib/xlsx';

type DialogMode = 'add-goods' | 'add-service' | 'edit-stock' | 'delete' | null;

interface ItemFormState {
  name: string;
  sellingPrice: string;
  purchasePrice: string;
  quantity: string;
}

const defaultForm: ItemFormState = {
  name: '',
  sellingPrice: '',
  purchasePrice: '',
  quantity: '',
};

export default function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const addItem = useAddInventoryItem();
  const updateQty = useUpdateInventoryItemQuantity();
  const deleteItem = useDeleteInventoryItem();
  const updateAllItems = useUpdateAllItems();

  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemFormState>(defaultForm);
  const [newStock, setNewStock] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const goodsItems = items.filter(i => i.kind === ItemKind.goods);
  const serviceItems = items.filter(i => i.kind === ItemKind.service);

  const filteredGoods = goodsItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredServices = serviceItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = goodsItems.filter(i => (i.quantity ?? 0n) <= 5n && (i.quantity ?? 0n) > 0n).length;
  const outOfStockCount = goodsItems.filter(i => (i.quantity ?? 0n) === 0n).length;

  const openAddGoods = () => {
    setForm(defaultForm);
    setDialogMode('add-goods');
  };

  const openAddService = () => {
    setForm(defaultForm);
    setDialogMode('add-service');
  };

  const openEditStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setNewStock(String(item.quantity ?? 0n));
    setDialogMode('edit-stock');
  };

  const openDelete = (item: InventoryItem) => {
    setSelectedItem(item);
    setDialogMode('delete');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedItem(null);
    setForm(defaultForm);
    setNewStock('');
  };

  const handleAddItem = async (kind: ItemKind) => {
    if (!form.name.trim()) {
      toast.error('Nama item wajib diisi');
      return;
    }
    const sellingPrice = parseInt(form.sellingPrice) || 0;
    const purchasePrice = parseInt(form.purchasePrice) || 0;
    const quantity = kind === ItemKind.goods ? (parseInt(form.quantity) || 0) : null;

    if (kind === ItemKind.goods && (!form.quantity || parseInt(form.quantity) <= 0)) {
      toast.error('Stok awal harus lebih dari 0');
      return;
    }

    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      await addItem.mutateAsync({
        id,
        name: form.name.trim(),
        sellingPrice: BigInt(sellingPrice),
        purchasePrice: BigInt(purchasePrice),
        quantity: quantity !== null ? BigInt(quantity) : null,
        kind,
      });
      toast.success('Item berhasil ditambahkan');
      closeDialog();
    } catch (e) {
      toast.error('Gagal menambahkan item');
      console.error(e);
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedItem) return;
    const qty = parseInt(newStock);
    if (isNaN(qty) || qty < 0) {
      toast.error('Stok tidak valid');
      return;
    }
    try {
      await updateQty.mutateAsync({ itemId: selectedItem.id, newQuantity: BigInt(qty) });
      toast.success('Stok berhasil diperbarui');
      closeDialog();
    } catch (e) {
      toast.error('Gagal memperbarui stok');
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await deleteItem.mutateAsync(selectedItem.id);
      toast.success('Item berhasil dihapus');
      closeDialog();
    } catch (e) {
      toast.error('Gagal menghapus item');
      console.error(e);
    }
  };

  const handleExport = async () => {
    try {
      const headers = ['ID', 'Nama', 'Harga Jual', 'Harga Beli', 'Stok', 'Jenis'];
      const rows = items.map(i => [
        i.id,
        i.name,
        String(i.sellingPrice),
        String(i.purchasePrice),
        i.kind === ItemKind.goods ? String(i.quantity ?? 0n) : '',
        i.kind === ItemKind.goods ? 'barang' : 'jasa',
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
    } catch (e) {
      toast.error('Gagal mengekspor data');
      console.error(e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await readXlsx(buffer);
      // Skip header row
      const dataRows = rows.slice(1);
      const importedItems: InventoryItem[] = [];

      for (const row of dataRows) {
        const [id, name, sellingPriceStr, purchasePriceStr, quantityStr, kindStr] = row;
        if (!id || !name) continue;
        const kind = String(kindStr ?? '').toLowerCase() === 'jasa' ? ItemKind.service : ItemKind.goods;
        const item: InventoryItem = {
          id: String(id),
          name: String(name),
          sellingPrice: BigInt(parseInt(String(sellingPriceStr)) || 0),
          purchasePrice: BigInt(parseInt(String(purchasePriceStr)) || 0),
          quantity: kind === ItemKind.goods
            ? BigInt(parseInt(String(quantityStr)) || 0)
            : undefined,
          kind,
        };
        importedItems.push(item);
      }

      if (importedItems.length === 0) {
        toast.error('Tidak ada data valid untuk diimpor');
        return;
      }

      await updateAllItems.mutateAsync(importedItems);
      toast.success(`${importedItems.length} item berhasil diimpor`);
    } catch (e) {
      toast.error('Gagal mengimpor file');
      console.error(e);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const ItemTable = ({ data, kind }: { data: InventoryItem[]; kind: ItemKind }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead className="text-right">Harga Jual</TableHead>
          <TableHead className="text-right">Harga Beli</TableHead>
          {kind === ItemKind.goods && <TableHead className="text-center">Stok</TableHead>}
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={kind === ItemKind.goods ? 5 : 4} className="text-center text-muted-foreground py-8">
              Tidak ada item
            </TableCell>
          </TableRow>
        ) : (
          data.map(item => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-right">{formatRupiah(Number(item.sellingPrice))}</TableCell>
              <TableCell className="text-right">{formatRupiah(Number(item.purchasePrice))}</TableCell>
              {kind === ItemKind.goods && (
                <TableCell className="text-center">
                  <Badge
                    variant={
                      (item.quantity ?? 0n) === 0n
                        ? 'destructive'
                        : (item.quantity ?? 0n) <= 5n
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {String(item.quantity ?? 0n)}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {kind === ItemKind.goods && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditStock(item)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Stok
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => openDelete(item)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Barang</p>
            <p className="text-2xl font-bold">{goodsItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Layanan</p>
            <p className="text-2xl font-bold">{serviceItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Stok Menipis</p>
            <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Habis</p>
            <p className="text-2xl font-bold text-destructive">{outOfStockCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari item..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importLoading}
        >
          <Upload className="h-4 w-4 mr-1" />
          {importLoading ? 'Mengimpor...' : 'Import'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="goods">
        <TabsList>
          <TabsTrigger value="goods" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            Barang ({goodsItems.length})
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-1">
            <Wrench className="h-4 w-4" />
            Layanan ({serviceItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goods">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Daftar Barang</CardTitle>
              <Button size="sm" onClick={openAddGoods}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah Barang
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : (
                  <ItemTable data={filteredGoods} kind={ItemKind.goods} />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Daftar Layanan</CardTitle>
              <Button size="sm" onClick={openAddService}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah Layanan
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat...</div>
                ) : (
                  <ItemTable data={filteredServices} kind={ItemKind.service} />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Goods Dialog */}
      <Dialog open={dialogMode === 'add-goods'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Barang</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Barang</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nama barang"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Harga Jual (Rp)</Label>
                <Input
                  type="number"
                  value={form.sellingPrice}
                  onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Harga Beli (Rp)</Label>
                <Input
                  type="number"
                  value={form.purchasePrice}
                  onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label>Stok Awal</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              onClick={() => handleAddItem(ItemKind.goods)}
              disabled={addItem.isPending}
            >
              {addItem.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={dialogMode === 'add-service'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Layanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Layanan</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nama layanan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Harga Jual (Rp)</Label>
                <Input
                  type="number"
                  value={form.sellingPrice}
                  onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Harga Beli (Rp)</Label>
                <Input
                  type="number"
                  value={form.purchasePrice}
                  onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              onClick={() => handleAddItem(ItemKind.service)}
              disabled={addItem.isPending}
            >
              {addItem.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Dialog */}
      <Dialog open={dialogMode === 'edit-stock'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stok</DialogTitle>
            <DialogDescription>
              {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Stok Baru</Label>
            <Input
              type="number"
              value={newStock}
              onChange={e => setNewStock(e.target.value)}
              placeholder="0"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              onClick={handleUpdateStock}
              disabled={updateQty.isPending}
            >
              {updateQty.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Item</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selectedItem?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
