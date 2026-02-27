import { useState } from 'react';
import { Search, Eye, Printer, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTransactions, useDeleteTransaction, useShopSettings } from '@/hooks/useQueries';
import { formatRupiah, formatDateTime } from '@/lib/utils';
import type { Transaction } from '@/backend';
import Receipt from '@/components/Receipt';

export default function TransactionHistoryPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: shopSettings } = useShopSettings();
  const deleteTransaction = useDeleteTransaction();

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const filtered = transactions.filter((tx) => {
    const matchSearch =
      tx.customerName.toLowerCase().includes(search.toLowerCase()) ||
      tx.vehicleInfo.toLowerCase().includes(search.toLowerCase()) ||
      String(tx.id).includes(search);

    const txDate = new Date(Number(tx.timestamp) / 1_000_000);
    const matchFrom = dateFrom ? txDate >= new Date(dateFrom) : true;
    const matchTo = dateTo ? txDate <= new Date(dateTo + 'T23:59:59') : true;

    return matchSearch && matchFrom && matchTo;
  });

  function openDetail(tx: Transaction) {
    setSelectedTx(tx);
    setShowDetailDialog(true);
  }

  function openDelete(tx: Transaction) {
    setTxToDelete(tx);
    setShowDeleteDialog(true);
  }

  async function handleDelete() {
    if (!txToDelete) return;
    try {
      await deleteTransaction.mutateAsync(txToDelete.id);
      toast.success('Transaksi berhasil dihapus');
      setShowDeleteDialog(false);
      setTxToDelete(null);
    } catch (e: unknown) {
      toast.error('Gagal menghapus transaksi: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handlePrint() {
    window.print();
  }

  function clearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

  const hasFilters = search || dateFrom || dateTo;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {transactions.length} transaksi tercatat
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari pelanggan, kendaraan, atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Dari:</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Sampai:</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={14} className="mr-1" />
            Hapus Filter
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Kendaraan</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  {hasFilters ? 'Tidak ada transaksi yang cocok dengan filter' : 'Belum ada transaksi'}
                </TableCell>
              </TableRow>
            ) : (
              [...filtered].reverse().map((tx) => (
                <TableRow key={String(tx.id)}>
                  <TableCell className="font-mono text-sm">#{String(tx.id)}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(tx.timestamp)}</TableCell>
                  <TableCell className="font-medium">{tx.customerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.vehicleInfo || '—'}</TableCell>
                  <TableCell className="font-semibold text-brand">{formatRupiah(Number(tx.total))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(tx)}>
                        <Eye size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(tx)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Transaksi #{selectedTx ? String(selectedTx.id) : ''}</DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <Receipt
                transaction={selectedTx}
                shopSettings={shopSettings ?? undefined}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Tutup</Button>
            <Button onClick={handlePrint}>
              <Printer size={14} className="mr-1.5" />
              Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Transaksi</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus transaksi #{txToDelete ? String(txToDelete.id) : ''}?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTransaction.isPending}>
              {deleteTransaction.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
