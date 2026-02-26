import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, Wrench, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, useServices, useAddProduct, useAddService, useDeleteProduct, useDeleteService, useUpdateProductStock } from '@/hooks/useQueries';
import { formatRupiah } from '@/lib/utils';
import type { Product, Service } from '../backend';

type ProductForm = { name: string; price: string; stock: string };
type ServiceForm = { name: string; price: string; description: string };

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [productDialog, setProductDialog] = useState<{ open: boolean; editing?: Product }>({ open: false });
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; editing?: Service }>({ open: false });
  const [productForm, setProductForm] = useState<ProductForm>({ name: '', price: '', stock: '' });
  const [serviceForm, setServiceForm] = useState<ServiceForm>({ name: '', price: '', description: '' });

  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: services = [], isLoading: loadingServices } = useServices();
  const addProduct = useAddProduct();
  const addService = useAddService();
  const deleteProduct = useDeleteProduct();
  const deleteService = useDeleteService();
  const updateStock = useUpdateProductStock();

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const openAddProduct = () => {
    setProductForm({ name: '', price: '', stock: '' });
    setProductDialog({ open: true });
  };

  const openEditProduct = (p: Product) => {
    setProductForm({ name: p.name, price: String(p.price), stock: String(p.stock) });
    setProductDialog({ open: true, editing: p });
  };

  const openAddService = () => {
    setServiceForm({ name: '', price: '', description: '' });
    setServiceDialog({ open: true });
  };

  const openEditService = (s: Service) => {
    setServiceForm({ name: s.name, price: String(s.price), description: s.description });
    setServiceDialog({ open: true, editing: s });
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) { toast.error('Nama produk harus diisi'); return; }
    if (!productForm.price || Number(productForm.price) < 0) { toast.error('Harga tidak valid'); return; }
    if (!productForm.stock || Number(productForm.stock) < 0) { toast.error('Stok tidak valid'); return; }

    try {
      if (productDialog.editing) {
        await updateStock.mutateAsync({
          productId: productDialog.editing.id,
          newStock: BigInt(Math.round(Number(productForm.stock))),
        });
        toast.success('Produk diperbarui');
      } else {
        const maxId = products.length > 0 ? Math.max(...products.map(p => Number(p.id))) : -1;
        await addProduct.mutateAsync({
          id: BigInt(maxId + 1),
          name: productForm.name.trim(),
          price: BigInt(Math.round(Number(productForm.price))),
          stock: BigInt(Math.round(Number(productForm.stock))),
        });
        toast.success('Produk ditambahkan');
      }
      setProductDialog({ open: false });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan produk');
    }
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) { toast.error('Nama layanan harus diisi'); return; }
    if (!serviceForm.price || Number(serviceForm.price) < 0) { toast.error('Harga tidak valid'); return; }

    try {
      if (serviceDialog.editing) {
        toast.info('Edit layanan: hapus dan buat ulang');
        setServiceDialog({ open: false });
        return;
      }
      const maxId = services.length > 0 ? Math.max(...services.map(s => Number(s.id))) : -1;
      await addService.mutateAsync({
        id: BigInt(maxId + 1),
        name: serviceForm.name.trim(),
        price: BigInt(Math.round(Number(serviceForm.price))),
        description: serviceForm.description.trim(),
      });
      toast.success('Layanan ditambahkan');
      setServiceDialog({ open: false });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan layanan');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Katalog</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Kelola produk dan layanan bengkel</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-56"
          />
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Produk/Suku Cadang
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Layanan/Jasa
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <div className="flex justify-end mb-3">
            <Button onClick={openAddProduct} className="bg-brand hover:bg-brand-dark text-white">
              <Plus className="w-4 h-4 mr-1" /> Tambah Produk
            </Button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProducts ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Belum ada produk
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map(p => (
                    <TableRow key={String(p.id)}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-brand font-semibold">{formatRupiah(Number(p.price))}</TableCell>
                      <TableCell>
                        <Badge variant={Number(p.stock) > 5 ? 'default' : Number(p.stock) > 0 ? 'secondary' : 'destructive'}>
                          {String(p.stock)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditProduct(p)}>
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
                                <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
                                <AlertDialogDescription>Produk "{p.name}" akan dihapus permanen.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() => deleteProduct.mutateAsync(p.id).then(() => toast.success('Produk dihapus')).catch(() => toast.error('Gagal menghapus'))}
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
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <div className="flex justify-end mb-3">
            <Button onClick={openAddService} className="bg-brand hover:bg-brand-dark text-white">
              <Plus className="w-4 h-4 mr-1" /> Tambah Layanan
            </Button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nama Layanan</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingServices ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Belum ada layanan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map(s => (
                    <TableRow key={String(s.id)}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.description || '-'}</TableCell>
                      <TableCell className="text-brand font-semibold">{formatRupiah(Number(s.price))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditService(s)}>
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
                                <AlertDialogTitle>Hapus Layanan?</AlertDialogTitle>
                                <AlertDialogDescription>Layanan "{s.name}" akan dihapus permanen.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() => deleteService.mutateAsync(s.id).then(() => toast.success('Layanan dihapus')).catch(() => toast.error('Gagal menghapus'))}
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
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={productDialog.open} onOpenChange={open => setProductDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productDialog.editing ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Produk</Label>
              <Input
                value={productForm.name}
                onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Oli Mesin 1L"
                disabled={!!productDialog.editing}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Harga (Rp)</Label>
              <Input
                type="number"
                value={productForm.price}
                onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}
                placeholder="50000"
                disabled={!!productDialog.editing}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Stok</Label>
              <Input
                type="number"
                value={productForm.stock}
                onChange={e => setProductForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="10"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog({ open: false })}>Batal</Button>
            <Button
              className="bg-brand hover:bg-brand-dark text-white"
              onClick={handleSaveProduct}
              disabled={addProduct.isPending || updateStock.isPending}
            >
              {addProduct.isPending || updateStock.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialog.open} onOpenChange={open => setServiceDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{serviceDialog.editing ? 'Edit Layanan' : 'Tambah Layanan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Layanan</Label>
              <Input
                value={serviceForm.name}
                onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Ganti Oli"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Harga (Rp)</Label>
              <Input
                type="number"
                value={serviceForm.price}
                onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))}
                placeholder="75000"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input
                value={serviceForm.description}
                onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi singkat layanan"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialog({ open: false })}>Batal</Button>
            <Button
              className="bg-brand hover:bg-brand-dark text-white"
              onClick={handleSaveService}
              disabled={addService.isPending}
            >
              {addService.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
