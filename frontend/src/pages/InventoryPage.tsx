import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Upload, Pencil, Trash2, Loader2, Search, Download } from "lucide-react";
import {
  useInventoryItems,
  useAddInventoryItem,
  useDeleteInventoryItem,
  useReplaceInventoryItem,
} from "@/hooks/useQueries";
import { ItemKind } from "@/backend";
import { formatRupiah } from "@/lib/utils";
import { readXlsx, buildXlsx } from "@/lib/xlsx";

interface ItemForm {
  id: string;
  name: string;
  sellingPrice: string;
  purchasePrice: string;
  quantity: string;
  kind: ItemKind;
}

const emptyForm = (): ItemForm => ({
  id: "",
  name: "",
  sellingPrice: "",
  purchasePrice: "",
  quantity: "",
  kind: ItemKind.goods,
});

export default function InventoryPage() {
  const { data: items = [], isLoading } = useInventoryItems();
  const addMutation = useAddInventoryItem();
  const deleteMutation = useDeleteInventoryItem();
  const replaceMutation = useReplaceInventoryItem();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Partial<ItemForm>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );

  function validateForm(f: ItemForm): Partial<ItemForm> {
    const errors: Partial<ItemForm> = {};
    if (!f.id.trim()) errors.id = "ID wajib diisi";
    if (!f.name.trim()) errors.name = "Nama wajib diisi";
    if (f.sellingPrice === "" || isNaN(Number(f.sellingPrice)) || Number(f.sellingPrice) < 0)
      errors.sellingPrice = "Harga jual tidak valid";
    if (f.purchasePrice === "" || isNaN(Number(f.purchasePrice)) || Number(f.purchasePrice) < 0)
      errors.purchasePrice = "Harga beli tidak valid";
    if (f.kind === ItemKind.goods) {
      if (f.quantity === "" || isNaN(Number(f.quantity)) || Number(f.quantity) <= 0)
        errors.quantity = "Stok wajib diisi dan > 0";
    }
    return errors;
  }

  function handleOpenAdd() {
    setForm(emptyForm());
    setFormErrors({});
    setShowAdd(true);
  }

  function handleOpenEdit(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setForm({
      id: item.id,
      name: item.name,
      sellingPrice: String(item.sellingPrice),
      purchasePrice: String(item.purchasePrice),
      quantity: item.quantity != null ? String(item.quantity) : "",
      kind: item.kind,
    });
    setFormErrors({});
    setShowEdit(true);
  }

  function handleAdd() {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (items.some((i) => i.id === form.id.trim())) {
      setFormErrors({ id: "ID sudah digunakan" });
      return;
    }

    const sellingPrice = BigInt(Math.round(Number(form.sellingPrice)));
    const purchasePrice = BigInt(Math.round(Number(form.purchasePrice)));
    const quantity =
      form.kind === ItemKind.goods ? BigInt(Math.round(Number(form.quantity))) : null;

    addMutation.mutate(
      {
        id: form.id.trim(),
        name: form.name.trim(),
        sellingPrice,
        purchasePrice,
        quantity,
        kind: form.kind,
      },
      {
        onSuccess: () => {
          toast.success("Barang berhasil ditambahkan");
          setShowAdd(false);
          setForm(emptyForm());
        },
        onError: (err) => {
          toast.error("Gagal menambahkan: " + String(err));
        },
      }
    );
  }

  function handleEdit() {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const sellingPrice = BigInt(Math.round(Number(form.sellingPrice)));
    const purchasePrice = BigInt(Math.round(Number(form.purchasePrice)));
    const quantity =
      form.kind === ItemKind.goods ? BigInt(Math.round(Number(form.quantity))) : null;

    replaceMutation.mutate(
      {
        id: form.id.trim(),
        name: form.name.trim(),
        sellingPrice,
        purchasePrice,
        quantity,
        kind: form.kind,
      },
      {
        onSuccess: () => {
          toast.success("Barang berhasil diperbarui");
          setShowEdit(false);
        },
        onError: (err) => {
          toast.error("Gagal memperbarui: " + String(err));
        },
      }
    );
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Barang berhasil dihapus");
        setDeleteConfirmId(null);
      },
      onError: (err) => {
        toast.error("Gagal menghapus: " + String(err));
      },
    });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const buffer = await file.arrayBuffer();
      // readXlsx expects ArrayBuffer directly
      const rows = await readXlsx(buffer);

      if (rows.length < 2) {
        toast.error("File Excel kosong atau tidak valid");
        return;
      }

      // Skip header row
      const dataRows = rows.slice(1);
      let successCount = 0;
      let errorCount = 0;

      for (const row of dataRows) {
        const [id, name, sellingPriceStr, purchasePriceStr, quantityStr, kindStr] = row.map(
          (cell) => String(cell ?? "").trim()
        );

        if (!id || !name) {
          errorCount++;
          continue;
        }

        const sellingPrice = Number(sellingPriceStr);
        const purchasePrice = Number(purchasePriceStr);
        const kindLower = kindStr.toLowerCase();
        const kind =
          kindLower === "jasa" || kindLower === "service"
            ? ItemKind.service
            : ItemKind.goods;

        if (isNaN(sellingPrice) || isNaN(purchasePrice)) {
          errorCount++;
          continue;
        }

        let quantity: bigint | null = null;
        if (kind === ItemKind.goods) {
          const q = Number(quantityStr);
          if (isNaN(q) || q <= 0) {
            errorCount++;
            continue;
          }
          quantity = BigInt(Math.round(q));
        }

        try {
          await addMutation.mutateAsync({
            id,
            name,
            sellingPrice: BigInt(Math.round(sellingPrice)),
            purchasePrice: BigInt(Math.round(purchasePrice)),
            quantity,
            kind,
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} barang berhasil diimpor`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} baris gagal diimpor`);
      }
    } catch (err) {
      toast.error("Gagal membaca file: " + String(err));
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
        item.quantity != null ? Number(item.quantity) : "",
        item.kind === ItemKind.service ? "jasa" : "barang",
      ]);
      const xlsxBytes = await buildXlsx(headers, rows);
      const blob = new Blob([xlsxBytes], {
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

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Inventori</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            Ekspor
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />
            Impor Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImport}
          />
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Tambah Barang
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Cari barang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            {search ? "Tidak ada hasil pencarian" : "Belum ada barang"}
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
                    <Badge
                      variant={item.kind === ItemKind.service ? "secondary" : "default"}
                    >
                      {item.kind === ItemKind.service ? "Jasa" : "Barang"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(Number(item.sellingPrice))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(Number(item.purchasePrice))}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.kind === ItemKind.service
                      ? "-"
                      : item.quantity != null
                      ? String(item.quantity)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(item.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(item.id)}
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
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Barang</DialogTitle>
            <DialogDescription>Isi detail barang atau jasa baru.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="add-id">ID Barang</Label>
              <Input
                id="add-id"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="Contoh: BRG-001"
              />
              {formErrors.id && (
                <p className="text-xs text-destructive">{formErrors.id}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-name">Nama</Label>
              <Input
                id="add-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama barang atau jasa"
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <RadioGroup
                value={form.kind}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    kind: val as ItemKind,
                    quantity: val === ItemKind.service ? "" : f.quantity,
                  }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={ItemKind.goods} id="add-goods" />
                  <Label htmlFor="add-goods">Barang</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={ItemKind.service} id="add-service" />
                  <Label htmlFor="add-service">Jasa</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-selling">Harga Jual (Rp)</Label>
              <Input
                id="add-selling"
                type="number"
                min="0"
                value={form.sellingPrice}
                onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                placeholder="0"
              />
              {formErrors.sellingPrice && (
                <p className="text-xs text-destructive">{formErrors.sellingPrice}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-purchase">Harga Beli (Rp)</Label>
              <Input
                id="add-purchase"
                type="number"
                min="0"
                value={form.purchasePrice}
                onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                placeholder="0"
              />
              {formErrors.purchasePrice && (
                <p className="text-xs text-destructive">{formErrors.purchasePrice}</p>
              )}
            </div>
            {form.kind === ItemKind.goods && (
              <div className="grid gap-1.5">
                <Label htmlFor="add-qty">Stok</Label>
                <Input
                  id="add-qty"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
                {formErrors.quantity && (
                  <p className="text-xs text-destructive">{formErrors.quantity}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Batal
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Barang</DialogTitle>
            <DialogDescription>Perbarui detail barang atau jasa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-id">ID Barang</Label>
              <Input
                id="edit-id"
                value={form.id}
                disabled
                className="opacity-60"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Nama</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama barang atau jasa"
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <RadioGroup
                value={form.kind}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    kind: val as ItemKind,
                    quantity: val === ItemKind.service ? "" : f.quantity,
                  }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={ItemKind.goods} id="edit-goods" />
                  <Label htmlFor="edit-goods">Barang</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={ItemKind.service} id="edit-service" />
                  <Label htmlFor="edit-service">Jasa</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-selling">Harga Jual (Rp)</Label>
              <Input
                id="edit-selling"
                type="number"
                min="0"
                value={form.sellingPrice}
                onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                placeholder="0"
              />
              {formErrors.sellingPrice && (
                <p className="text-xs text-destructive">{formErrors.sellingPrice}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-purchase">Harga Beli (Rp)</Label>
              <Input
                id="edit-purchase"
                type="number"
                min="0"
                value={form.purchasePrice}
                onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                placeholder="0"
              />
              {formErrors.purchasePrice && (
                <p className="text-xs text-destructive">{formErrors.purchasePrice}</p>
              )}
            </div>
            {form.kind === ItemKind.goods && (
              <div className="grid gap-1.5">
                <Label htmlFor="edit-qty">Stok</Label>
                <Input
                  id="edit-qty"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
                {formErrors.quantity && (
                  <p className="text-xs text-destructive">{formErrors.quantity}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Batal
            </Button>
            <Button onClick={handleEdit} disabled={replaceMutation.isPending}>
              {replaceMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Barang</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus barang ini? Tindakan ini tidak dapat
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
