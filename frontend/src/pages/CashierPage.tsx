import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, Minus, ShoppingCart, Printer, Loader2, X, Settings2,
} from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  useInventoryItems,
  useCreateTransaction,
  useUpdateInventoryQuantity,
  useShopSettings,
} from '@/hooks/useQueries';
import { ItemKind, type InventoryItem } from '@/backend';
import { formatRupiah } from '@/lib/utils';
import Receipt from '@/components/Receipt';

interface CartItem {
  inventoryItem: InventoryItem;
  quantity: number;
}

const MAX_DISPLAY = 10;
const PINNED_STORAGE_KEY = 'cashier-pinned-items';

function loadPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // ignore
  }
  return [];
}

function savePinnedIds(ids: string[]) {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
}

export default function CashierPage() {
  const { data: inventoryItems = [] } = useInventoryItems();
  const { data: shopSettings } = useShopSettings();
  const createTransaction = useCreateTransaction();
  const updateQty = useUpdateInventoryQuantity();

  // ── Cart state ──────────────────────────────────────────────────────────────
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

  // ── Pinned items (persisted in localStorage) ────────────────────────────────
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => loadPinnedIds());
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [tempPinnedIds, setTempPinnedIds] = useState<Set<string>>(new Set());

  // ── Unified search ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // ── All available items (services always available, goods only if in stock) ──
  const allAvailableItems = inventoryItems.filter(
    (item) =>
      item.kind === ItemKind.service ||
      (item.kind === ItemKind.goods &&
        item.quantity !== undefined &&
        item.quantity !== null &&
        Number(item.quantity) > 0)
  );

  // ── Pinned items to display (max 10) ────────────────────────────────────────
  const displayedItems: InventoryItem[] = (() => {
    if (pinnedIds.length > 0) {
      // Show pinned items that still exist in inventory
      return pinnedIds
        .map((id) => allAvailableItems.find((item) => item.id === id))
        .filter((item): item is InventoryItem => item !== undefined)
        .slice(0, MAX_DISPLAY);
    }
    // Default: first MAX_DISPLAY available items
    return allAvailableItems.slice(0, MAX_DISPLAY);
  })();

  // ── Search results (popup) ──────────────────────────────────────────────────
  const searchResults = searchQuery.trim().length > 0
    ? allAvailableItems.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20)
    : [];

  // Close popup on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Open config dialog ──────────────────────────────────────────────────────
  function openConfig() {
    const currentPinned = pinnedIds.length > 0
      ? new Set(pinnedIds)
      : new Set(allAvailableItems.slice(0, MAX_DISPLAY).map((i) => i.id));
    setTempPinnedIds(currentPinned);
    setShowConfigDialog(true);
  }

  function saveConfig() {
    const ids = Array.from(tempPinnedIds);
    setPinnedIds(ids);
    savePinnedIds(ids);
    setShowConfigDialog(false);
    toast.success('Pengaturan tampilan produk disimpan');
  }

  function toggleTempPinned(id: string) {
    setTempPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_DISPLAY) {
          toast.warning(`Maksimal ${MAX_DISPLAY} item yang bisa dipilih`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  // ── Cart operations ─────────────────────────────────────────────────────────
  const addToCart = useCallback((item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryItem.id === item.id);
      if (existing) {
        const maxQty =
          item.kind === ItemKind.goods ? Number(item.quantity) : Infinity;
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
  }, []);

  function addToCartFromSearch(item: InventoryItem) {
    addToCart(item);
    setSearchQuery('');
    setShowSearchPopup(false);
  }

  function updateCartQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.inventoryItem.id !== itemId) return c;
          const maxQty =
            c.inventoryItem.kind === ItemKind.goods
              ? Number(c.inventoryItem.quantity)
              : Infinity;
          const newQty = Math.min(Math.max(0, c.quantity + delta), maxQty);
          return { ...c, quantity: newQty };
        })
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((c) => c.inventoryItem.id !== itemId));
  }

  const subtotal = cart.reduce(
    (sum, c) => sum + Number(c.inventoryItem.sellingPrice) * c.quantity,
    0
  );
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountAmount;

  // ── Checkout ────────────────────────────────────────────────────────────────
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
        itemType: c.inventoryItem.kind,
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
          c.inventoryItem.kind === ItemKind.goods &&
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

  // ── Product card ────────────────────────────────────────────────────────────
  function ProductCard({ item }: { item: InventoryItem }) {
    const inCart = cart.find((c) => c.inventoryItem.id === item.id);
    return (
      <button
        onClick={() => addToCart(item)}
        className="relative text-left p-3 rounded-lg border bg-card hover:border-brand hover:shadow-sm transition-all group w-full"
      >
        {inCart && (
          <span className="absolute top-2 right-2 bg-brand text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {inCart.quantity}
          </span>
        )}
        <div className="flex items-start gap-1.5 mb-1">
          <span className="text-xs mt-0.5 shrink-0">
            {item.kind === ItemKind.service ? '🔧' : '📦'}
          </span>
          <p className="font-medium text-xs text-foreground group-hover:text-brand transition-colors line-clamp-2 pr-5">
            {item.name}
          </p>
        </div>
        <p className="text-brand font-semibold text-xs">
          {formatRupiah(Number(item.sellingPrice))}
        </p>
        {item.kind === ItemKind.goods && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Stok: {String(item.quantity)}
          </p>
        )}
      </button>
    );
  }

  return (
    <div className="flex h-full gap-0">
      {/* ── Left: Product Display ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">Kasir</h1>
            <p className="text-xs text-muted-foreground">
              Pilih produk untuk ditambahkan ke keranjang
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openConfig}>
            <Settings2 size={15} className="mr-1.5" />
            Pilih Tampilan
          </Button>
        </div>

        {/* Unified search bar */}
        <div className="px-5 pb-3 shrink-0" ref={searchRef}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="Cari barang atau jasa..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchPopup(e.target.value.trim().length > 0);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setShowSearchPopup(true);
              }}
              className="pl-9 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchPopup(false);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}

            {/* Search popup */}
            {showSearchPopup && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                    Tidak ada produk yang cocok
                  </div>
                ) : (
                  <ScrollArea className="max-h-64">
                    <div className="py-1">
                      {searchResults.map((item) => {
                        const inCart = cart.find((c) => c.inventoryItem.id === item.id);
                        return (
                          <button
                            key={item.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addToCartFromSearch(item);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors"
                          >
                            <span className="text-base shrink-0">
                              {item.kind === ItemKind.service ? '🔧' : '📦'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">
                                {item.name}
                              </p>
                              <p className="text-xs text-brand">
                                {formatRupiah(Number(item.sellingPrice))}
                                {item.kind === ItemKind.goods && (
                                  <span className="text-muted-foreground ml-2">
                                    Stok: {String(item.quantity)}
                                  </span>
                                )}
                              </p>
                            </div>
                            {inCart && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {inCart.quantity} di keranjang
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pinned product grid */}
        <div className="px-4 pb-2 shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Produk Cepat
          </span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {displayedItems.length}/{MAX_DISPLAY}
          </Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {displayedItems.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                <p className="mb-2">Belum ada produk yang dipilih untuk ditampilkan</p>
                <Button variant="outline" size="sm" onClick={openConfig}>
                  <Settings2 size={14} className="mr-1.5" />
                  Pilih Tampilan
                </Button>
              </div>
            ) : (
              displayedItems.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right: Cart ───────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col bg-card border-l border-border shrink-0">
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

      {/* ── Config Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pilih Produk Tampilan Kasir</DialogTitle>
            <DialogDescription>
              Pilih hingga {MAX_DISPLAY} produk (barang/jasa) yang akan ditampilkan sebagai tombol cepat di halaman kasir.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Semua Produk ({allAvailableItems.length} tersedia)
              </span>
              <span className={`text-sm font-semibold ${tempPinnedIds.size >= MAX_DISPLAY ? 'text-destructive' : 'text-brand'}`}>
                {tempPinnedIds.size}/{MAX_DISPLAY} dipilih
              </span>
            </div>

            {allAvailableItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Belum ada produk di inventori
              </div>
            ) : (
              <ScrollArea className="h-80 rounded-md border">
                <div className="p-2 space-y-1">
                  {/* Services first */}
                  {allAvailableItems.filter(i => i.kind === ItemKind.service).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                        🔧 Jasa
                      </p>
                      {allAvailableItems
                        .filter((i) => i.kind === ItemKind.service)
                        .map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={tempPinnedIds.has(item.id)}
                              onCheckedChange={() => toggleTempPinned(item.id)}
                              disabled={!tempPinnedIds.has(item.id) && tempPinnedIds.size >= MAX_DISPLAY}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-brand">
                                {formatRupiah(Number(item.sellingPrice))}
                              </p>
                            </div>
                          </label>
                        ))}
                    </>
                  )}

                  {/* Goods */}
                  {allAvailableItems.filter(i => i.kind === ItemKind.goods).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1 mt-2">
                        📦 Barang
                      </p>
                      {allAvailableItems
                        .filter((i) => i.kind === ItemKind.goods)
                        .map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={tempPinnedIds.has(item.id)}
                              onCheckedChange={() => toggleTempPinned(item.id)}
                              disabled={!tempPinnedIds.has(item.id) && tempPinnedIds.size >= MAX_DISPLAY}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-brand">
                                {formatRupiah(Number(item.sellingPrice))}
                                <span className="text-muted-foreground ml-2">
                                  Stok: {String(item.quantity)}
                                </span>
                              </p>
                            </div>
                          </label>
                        ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            )}

            {tempPinnedIds.size >= MAX_DISPLAY && (
              <p className="text-xs text-destructive mt-2">
                ⚠ Batas maksimal {MAX_DISPLAY} item tercapai. Hapus centang item lain untuk memilih yang baru.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Batal
            </Button>
            <Button onClick={saveConfig}>
              Simpan Tampilan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Checkout Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
            <DialogDescription>
              Periksa kembali pesanan sebelum memproses pembayaran.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border divide-y divide-border">
              {cart.map((c) => (
                <div key={c.inventoryItem.id} className="flex justify-between items-center px-3 py-2 text-sm">
                  <span className="truncate flex-1 mr-2">{c.inventoryItem.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {c.quantity}× {formatRupiah(Number(c.inventoryItem.sellingPrice))}
                  </span>
                </div>
              ))}
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Diskon</span>
                <span>- {formatRupiah(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2">
              <span>Total</span>
              <span className="text-brand">{formatRupiah(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={createTransaction.isPending}
            >
              {createTransaction.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : null}
              Proses Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>
          <div ref={receiptRef}>
            {lastTransaction && (
              <Receipt
                transaction={{
                  id: lastTransaction.id,
                  timestamp: BigInt(lastTransaction.timestamp.getTime()) * 1_000_000n,
                  items: lastTransaction.items.map((c) => ({
                    id: c.inventoryItem.id,
                    name: c.inventoryItem.name,
                    price: c.inventoryItem.sellingPrice,
                    quantity: BigInt(c.quantity),
                    itemType: c.inventoryItem.kind,
                  })),
                  total: BigInt(lastTransaction.total),
                  customerName: lastTransaction.customerName,
                  vehicleInfo: lastTransaction.vehicleInfo,
                }}
                shopSettings={shopSettings ?? undefined}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Tutup
            </Button>
            <Button onClick={handlePrint}>
              <Printer size={16} className="mr-2" />
              Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
