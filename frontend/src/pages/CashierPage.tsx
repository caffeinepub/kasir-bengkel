import { useState, useEffect } from 'react';
import { useInventoryItems, useCreateTransaction, useShopSettings } from '../hooks/useQueries';
import { InventoryItem, ItemKind, TransactionItem, Transaction, ShopSettings } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ShoppingCart, Plus, Minus, Trash2, Receipt, Printer, X } from 'lucide-react';
import { formatRupiah } from '../lib/utils';
import { toast } from 'sonner';
import ReceiptComponent from '../components/Receipt';
import { readWorkOrderNavData, clearWorkOrderNavData } from '../lib/urlParams';

interface CartItem {
  inventoryItem: InventoryItem;
  quantity: number;
}

export default function CashierPage() {
  const { data: inventoryItems = [], isLoading: inventoryLoading } = useInventoryItems();
  const { data: shopSettings } = useShopSettings();
  const createTransaction = useCreateTransaction();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [completedShopSettings, setCompletedShopSettings] = useState<ShopSettings | null>(null);

  // Auto-fill from work order navigation data
  useEffect(() => {
    const navData = readWorkOrderNavData();
    if (navData) {
      if (navData.customerName) setCustomerName(navData.customerName);
      if (navData.customerPhone) setCustomerPhone(navData.customerPhone);
      if (navData.vehicleInfo) setVehicleInfo(navData.vehicleInfo);
      clearWorkOrderNavData();
    }
  }, []);

  const filteredItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const goodsItems = filteredItems.filter(item => item.kind === ItemKind.goods);
  const serviceItems = filteredItems.filter(item => item.kind === ItemKind.service);

  const addToCart = (item: InventoryItem) => {
    if (item.kind === ItemKind.goods && (item.quantity === undefined || item.quantity === null || item.quantity <= 0n)) {
      toast.error('Stok habis');
      return;
    }

    setCart(prev => {
      const existing = prev.find(c => c.inventoryItem.id === item.id);
      if (existing) {
        const maxQty = item.kind === ItemKind.goods ? Number(item.quantity ?? 0n) : 999;
        if (existing.quantity >= maxQty) {
          toast.error('Stok tidak mencukupi');
          return prev;
        }
        return prev.map(c =>
          c.inventoryItem.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { inventoryItem: item, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart(prev =>
      prev.map(c => {
        if (c.inventoryItem.id !== itemId) return c;
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c;
        const maxQty = c.inventoryItem.kind === ItemKind.goods
          ? Number(c.inventoryItem.quantity ?? 0n)
          : 999;
        if (newQty > maxQty) {
          toast.error('Stok tidak mencukupi');
          return c;
        }
        return { ...c, quantity: newQty };
      })
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.inventoryItem.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + Number(c.inventoryItem.sellingPrice) * c.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    const transactionItems: TransactionItem[] = cart.map(c => ({
      id: c.inventoryItem.id,
      name: c.inventoryItem.name,
      price: c.inventoryItem.sellingPrice,
      quantity: BigInt(c.quantity),
      itemType: c.inventoryItem.kind,
    }));

    try {
      const transactionId = await createTransaction.mutateAsync({
        items: transactionItems,
        total: BigInt(cartTotal),
        customerName,
        customerPhone,
        vehicleInfo,
      });

      const transaction: Transaction = {
        id: transactionId,
        timestamp: BigInt(Date.now()) * 1_000_000n,
        items: transactionItems,
        total: BigInt(cartTotal),
        customerName,
        customerPhone,
        vehicleInfo,
      };

      setCompletedTransaction(transaction);
      setCompletedShopSettings(shopSettings ?? null);
      setShowReceipt(true);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setVehicleInfo('');
      toast.success('Transaksi berhasil!');
    } catch (error) {
      toast.error('Gagal membuat transaksi');
      console.error(error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk atau layanan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {inventoryLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Memuat produk...
            </div>
          ) : (
            <div className="space-y-4">
              {serviceItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Layanan</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {serviceItems.map(item => (
                      <Card
                        key={item.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => addToCart(item)}
                      >
                        <CardContent className="p-3">
                          <p className="font-medium text-sm leading-tight mb-1 line-clamp-2">{item.name}</p>
                          <p className="text-primary font-bold text-sm">{formatRupiah(Number(item.sellingPrice))}</p>
                          <Badge variant="secondary" className="mt-1 text-xs">Jasa</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {goodsItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Barang</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {goodsItems.map(item => {
                      const outOfStock = item.quantity === undefined || item.quantity === null || item.quantity <= 0n;
                      return (
                        <Card
                          key={item.id}
                          className={`cursor-pointer transition-colors ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}`}
                          onClick={() => !outOfStock && addToCart(item)}
                        >
                          <CardContent className="p-3">
                            <p className="font-medium text-sm leading-tight mb-1 line-clamp-2">{item.name}</p>
                            <p className="text-primary font-bold text-sm">{formatRupiah(Number(item.sellingPrice))}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant={outOfStock ? 'destructive' : 'outline'} className="text-xs">
                                {outOfStock ? 'Habis' : `Stok: ${item.quantity}`}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredItems.length === 0 && (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  Tidak ada produk ditemukan
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col gap-3 shrink-0">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Keranjang
              {cart.length > 0 && (
                <Badge className="ml-auto">{cart.reduce((s, c) => s + c.quantity, 0)}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3 p-3 pt-0">
            {/* Customer Info */}
            <div className="space-y-2">
              <Input
                placeholder="Nama pelanggan"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Nomor HP"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Info kendaraan (plat, merk, tipe)"
                value={vehicleInfo}
                onChange={e => setVehicleInfo(e.target.value)}
                className="text-sm"
              />
            </div>

            <Separator />

            {/* Cart Items */}
            <ScrollArea className="flex-1 max-h-64">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Keranjang kosong</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(c => (
                    <div key={c.inventoryItem.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.inventoryItem.name}</p>
                        <p className="text-xs text-muted-foreground">{formatRupiah(Number(c.inventoryItem.sellingPrice))}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateCartQuantity(c.inventoryItem.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs w-5 text-center">{c.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateCartQuantity(c.inventoryItem.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeFromCart(c.inventoryItem.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator />

            {/* Total */}
            <div className="flex justify-between items-center font-bold">
              <span>Total</span>
              <span className="text-primary">{formatRupiah(cartTotal)}</span>
            </div>

            {/* Checkout Button */}
            <Button
              className="w-full"
              onClick={handleCheckout}
              disabled={cart.length === 0 || createTransaction.isPending}
            >
              {createTransaction.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Bayar {cart.length > 0 ? formatRupiah(cartTotal) : ''}
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Struk Pembayaran
            </DialogTitle>
          </DialogHeader>

          {completedTransaction && (
            <ReceiptComponent
              transaction={completedTransaction}
              shopSettings={completedShopSettings ?? undefined}
            />
          )}

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>
              <X className="h-4 w-4 mr-2" />
              Tutup
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
