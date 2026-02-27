import { useState, useRef } from "react";
import { Plus, Upload, Download, Search, Edit, Trash2, Loader2, Package, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useInventoryItems,
  useAddInventoryItem,
  useDeleteInventoryItem,
  useUpdateInventoryItemQuantity,
  useUpdateAllItems,
} from "@/hooks/useQueries";
import { ItemKind } from "@/backend";
import type { InventoryItem } from "@/backend";
import { formatRupiah } from "@/lib/utils";
import { buildXlsx, readXlsx } from "@/lib/xlsx";

interface ItemForm {
  id: string;
  name: string;
  sellingPrice: string;
  purchasePrice: string;
  quantity: string;
  kind: "goods" | "service";
}

const emptyForm: ItemForm = {
  id: "",
  name: "",
  sellingPrice: "",
  purchasePrice: "",
  quantity: "",
  kind: "goods",
};

export default function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const addItem = useAddInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const updateQuantity = useUpdateInventoryItemQuantity();
  const updateAllItems = useUpdateAllItems();

  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof items[0] | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [editQuantity, setEditQuantity] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(emptyForm);
    setShowAddDialog(true);
  }

  function openEdit(item: typeof items[0]) {
    setSelectedItem(item);
    setEditQuantity(item.quantity !== undefined ? String(item.quantity) : "");
    setShowEditDialog(true);
  }

  function openDelete(item: typeof items[0]) {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  }

  async function handleAdd() {
    const id = form.id.trim();
    const name = form.name.trim();
    const sellingPrice = parseInt(form.sellingPrice);
    const purchasePrice = parseInt(form.purchasePrice);
    const quantity = form.kind === "goods" ? parseInt(form.quantity) : undefined;

    if (!id) { toast.error("ID tidak boleh kosong"); return; }
    if (!name) { toast.error("Nama tidak boleh kosong"); return; }
    if (isNaN(sellingPrice) || sellingPrice < 0) { toast.error("Harga jual tidak valid"); return; }
    if (isNaN(purchasePrice) || purchasePrice < 0) { toast.error("Harga beli tidak valid"); return; }
    if (form.kind === "goods" && (isNaN(quantity!) || quantity! <= 0)) {
      toast.error("Stok harus lebih dari 0");
      return;
    }
    if (items.some((i) => i.id === id)) {
      toast.error("ID sudah digunakan");
      return;
    }

    try {
      await addItem.mutateAsync({
        id,
        name,
        sellingPrice: BigInt(sellingPrice),
        purchasePrice: BigInt(purchasePrice),
        quantity: form.kind === "goods" ? BigInt(quantity!) : null,
        kind: form.kind === "goods" ? ItemKind.goods : ItemKind.service,
      });
      toast.success("Barang berhasil ditambahkan");
      setShowAddDialog(false);
      setForm(emptyForm);
    } catch (e: unknown) {
      toast.error("Gagal menambahkan: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleEditSave() {
    if (!selectedItem) return;
    if (selectedItem.kind !== ItemKind.goods) {
      toast.error("Tidak bisa mengubah stok untuk jasa");
      return;
    }
    const qty = parseInt(editQuantity);
    if (isNaN(qty) || qty < 0) {
      toast.error("Stok tidak valid");
      return;
    }
    try {
      await updateQuantity.mutateAsync({ itemId: selectedItem.id, newQuantity: BigInt(qty) });
      toast.success("Stok berhasil diperbarui");
      setShowEditDialog(false);
    } catch (e: unknown) {
      toast.error("Gagal memperbarui: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDelete() {
    if (!selectedItem) return;
    try {
      await deleteItem.mutateAsync(selectedItem.id);
      toast.success("Barang berhasil dihapus");
      setShowDeleteDialog(false);
    } catch (e: unknown) {
      toast.error("Gagal menghapus: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleExport() {
    try {
      const headers = ["ID", "Nama", "Harga Jual", "Harga Beli", "Stok", "Tipe"];
      const rows = items.map((item) => [
        item.id,
        item.name,
        Number(item.sellingPrice),
        Number(item.purchasePrice),
        item.quantity !== undefined ? Number(item.quantity) : "",
        item.kind === ItemKind.goods ? "barang" : "jasa",
      ]);
      const buffer = await buildXlsx(headers, rows);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventori.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh file");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await readXlsx(buffer);
      // Skip header row
      const dataRows = rows.slice(1);

      // Build a map of current inventory keyed by ID for O(1) lookup
      const inventoryMap = new Map<string, InventoryItem>(
        items.map((item) => [item.id, item])
      );

      let updatedCount = 0;
      let insertedCount = 0;
      let skippedCount = 0;

      // Collect items to upsert via updateAllItems
      const upsertItems: InventoryItem[] = [];

      for (const row of dataRows) {
        const id = String(row[0] ?? "").trim();
        const name = String(row[1] ?? "").trim();
        const sellingPrice = parseInt(String(row[2] ?? "0"));
        const purchasePrice = parseInt(String(row[3] ?? "0"));
        const quantityStr = String(row[4] ?? "").trim();
        const kindStr = String(row[5] ?? "").trim().toLowerCase();

        // ID is required; name is required for new items but optional for updates
        if (!id) {
          skippedCount++;
          continue;
        }

        const kind = kindStr === "jasa" ? ItemKind.service : ItemKind.goods;
        const quantityNum = parseInt(quantityStr);

        const existing = inventoryMap.get(id);

        if (existing) {
          // UPDATE: ID exists — merge all columns from Excel into the existing item
          const updatedItem: InventoryItem = {
            id,
            name: name || existing.name,
            sellingPrice: BigInt(isNaN(sellingPrice) ? Number(existing.sellingPrice) : sellingPrice),
            purchasePrice: BigInt(isNaN(purchasePrice) ? Number(existing.purchasePrice) : purchasePrice),
            quantity: kind === ItemKind.goods
              ? (isNaN(quantityNum) ? existing.quantity : BigInt(quantityNum))
              : undefined,
            kind,
          };
          upsertItems.push(updatedItem);
          // Update the map so we don't double-process
          inventoryMap.set(id, updatedItem);
          updatedCount++;
        } else {
          // INSERT: ID does not exist — validate and add as new item
          if (!name) {
            skippedCount++;
            continue;
          }
          if (kind === ItemKind.goods && (isNaN(quantityNum) || quantityNum <= 0)) {
            skippedCount++;
            continue;
          }

          const newItem: InventoryItem = {
            id,
            name,
            sellingPrice: BigInt(isNaN(sellingPrice) ? 0 : sellingPrice),
            purchasePrice: BigInt(isNaN(purchasePrice) ? 0 : purchasePrice),
            quantity: kind === ItemKind.goods ? BigInt(quantityNum) : undefined,
            kind,
          };
          upsertItems.push(newItem);
          inventoryMap.set(id, newItem);
          insertedCount++;
        }
      }

      if (upsertItems.length === 0) {
        toast.warning(`Tidak ada data valid untuk diproses. ${skippedCount} baris dilewati.`);
        return;
      }

      // Send all upserted items in a single call
      await updateAllItems.mutateAsync(upsertItems);

      const parts: string[] = [];
      if (insertedCount > 0) parts.push(`${insertedCount} ditambahkan`);
      if (updatedCount > 0) parts.push(`${updatedCount} diperbarui`);
      if (skippedCount > 0) parts.push(`${skippedCount} dilewati`);
      toast.success(`Import selesai: ${parts.join(", ")}`);
    } catch (e: unknown) {
      toast.error("Gagal import: " + (e instanceof Error ? e.message : "Kesalahan tidak diketahui"));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventori</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola barang dan jasa yang tersedia
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Barang
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari barang atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Package className="w-10 h-10 mb-2 opacity-40" />
            <p>Belum ada barang</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Harga Beli</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.kind === ItemKind.goods ? (
                      <Badge variant="secondary" className="gap-1">
                        <Package className="w-3 h-3" />
                        Barang
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Wrench className="w-3 h-3" />
                        Jasa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(Number(item.sellingPrice))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(Number(item.purchasePrice))}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.kind === ItemKind.goods ? (
                      <span
                        className={
                          Number(item.quantity) <= 5
                            ? "text-destructive font-semibold"
                            : ""
                        }
                      >
                        {String(item.quantity ?? 0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {item.kind === ItemKind.goods && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(item)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Barang / Jasa</DialogTitle>
            <DialogDescription>
              Isi detail barang atau jasa yang ingin ditambahkan ke inventori.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="add-kind">Tipe</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, kind: v as "goods" | "service" }))
                }
              >
                <SelectTrigger id="add-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goods">Barang</SelectItem>
                  <SelectItem value="service">Jasa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-id">ID</Label>
              <Input
                id="add-id"
                placeholder="Contoh: BRG-001"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-name">Nama</Label>
              <Input
                id="add-name"
                placeholder="Nama barang atau jasa"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-selling">Harga Jual (Rp)</Label>
                <Input
                  id="add-selling"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.sellingPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sellingPrice: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-purchase">Harga Beli (Rp)</Label>
                <Input
                  id="add-purchase"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.purchasePrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, purchasePrice: e.target.value }))
                  }
                />
              </div>
            </div>
            {form.kind === "goods" && (
              <div className="space-y-1">
                <Label htmlFor="add-qty">Stok Awal</Label>
                <Input
                  id="add-qty"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleAdd} disabled={addItem.isPending}>
              {addItem.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (quantity only) */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Stok</DialogTitle>
            <DialogDescription>
              Perbarui jumlah stok untuk{" "}
              <span className="font-semibold">{selectedItem?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-qty">Stok Baru</Label>
              <Input
                id="edit-qty"
                type="number"
                min="0"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleEditSave} disabled={updateQuantity.isPending}>
              {updateQuantity.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Barang</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus{" "}
              <span className="font-semibold">{selectedItem?.name}</span>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
