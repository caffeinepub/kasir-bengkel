import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, Wrench, Search, Infinity } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useInventoryItems, useAddInventoryItem, useDeleteInventoryItem, useUpdateInventoryQuantity } from '@/hooks/useQueries';
import { formatRupiah } from '@/lib/utils';
import { ProductType, type InventoryItem } from '../backend';

interface ItemForm {
  name: string;
  sellingPrice: string;
  purchasePrice: string;
  quantity: string;
  productType: ProductType;
}

const defaultForm: ItemForm = {
  name: '',
  sellingPrice: '',
  purchasePrice: '',
  quantity: '',
  productType: ProductType.goods,
};

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; editing?: InventoryItem }>({ open: false });
  const [form, setForm] = useState<ItemForm>(defaultForm);

  const { data: items = [], isLoading } = useInventoryItems();
  const addItem = useAddInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const updateQty = useUpdateInventoryQuantity();

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm(defaultForm);
    setDialog({ open: true });
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      name: item.name,
      sellingPrice: String(item.sellingPrice),
      purchasePrice: String(item.purchasePrice),
      quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '',
      productType: item.productType,
    });
    setDialog({ open: true, editing: item });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nama item harus diisi'); return; }
    if (!form.sellingPrice || Number(form.sellingPrice) < 0) { toast.error('Harga jual tidak valid'); return; }
    if (!form.purchasePrice || Number(form.purchasePrice) < 0) { toast.error('Harga beli tidak valid'); return; }
    if (form.productType === ProductType.goods) {
      if (!form.quantity || Number(form.quantity) <= 0) { toast.error('Qty harus diisi dan lebih dari 0 untuk barang'); return; }
    }

    try {
      if (dialog.editing) {
        // For editing, only update quantity for goods
        if (form.productType === ProductType.goods && form.quantity) {
          await updateQty.mutateAsync({
            itemId: dialog.editing.id,
            newQuantity: BigInt(Math.round(Number(form.quantity))),
          });
        }
        toast.success('Item diperbarui');
      } else {
        const maxId = items.length > 0 ? Math.max(...items.map(i => Number(i.id))) : -1;
        await addItem.mutateAsync({
          id: BigInt(maxId + 1),
          name: form.name.trim(),
          sellingPrice: BigInt(Math.round(Number(form.sellingPrice))),
          purchasePrice: BigInt(Math.round(Number(form.purchasePrice))),
          quantity: form.productType === ProductType.goods ? BigInt(Math.round(Number(form.quantity))) : null,
          productType: form.productType,
        });
        toast.success('Item ditambahkan');
      }
      setDialog({ open: false });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan item');
    }
  };

  const isSaving = addItem.isPending || updateQty.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Kelola barang dan jasa bengkel</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari item..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
          <Button onClick={openAdd} className="bg-brand hover:bg-brand-dark text-white">
            <Plus className="w-4 h-4 mr-1" /> Tambah Item
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nama Item</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Harga Beli</TableHead>
              <TableHead>Harga Jual</TableHead>
              <TableHead>Stok/Qty</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada item inventory</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(item => (
                <TableRow key={String(item.id)}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={item.productType === ProductType.service ? 'default' : 'secondary'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {item.productType === ProductType.service
                        ? <><Wrench className="w-3 h-3" /> Jasa</>
                        : <><Package className="w-3 h-3" /> Barang</>
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRupiah(Number(item.purchasePrice))}
                  </TableCell>
                  <TableCell className="text-brand font-semibold">
                    {formatRupiah(Number(item.sellingPrice))}
                  </TableCell>
                  <TableCell>
                    {item.productType === ProductType.service ? (
                      <span className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Infinity className="w-4 h-4" /> Unlimited
                      </span>
                    ) : (
                      <Badge
                        variant={
                          Number(item.quantity ?? 0) > 5
                            ? 'default'
                            : Number(item.quantity ?? 0) > 0
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {String(item.quantity ?? 0)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Item "{item.name}" akan dihapus permanen dari inventory.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() =>
                                deleteItem.mutateAsync(item.id)
                                  .then(() => toast.success('Item dihapus'))
                                  .catch(() => toast.error('Gagal menghapus item'))
                              }
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialog.open} onOpenChange={open => setDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? 'Edit Item' : 'Tambah Item Baru'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Item Type Selector */}
            <div className="space-y-2">
              <Label>Tipe Item</Label>
              <RadioGroup
                value={form.productType}
                onValueChange={val => setForm(prev => ({
                  ...prev,
                  productType: val as ProductType,
                  quantity: val === ProductType.service ? '' : prev.quantity,
                }))}
                className="flex gap-4"
                disabled={!!dialog.editing}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={ProductType.goods} id="type-goods" />
                  <Label htmlFor="type-goods" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Package className="w-4 h-4" /> Barang
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={ProductType.service} id="type-service" />
                  <Label htmlFor="type-service" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Wrench className="w-4 h-4" /> Jasa
                  </Label>
                </div>
              </RadioGroup>
              {dialog.editing && (
                <p className="text-xs text-muted-foreground">Tipe tidak dapat diubah setelah item dibuat.</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Nama Item</Label>
              <Input
                id="item-name"
                placeholder="Contoh: Oli Mesin 1L / Ganti Oli"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={!!dialog.editing}
              />
              {dialog.editing && (
                <p className="text-xs text-muted-foreground">Nama tidak dapat diubah setelah item dibuat.</p>
              )}
            </div>

            {/* Purchase Price */}
            <div className="space-y-1.5">
              <Label htmlFor="purchase-price">Harga Beli (HPP)</Label>
              <Input
                id="purchase-price"
                type="number"
                min={0}
                placeholder="0"
                value={form.purchasePrice}
                onChange={e => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                disabled={!!dialog.editing}
              />
              {dialog.editing && (
                <p className="text-xs text-muted-foreground">Harga beli tidak dapat diubah. Hapus dan buat ulang jika perlu.</p>
              )}
            </div>

            {/* Selling Price */}
            <div className="space-y-1.5">
              <Label htmlFor="selling-price">Harga Jual</Label>
              <Input
                id="selling-price"
                type="number"
                min={0}
                placeholder="0"
                value={form.sellingPrice}
                onChange={e => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                disabled={!!dialog.editing}
              />
              {dialog.editing && (
                <p className="text-xs text-muted-foreground">Harga jual tidak dapat diubah. Hapus dan buat ulang jika perlu.</p>
              )}
            </div>

            {/* Quantity — only for goods */}
            {form.productType === ProductType.goods && (
              <div className="space-y-1.5">
                <Label htmlFor="item-qty">Stok / Qty</Label>
                <Input
                  id="item-qty"
                  type="number"
                  min={1}
                  placeholder="0"
                  value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            )}

            {form.productType === ProductType.service && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <Infinity className="w-4 h-4 shrink-0" />
                <span>Jasa tidak memerlukan stok — jumlah tidak terbatas (unlimited).</span>
              </div>
            )}

            {/* Margin preview */}
            {form.sellingPrice && form.purchasePrice && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin / Laba per unit:</span>
                  <span className={`font-semibold ${Number(form.sellingPrice) - Number(form.purchasePrice) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {formatRupiah(Number(form.sellingPrice) - Number(form.purchasePrice))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Batal</Button>
            <Button
              className="bg-brand hover:bg-brand-dark text-white"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Menyimpan...
                </span>
              ) : (
                dialog.editing ? 'Simpan Perubahan' : 'Tambah Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
