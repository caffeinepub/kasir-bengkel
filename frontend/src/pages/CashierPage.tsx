import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Search, Printer, ShoppingCart, User, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Receipt from '@/components/Receipt';
import { useProducts, useServices, useCreateTransaction, useShopSettings, useCustomers, useAddCustomer, useUpdateProductStock } from '@/hooks/useQueries';
import { formatRupiah } from '@/lib/utils';
import type { Transaction, TransactionItem } from '../backend';
import { ItemType } from '../backend';

interface CartItem {
  id: bigint;
  name: string;
  price: bigint;
  quantity: number;
  itemType: 'service' | 'product';
  stock?: number;
}

export default function CashierPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [discount, setDiscount] = useState(0);
  const [printTransaction, setPrintTransaction] = useState<Transaction | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: products = [] } = useProducts();
  const { data: services = [] } = useServices();
  const { data: settings } = useShopSettings();
  const { data: customers = [] } = useCustomers();
  const createTransaction = useCreateTransaction();
  const addCustomer = useAddCustomer();
  const updateStock = useUpdateProductStock();

  const allItems = [
    ...services.map(s => ({ id: s.id, name: s.name, price: s.price, itemType: 'service' as const, stock: undefined })),
    ...products.map(p => ({ id: p.id, name: p.name, price: p.price, itemType: 'product' as const, stock: Number(p.stock) })),
  ];

  const filtered = allItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: typeof allItems[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.itemType === item.itemType);
      if (existing) {
        if (item.itemType === 'product' && item.stock !== undefined && existing.quantity >= item.stock) {
          toast.error('Stok tidak mencukupi');
          return prev;
        }
        return prev.map(c =>
          c.id === item.id && c.itemType === item.itemType
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      if (item.itemType === 'product' && item.stock !== undefined && item.stock <= 0) {
        toast.error('Stok habis');
        return prev;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id: bigint, type: string, delta: number) => {
    setCart(prev => prev
      .map(c => {
        if (c.id === id && c.itemType === type) {
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null as unknown as CartItem;
          if (c.itemType === 'product' && c.stock !== undefined && newQty > c.stock) {
            toast.error('Stok tidak mencukupi');
            return c;
          }
          return { ...c, quantity: newQty };
        }
        return c;
      })
      .filter(Boolean)
    );
  };

  const removeFromCart = (id: bigint, type: string) => {
    setCart(prev => prev.filter(c => !(c.id === id && c.itemType === type)));
  };

  const subtotal = cart.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0);
  const discountAmount = Math.round(subtotal * (discount / 100));
  const total = subtotal - discountAmount;

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }
    if (!customerName.trim()) { toast.error('Nama pelanggan harus diisi'); return; }

    const items: TransactionItem[] = cart.map(c => ({
      id: c.id,
      name: c.name,
      price: c.price,
      quantity: BigInt(c.quantity),
      itemType: c.itemType === 'service' ? ItemType.service : ItemType.product,
    }));

    try {
      const txId = await createTransaction.mutateAsync({
        items,
        total: BigInt(total),
        customerName: customerName.trim(),
        vehicleInfo: vehicleInfo.trim(),
      });

      // Update stock for products
      for (const c of cart) {
        if (c.itemType === 'product') {
          const product = products.find(p => p.id === c.id);
          if (product) {
            const newStock = Number(product.stock) - c.quantity;
            await updateStock.mutateAsync({ productId: c.id, newStock: BigInt(Math.max(0, newStock)) });
          }
        }
      }

      // Save customer if new
      if (customerName.trim() && !customers.includes(customerName.trim())) {
        await addCustomer.mutateAsync(customerName.trim());
      }

      const tx: Transaction = {
        id: txId,
        timestamp: BigInt(Date.now()) * BigInt(1_000_000),
        items,
        total: BigInt(total),
        customerName: customerName.trim(),
        vehicleInfo: vehicleInfo.trim(),
      };

      setPrintTransaction(tx);
      setCart([]);
      setCustomerName('');
      setVehicleInfo('');
      setDiscount(0);
      toast.success('Transaksi berhasil!');

      setTimeout(() => window.print(), 300);
    } catch (err) {
      toast.error('Gagal membuat transaksi');
    }
  }, [cart, customerName, vehicleInfo, total, createTransaction, products, updateStock, addCustomer, customers]);

  const filteredCustomers = customers.filter(c =>
    c.toLowerCase().includes(customerName.toLowerCase()) && c !== customerName
  );

  return (
    <div className="flex h-full">
      {/* Print-only receipt */}
      {printTransaction && (
        <div className="print-only">
          <Receipt ref={receiptRef} transaction={printTransaction} settings={settings ?? null} />
        </div>
      )}

      {/* Left: Catalog */}
      <div className="flex-1 flex flex-col p-6 border-r border-border">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">Kasir</h1>
          <p className="text-muted-foreground text-sm">Pilih layanan atau produk untuk ditambahkan ke keranjang</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari layanan atau produk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-2">
            {filtered.map(item => (
              <button
                key={`${item.itemType}-${item.id}`}
                onClick={() => addToCart(item)}
                disabled={item.itemType === 'product' && (item.stock ?? 0) <= 0}
                className="text-left p-3 rounded-xl border border-border bg-card hover:border-brand hover:bg-brand/5 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-card-foreground truncate">{item.name}</p>
                    <p className="text-brand font-bold text-sm mt-0.5">{formatRupiah(Number(item.price))}</p>
                  </div>
                  <Badge variant={item.itemType === 'service' ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {item.itemType === 'service' ? 'Jasa' : 'Produk'}
                  </Badge>
                </div>
                {item.itemType === 'product' && (
                  <p className="text-xs text-muted-foreground mt-1">Stok: {item.stock}</p>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-3 h-3" /> Tambah
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Tidak ada item ditemukan</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col bg-card border-l border-border">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-brand" />
            <h2 className="font-bold text-lg">Keranjang</h2>
            {cart.length > 0 && (
              <Badge className="bg-brand text-white ml-auto">{cart.length}</Badge>
            )}
          </div>

          {/* Customer Info */}
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nama pelanggan *"
                value={customerName}
                onChange={e => { setCustomerName(e.target.value); setShowCustomerSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                className="pl-9"
              />
              {showCustomerSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-popover border border-border rounded-lg shadow-lg mt-1 max-h-32 overflow-auto">
                  {filteredCustomers.map(c => (
                    <button
                      key={c}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onMouseDown={() => { setCustomerName(c); setShowCustomerSuggestions(false); }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Info kendaraan (plat/tipe)"
                value={vehicleInfo}
                onChange={e => setVehicleInfo(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 px-4 py-3">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Keranjang kosong</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={`${item.itemType}-${item.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-brand">{formatRupiah(Number(item.price))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(item.id, item.itemType, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(item.id, item.itemType, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.id, item.itemType)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Summary */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Diskon (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={discount}
              onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon ({discount}%)</span>
                <span>-{formatRupiah(discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-brand">{formatRupiah(total)}</span>
            </div>
          </div>
          <Button
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold"
            size="lg"
            onClick={handleCheckout}
            disabled={createTransaction.isPending || cart.length === 0}
          >
            {createTransaction.isPending ? (
              <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Memproses...</span>
            ) : (
              <span className="flex items-center gap-2"><Printer className="w-4 h-4" /> Bayar & Cetak Struk</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Fix missing import
function Package(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  );
}
