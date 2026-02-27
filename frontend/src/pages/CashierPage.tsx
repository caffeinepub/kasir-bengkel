import { useState, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Printer, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useInventoryItems,
  useCreateTransaction,
  useUpdateInventoryQuantity,
  useShopSettings,
} from '@/hooks/useQueries';
import { ProductType, type InventoryItem } from '@/backend';
import { formatRupiah } from '@/lib/utils';
import Receipt from '@/components/Receipt';

interface CartItem {
  inventoryItem: InventoryItem;
  quantity: number;
}

export default function CashierPage() {
  const { data: inventoryItems = [] } = useInventoryItems();
  const { data: shopSettings } = useShopSettings();
  const createTransaction = useCreateTransaction();
  const updateQty = useUpdateInventoryQuantity();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [discount, setDiscount] = useState('0');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{
    id: bigint;
    items: CartItem[];
    total: number;
    customerName: string;
    vehicleInfo: string;
    timestamp: Date;
  } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (item.productType === ProductType.service ||
        (item.quantity !== undefined && item.quantity !== null && Number(item.quantity) > 0))
  );

  function addToCart(item: InventoryItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryItem.id === item.id);
      if (existing) {
        const maxQty =
          item.productType === ProductType.goods ? Number(item.quantity) : Infinity;
        if (existing.quantity >= maxQty) {
          toast.warning('Stok tidak mencukupi');
          return prev;
        }
        return prev.map((c) =>
          c.inventoryItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { inventoryItem: item, quantity: 1 }];
    });
  }

  function updateCartQty(itemId: bigint, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.inventoryItem.id !== itemId) return c;
          const maxQty =
            c.inventoryItem.productType === ProductType.goods
              ? Number(c.inventoryItem.quantity)
              : Infinity;
          const newQty = Math.min(Math.max(0, c.quantity + delta), maxQty);
          return { ...c, quantity: newQty };
        })
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(itemId: bigint) {
    setCart((prev) => prev.filter((c) => c.inventoryItem.id !== itemId));
  }

  const subtotal = cart.reduce(
    (sum, c) => sum + Number(c.inventoryItem.sellingPrice) * c.quantity,
    0
  );
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountAmount;

  async function handleCheckout() {
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Nama pelanggan harus diisi');
      return;
    }

    try {
      const transactionItems = cart.map((c) => ({
        id: c.inventoryItem.id,
        name: c.inventoryItem.name,
        price: c.inventoryItem.sellingPrice,
        quantity: BigInt(c.quantity),
        itemType: c.inventoryItem.productType,
      }));

      const txId = await createTransaction.mutateAsync({
        items: transactionItems,
        total: BigInt(total),
        customerName: customerName.trim(),
        vehicleInfo: vehicleInfo.trim(),
      });

      // Deduct stock for goods
      for (const c of cart) {
        if (
          c.inventoryItem.productType === ProductType.goods &&
          c.inventoryItem.quantity !== undefined &&
          c.inventoryItem.quantity !== null
        ) {
          const newQty = Number(c.inventoryItem.quantity) - c.quantity;
          if (newQty >= 0) {
            await updateQty.mutateAsync({
              itemId: c.inventoryItem.id,
              newQuantity: BigInt(newQty),
            });
          }
        }
      }

      setLastTransaction({
        id: txId,
        items: [...cart],
        total,
        customerName: customerName.trim(),
        vehicleInfo: vehicleInfo.trim(),
        timestamp: new Date(),
      });

      toast.success('Transaksi berhasil dibuat!');
      setShowCheckoutDialog(false);
      setShowReceiptDialog(true);
      setCart([]);
      setCustomerName('');
      setVehicleInfo('');
      setDiscount('0');
    } catch (e: unknown) {
      toast.error(
        'Gagal membuat transaksi: ' + (e instanceof Error ? e.message : String(e))
      );
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex h-full gap-0">
      {/* Left: Product List */}
      <div className="flex-1 p-6 overflow-auto border-r border-border">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">Kasir</h1>
          <p className="text-sm text-muted-foreground">
            Pilih barang atau jasa untuk ditambahkan ke keranjang
          </p>
        </div>
        <div className="relative mb-4 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari barang atau jasa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <button
              key={String(item.id)}
              onClick={() => addToCart(item)}
              className="text-left p-4 rounded-lg border bg-card hover:border-brand hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-sm text-foreground group-hover:text-brand transition-colors line-clamp-2">
                  {item.name}
                </span>
                <Badge
                  variant={item.productType === ProductType.goods ? 'default' : 'secondary'}
                  className="ml-2 shrink-0 text-xs"
                >
                  {item.productType === ProductType.goods ? 'Barang' : 'Jasa'}
                </Badge>
              </div>
              <p className="text-brand font-semibold text-sm">
                {formatRupiah(Number(item.sellingPrice))}
              </p>
              {item.productType === ProductType.goods && (
                <p className="text-xs text-muted-foreground mt-1">
                  Stok: {String(item.quantity)}
                </p>
              )}
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-3 text-center py-10 text-muted-foreground text-sm">
              {search ? 'Tidak ada barang yang cocok' : 'Tidak ada barang tersedia'}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col bg-card border-l border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand" />
            <h2 className="font-semibold text-foreground">Keranjang</h2>
            {cart.length > 0 && (
              <Badge variant="default" className="ml-auto">
                {cart.length}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Keranjang kosong
            </div>
          ) : (
            cart.map((c) => (
              <div
                key={String(c.inventoryItem.id)}
                className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.inventoryItem.name}</p>
                  <p className="text-xs text-brand">
                    {formatRupiah(Number(c.inventoryItem.sellingPrice))}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateCartQty(c.inventoryItem.id, -1)}
                  >
                    <Minus size={12} />
                  </Button>
                  <span className="text-xs w-5 text-center font-medium">{c.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateCartQty(c.inventoryItem.id, 1)}
                  >
                    <Plus size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeFromCart(c.inventoryItem.id)}
                  >
                    <X size={12} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nama Pelanggan</Label>
            <Input
              placeholder="Nama pelanggan"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Info Kendaraan</Label>
            <Input
              placeholder="Plat nomor / tipe kendaraan"
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Diskon (Rp)</Label>
            <Input
              type="number"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Diskon</span>
                <span>- {formatRupiah(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-1">
              <span>Total</span>
              <span className="text-brand">{formatRupiah(total)}</span>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={cart.length === 0 || createTransaction.isPending}
            onClick={() => setShowCheckoutDialog(true)}
          >
            {createTransaction.isPending ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <ShoppingCart size={16} className="mr-2" />
            )}
            Bayar
          </Button>
        </div>
      </div>

      {/* Checkout Confirmation Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
            <DialogDescription>
              Periksa detail transaksi sebelum memproses pembayaran.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pelanggan</span>
                <span className="font-medium">{customerName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kendaraan</span>
                <span className="font-medium">{vehicleInfo || '—'}</span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((c) => (
                  <TableRow key={String(c.inventoryItem.id)}>
                    <TableCell className="text-sm">{c.inventoryItem.name}</TableCell>
                    <TableCell className="text-center text-sm">{c.quantity}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatRupiah(Number(c.inventoryItem.sellingPrice) * c.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-sm space-y-1 border-t pt-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Diskon</span>
                  <span>- {formatRupiah(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-brand">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleCheckout} disabled={createTransaction.isPending}>
              {createTransaction.isPending && (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              )}
              Proses Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>
          {lastTransaction && (
            <Receipt
              ref={receiptRef}
              transaction={{
                id: lastTransaction.id,
                customerName: lastTransaction.customerName,
                vehicleInfo: lastTransaction.vehicleInfo,
                total: BigInt(lastTransaction.total),
                timestamp: BigInt(lastTransaction.timestamp.getTime()) * 1_000_000n,
                items: lastTransaction.items.map((c) => ({
                  id: c.inventoryItem.id,
                  name: c.inventoryItem.name,
                  price: c.inventoryItem.sellingPrice,
                  quantity: BigInt(c.quantity),
                  itemType: c.inventoryItem.productType,
                })),
              }}
              shopSettings={shopSettings ?? undefined}
              discount={discountAmount}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Tutup
            </Button>
            <Button onClick={handlePrint}>
              <Printer size={14} className="mr-1.5" />
              Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
