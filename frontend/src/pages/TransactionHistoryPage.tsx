import { useState, useRef } from 'react';
import { Search, Printer, Eye, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Receipt from '@/components/Receipt';
import { useTransactions, useShopSettings } from '@/hooks/useQueries';
import { formatRupiah, formatDateTime } from '@/lib/utils';
import type { Transaction } from '../backend';
import { useActor } from '@/hooks/useActor';
import { useQueryClient } from '@tanstack/react-query';

export default function TransactionHistoryPage() {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [printTx, setPrintTx] = useState<Transaction | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: transactions = [], isLoading } = useTransactions();
  const { data: settings } = useShopSettings();
  const { actor } = useActor();
  const qc = useQueryClient();

  const filtered = transactions.filter(tx => {
    const matchSearch =
      tx.customerName.toLowerCase().includes(search.toLowerCase()) ||
      tx.vehicleInfo.toLowerCase().includes(search.toLowerCase()) ||
      String(tx.id).includes(search);

    const txDate = new Date(Number(tx.timestamp) / 1_000_000);
    const matchFrom = dateFrom ? txDate >= new Date(dateFrom) : true;
    const matchTo = dateTo ? txDate <= new Date(dateTo + 'T23:59:59') : true;

    return matchSearch && matchFrom && matchTo;
  }).sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  const handlePrint = (tx: Transaction) => {
    setPrintTx(tx);
    setTimeout(() => window.print(), 300);
  };

  const handleDelete = async (id: bigint) => {
    if (!actor) return;
    try {
      await actor.deleteTransaction(id);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaksi dihapus');
    } catch {
      toast.error('Gagal menghapus transaksi');
    }
  };

  return (
    <div className="p-6">
      {/* Print-only receipt */}
      {printTx && (
        <div className="print-only">
          <Receipt ref={receiptRef} transaction={printTx} settings={settings ?? null} />
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Riwayat Transaksi</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Lihat dan kelola semua transaksi</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari pelanggan, kendaraan, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Reset</Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>No.</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Kendaraan</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Tidak ada transaksi ditemukan
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(tx => (
                <TableRow key={String(tx.id)} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">#{String(tx.id).padStart(5, '0')}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(tx.timestamp)}</TableCell>
                  <TableCell className="font-medium">{tx.customerName || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{tx.vehicleInfo || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tx.items.length} item</Badge>
                  </TableCell>
                  <TableCell className="font-bold text-brand">{formatRupiah(Number(tx.total))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedTx(tx)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-brand" onClick={() => handlePrint(tx)}>
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
                            <AlertDialogDescription>Transaksi #{String(tx.id).padStart(5, '0')} akan dihapus permanen.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDelete(tx.id)}>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={open => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Transaksi #{selectedTx ? String(selectedTx.id).padStart(5, '0') : ''}</DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Tanggal</div>
                <div>{formatDateTime(selectedTx.timestamp)}</div>
                <div className="text-muted-foreground">Pelanggan</div>
                <div className="font-medium">{selectedTx.customerName || '-'}</div>
                <div className="text-muted-foreground">Kendaraan</div>
                <div>{selectedTx.vehicleInfo || '-'}</div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-sm font-semibold mb-2">Item</p>
                <div className="space-y-1">
                  {selectedTx.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.name} × {String(item.quantity)}</span>
                      <span className="font-medium">{formatRupiah(Number(item.price) * Number(item.quantity))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-brand">{formatRupiah(Number(selectedTx.total))}</span>
              </div>
              <Button
                className="w-full bg-brand hover:bg-brand-dark text-white"
                onClick={() => { handlePrint(selectedTx); setSelectedTx(null); }}
              >
                <Printer className="w-4 h-4 mr-2" /> Cetak Struk
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
