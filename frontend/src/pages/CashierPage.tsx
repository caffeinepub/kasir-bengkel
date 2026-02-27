import { useState, useEffect, useRef } from "react";
import { useInventoryItems } from "@/hooks/useQueries";
import { ItemKind, InventoryItem } from "@/backend";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCreateTransaction } from "@/hooks/useQueries";
import { useShopSettings } from "@/hooks/useQueries";
import Receipt from "@/components/Receipt";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Search,
  Settings2,
  Printer,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const MAX_DISPLAY = 20;
const PINNED_STORAGE_KEY = "cashier_pinned_items";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  kind: ItemKind;
}

export default function CashierPage() {
  const { data: inventoryItems = [], isLoading } = useInventoryItems();
  const { data: shopSettings } = useShopSettings();
  const createTransaction = useCreateTransaction();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(PINNED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinDialogSearch, setPinDialogSearch] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<{
    id: number;
    items: CartItem[];
    total: number;
    customerName: string;
    vehicleInfo: string;
    timestamp: Date;
  } | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedItemIds));
  }, [pinnedItemIds]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pinnedItems = pinnedItemIds
    .map((id) => inventoryItems.find((item) => item.id === id))
    .filter((item): item is InventoryItem => !!item)
    .slice(0, MAX_DISPLAY);

  const searchResults = searchQuery.trim()
    ? inventoryItems
        .filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, MAX_DISPLAY)
    : [];

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: Number(item.sellingPrice),
          quantity: 1,
          kind: item.kind,
        },
      ];
    });
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang masih kosong");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Nama pelanggan harus diisi");
      return;
    }

    try {
      const transactionItems = cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: BigInt(item.price),
        quantity: BigInt(item.quantity),
        itemType: item.kind,
      }));

      const txId = await createTransaction.mutateAsync({
        items: transactionItems,
        total: BigInt(total),
        customerName: customerName.trim(),
        vehicleInfo: vehicleInfo.trim(),
      });

      setCompletedTransaction({
        id: Number(txId),
        items: [...cart],
        total,
        customerName: customerName.trim(),
        vehicleInfo: vehicleInfo.trim(),
        timestamp: new Date(),
      });

      setCart([]);
      setCustomerName("");
      setVehicleInfo("");
      setShowReceipt(true);
      toast.success("Transaksi berhasil disimpan");
    } catch (err) {
      toast.error("Gagal menyimpan transaksi");
    }
  };

  const togglePinItem = (id: string) => {
    setPinnedItemIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredForPinDialog = pinDialogSearch.trim()
    ? inventoryItems.filter(
        (item) =>
          item.name.toLowerCase().includes(pinDialogSearch.toLowerCase()) ||
          item.id.toLowerCase().includes(pinDialogSearch.toLowerCase())
      )
    : inventoryItems;

  // Card background color based on item kind
  const getItemCardBg = (kind: ItemKind) => {
    if (kind === ItemKind.service) {
      // Blue-tinted for services (jasa)
      return "bg-blue-950/60 hover:bg-blue-900/70 border-blue-800/50";
    }
    // Green-tinted for goods (barang)
    return "bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-800/50";
  };

  const getItemBadge = (kind: ItemKind) => {
    if (kind === ItemKind.service) {
      return (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-800/70 text-blue-200">
          Jasa
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-800/70 text-emerald-200">
        Barang
      </span>
    );
  };

  if (showReceipt && completedTransaction) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-4 text-green-400">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-lg font-semibold">Transaksi Berhasil</span>
          </div>
          <Receipt
            transaction={{
              id: BigInt(completedTransaction.id),
              timestamp: BigInt(completedTransaction.timestamp.getTime()) * 1_000_000n,
              items: completedTransaction.items.map((item) => ({
                id: item.id,
                name: item.name,
                price: BigInt(item.price),
                quantity: BigInt(item.quantity),
                itemType: item.kind,
              })),
              total: BigInt(completedTransaction.total),
              customerName: completedTransaction.customerName,
              vehicleInfo: completedTransaction.vehicleInfo,
            }}
            shopSettings={shopSettings ?? undefined}
          />
          <div className="flex gap-3 mt-4 no-print">
            <Button
              className="flex-1"
              onClick={() => window.print()}
              variant="outline"
            >
              <Printer className="w-4 h-4 mr-2" />
              Cetak Struk
            </Button>
            <Button
              className="flex-1"
              onClick={() => setShowReceipt(false)}
            >
              Transaksi Baru
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left: Product Panel */}
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Kasir</h1>
          <div className="flex items-center gap-2">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-blue-800/80 border border-blue-700" />
                Jasa
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-emerald-800/80 border border-emerald-700" />
                Barang
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPinDialog(true)}
              className="gap-1"
            >
              <Settings2 className="w-4 h-4" />
              Pilih Tampilan
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk atau jasa..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(e.target.value.trim().length > 0);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setShowSearchDropdown(true);
              }}
              className="pl-9"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery("");
                  setShowSearchDropdown(false);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
              <ScrollArea className="max-h-72">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors border-b border-border/40 last:border-0 ${
                      item.kind === ItemKind.service
                        ? "hover:bg-blue-950/50"
                        : "hover:bg-emerald-950/50"
                    }`}
                    onClick={() => addToCart(item)}
                  >
                    <div className="flex items-center gap-2">
                      {getItemBadge(item.kind)}
                      <span className="text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatRupiah(Number(item.sellingPrice))}
                    </span>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}

          {showSearchDropdown && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl p-4 text-center text-sm text-muted-foreground">
              Produk tidak ditemukan
            </div>
          )}
        </div>

        {/* Pinned Items Grid */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Memuat produk...
            </div>
          ) : pinnedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <Settings2 className="w-8 h-8 opacity-40" />
              <p className="text-sm">
                Belum ada item yang dipilih.{" "}
                <button
                  className="underline text-primary"
                  onClick={() => setShowPinDialog(true)}
                >
                  Pilih Tampilan
                </button>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {pinnedItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`rounded-lg border p-3 text-left transition-all duration-150 flex flex-col gap-1 ${getItemCardBg(item.kind)}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                      {item.name}
                    </span>
                    {getItemBadge(item.kind)}
                  </div>
                  <span className="text-xs text-muted-foreground mt-auto">
                    {formatRupiah(Number(item.sellingPrice))}
                  </span>
                  {item.kind === ItemKind.goods && item.quantity !== undefined && (
                    <span className="text-[10px] text-muted-foreground">
                      Stok: {Number(item.quantity)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div className="w-80 flex flex-col border-l border-border bg-card">
        {/* Cart Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Keranjang</h2>
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {cart.length}
              </Badge>
            )}
          </div>
          <Input
            placeholder="Nama pelanggan *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mb-2"
          />
          <Input
            placeholder="Info kendaraan (opsional)"
            value={vehicleInfo}
            onChange={(e) => setVehicleInfo(e.target.value)}
          />
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 p-4">
              <ShoppingCart className="w-8 h-8 opacity-30" />
              <p className="text-sm text-center">Keranjang kosong</p>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-2.5 flex flex-col gap-1.5 ${
                    item.kind === ItemKind.service
                      ? "bg-blue-950/40 border-blue-800/40"
                      : "bg-emerald-950/40 border-emerald-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {getItemBadge(item.kind)}
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatRupiah(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Footer */}
        <div className="p-4 border-t border-border">
          <Separator className="mb-3" />
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-primary">
              {formatRupiah(total)}
            </span>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={createTransaction.isPending || cart.length === 0}
          >
            {createTransaction.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memproses...
              </span>
            ) : (
              "Bayar"
            )}
          </Button>
        </div>
      </div>

      {/* Pin Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pilih Tampilan Produk</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Pilih hingga {MAX_DISPLAY} item yang akan ditampilkan di panel kasir.
          </p>
          <Input
            placeholder="Cari produk..."
            value={pinDialogSearch}
            onChange={(e) => setPinDialogSearch(e.target.value)}
            className="mb-1"
          />
          <ScrollArea className="h-72 border border-border rounded-lg">
            <div className="p-2 flex flex-col gap-1">
              {filteredForPinDialog.map((item) => {
                const isPinned = pinnedItemIds.includes(item.id);
                const atMax =
                  pinnedItemIds.length >= MAX_DISPLAY && !isPinned;
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isPinned
                        ? item.kind === ItemKind.service
                          ? "bg-blue-950/60 border border-blue-800/50"
                          : "bg-emerald-950/60 border border-emerald-800/50"
                        : "hover:bg-muted border border-transparent"
                    } ${atMax ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Checkbox
                      checked={isPinned}
                      onCheckedChange={() => {
                        if (!atMax || isPinned) togglePinItem(item.id);
                      }}
                      disabled={atMax}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getItemBadge(item.kind)}
                      <span className="text-sm font-medium truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRupiah(Number(item.sellingPrice))}
                    </span>
                  </label>
                );
              })}
              {filteredForPinDialog.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Tidak ada produk ditemukan
                </p>
              )}
            </div>
          </ScrollArea>
          <div className="text-xs text-muted-foreground">
            {pinnedItemIds.length}/{MAX_DISPLAY} item dipilih
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPinDialog(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
