import { useState, useEffect } from 'react';
import { useInventoryItems, useCreateTransaction, useShopSettings } from '../hooks/useQueries';
import { InventoryItem, ItemKind, TransactionItem } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Search, Plus, Minus, Trash2, Printer, CheckCircle, Loader2 } from 'lucide-react';
import { formatRupiah } from '../lib/utils';
import { readWorkOrderNavData, clearWorkOrderNavData } from '../lib/urlParams';
import Receipt from '../components/Receipt';
import { toast } from 'sonner';

interface CartItem {
  item: InventoryItem;
  quantity: number;
}

export default function CashierPage() {
  const { data: inventoryItems = [], isLoading: itemsLoading } = useInventoryItems();
  const { data: shopSettings } = useShopSettings();
  const createTransaction = useCreateTransaction();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransactionId, setCompletedTransactionId] = useState<bigint | null>(null);
  const [completedCart, setCompletedCart] = useState<CartItem[]>([]);
  const [completedCustomerName, setCompletedCustomerName] = useState('');
  const [completedCustomerPhone, setCompletedCustomerPhone] = useState('');
  const [completedVehicleInfo, setCompletedVehicleInfo] = useState('');
  const [completedTotal, setCompletedTotal] = useState(0);

  // Auto-fill from work order navigation data
  useEffect(() => {
    const navData = readWorkOrderNavData();
    if (navData) {
      setCustomerName(navData.customerName || '');
      setCustomerPhone(navData.customerPhone || '');
      setVehicleInfo(navData.vehicleInfo || '');
      clearWorkOrderNavData();
    }
  }, []);

  const filteredItems = inventoryItems.filter(
    (item) => item.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        if (item.kind === ItemKind.goods && item.quantity !== undefined && item.quantity !== null) {
          const maxQty = Number(item.quantity);
          if (existing.quantity >= maxQty) {
            toast.error(`Stok ${item.name} tidak mencukupi`);
            return prev;
          }
        }
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id !== itemId) return c;
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (delta > 0 && c.item.kind === ItemKind.goods && c.item.quantity !== undefined && c.item.quantity !== null) {
            const maxQty = Number(c.item.quantity);
            if (newQty > maxQty) {
              toast.error(`Stok ${c.item.name} tidak mencukupi`);
              return c;
            }
          }
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const total = cart.reduce((sum, c) => sum + Number(c.item.sellingPrice) * c.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang masih kosong');
      return;
    }

    const transactionItems: TransactionItem[] = cart.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      price: c.item.sellingPrice,
      quantity: BigInt(c.quantity),
      itemType: c.item.kind,
    }));

    try {
      const id = await createTransaction.mutateAsync({
        items: transactionItems,
        total: BigInt(total),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        vehicleInfo: vehicleInfo.trim(),
      });

      // Save completed transaction data for receipt
      setCompletedTransactionId(id);
      setCompletedCart([...cart]);
      setCompletedCustomerName(customerName);
      setCompletedCustomerPhone(customerPhone);
      setCompletedVehicleInfo(vehicleInfo);
      setCompletedTotal(total);
      setShowReceipt(true);

      // Clear cart and form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setVehicleInfo('');
      toast.success('Transaksi berhasil disimpan');
    } catch {
      toast.error('Gagal menyimpan transaksi');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNewTransaction = () => {
    setShowReceipt(false);
    setCompletedTransactionId(null);
    setCompletedCart([]);
  };

  // Build the Transaction object for Receipt
  const receiptTransaction = completedTransactionId !== null ? {
    id: completedTransactionId,
    items: completedCart.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      price: c.item.sellingPrice,
      quantity: BigInt(c.quantity),
      itemType: c.item.kind,
    })),
    total: BigInt(completedTotal),
    customerName: completedCustomerName,
    customerPhone: completedCustomerPhone,
    vehicleInfo: completedVehicleInfo,
    timestamp: BigInt(Date.now()) * 1_000_000n,
  } : null;

  return (
    <div className="flex h-full">
      {/* Left: Product Catalog */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Kasir</h1>
          <p className="text-muted-foreground text-sm mt-1">Pilih produk atau layanan untuk ditambahkan ke keranjang</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk atau layanan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Items Grid */}
        <ScrollArea className="flex-1">
          {itemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Tidak ada produk ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-4">
              {filteredItems.map((item) => {
                const outOfStock =
                  item.kind === ItemKind.goods &&
                  (item.quantity === undefined || item.quantity === null || Number(item.quantity) === 0);
                return (
                  <button
                    key={item.id}
                    onClick={() => !outOfStock && addToCart(item)}
                    disabled={outOfStock}
                    className={`text-left p-3 rounded-lg border bg-card transition-all hover:shadow-md hover:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30 ${
                      outOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="font-medium text-sm text-foreground line-clamp-2 mb-1">{item.name}</div>
                    <div className="text-brand font-semibold text-sm">{formatRupiah(Number(item.sellingPrice))}</div>
                    <div className="mt-1">
                      {item.kind === ItemKind.service ? (
                        <Badge variant="secondary" className="text-xs">Jasa</Badge>
                      ) : outOfStock ? (
                        <Badge variant="destructive" className="text-xs">Habis</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Stok: {Number(item.quantity)}</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Cart */}
      <div className="w-80 border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Keranjang
            {cart.length > 0 && (
              <Badge className="ml-auto">{cart.reduce((s, c) => s + c.quantity, 0)}</Badge>
            )}
          </h2>
        </div>

        {/* Customer Info */}
        <div className="p-4 border-b space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nama Pelanggan</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama pelanggan"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">No. HP</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Info Kendaraan</Label>
            <Input
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
              placeholder="Honda Beat 2020, B 1234 ABC"
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Keranjang kosong
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((c) => (
                <div key={c.item.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{c.item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatRupiah(Number(c.item.sellingPrice))}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQuantity(c.item.id, -1)}
                      className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{c.quantity}</span>
                    <button
                      onClick={() => updateQuantity(c.item.id, 1)}
                      className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(c.item.id)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Total & Checkout */}
        <div className="p-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Subtotal</span>
            <span className="font-semibold text-foreground">{formatRupiah(total)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-bold text-xl text-brand">{formatRupiah(total)}</span>
          </div>
          <Button
            className="w-full"
            onClick={handleCheckout}
            disabled={cart.length === 0 || createTransaction.isPending}
          >
            {createTransaction.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {createTransaction.isPending ? 'Memproses...' : 'Bayar'}
          </Button>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Transaksi Berhasil
            </DialogTitle>
            <DialogDescription>
              Transaksi #{completedTransactionId?.toString()} telah disimpan
            </DialogDescription>
          </DialogHeader>
          {receiptTransaction && (
            <Receipt
              transaction={receiptTransaction}
              shopSettings={shopSettings ?? undefined}
            />
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>
            <Button onClick={handleNewTransaction}>
              Transaksi Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
