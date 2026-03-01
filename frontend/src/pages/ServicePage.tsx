import { useState } from 'react';
import {
  useWorkOrders,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
} from '../hooks/useQueries';
import { WorkOrder, WorkOrderStatus } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Eye, CheckCircle, Trash2, Search, ShoppingCart, X } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';
import { storeWorkOrderNavData } from '../lib/urlParams';
import { useNavigate } from '@tanstack/react-router';

type DialogMode = 'create' | 'view' | 'complete' | 'delete' | null;

interface WorkOrderForm {
  customerName: string;
  customerPhone: string;
  vehicles: string;
  dateIn: string;
  problemDescription: string;
  repairAction: string;
  technician: string;
}

const defaultForm: WorkOrderForm = {
  customerName: '',
  customerPhone: '',
  vehicles: '',
  dateIn: new Date().toISOString().split('T')[0],
  problemDescription: '',
  repairAction: '',
  technician: '',
};

const statusLabel: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.pending]: 'Menunggu',
  [WorkOrderStatus.inProgress]: 'Dikerjakan',
  [WorkOrderStatus.done]: 'Selesai',
  [WorkOrderStatus.cancelled]: 'Dibatalkan',
};

const statusVariant: Record<WorkOrderStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  [WorkOrderStatus.pending]: 'secondary',
  [WorkOrderStatus.inProgress]: 'default',
  [WorkOrderStatus.done]: 'outline',
  [WorkOrderStatus.cancelled]: 'destructive',
};

export default function ServicePage() {
  const { data: workOrders = [], isLoading } = useWorkOrders();
  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();
  const deleteWorkOrder = useDeleteWorkOrder();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<WorkOrderForm>(defaultForm);

  const filtered = workOrders.filter(wo =>
    wo.customerName.toLowerCase().includes(search.toLowerCase()) ||
    wo.workOrderNumber.toLowerCase().includes(search.toLowerCase()) ||
    wo.vehicles.some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => {
    setForm(defaultForm);
    setDialogMode('create');
  };

  const openView = (wo: WorkOrder) => {
    setSelectedOrder(wo);
    setDialogMode('view');
  };

  const openComplete = (wo: WorkOrder) => {
    setSelectedOrder(wo);
    setDialogMode('complete');
  };

  const openDelete = (wo: WorkOrder) => {
    setSelectedOrder(wo);
    setDialogMode('delete');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedOrder(null);
    setForm(defaultForm);
  };

  const handleCreate = async () => {
    if (!form.customerName.trim()) {
      toast.error('Nama pelanggan wajib diisi');
      return;
    }
    if (!form.vehicles.trim()) {
      toast.error('Info kendaraan wajib diisi');
      return;
    }

    const dateInMs = new Date(form.dateIn).getTime();

    try {
      await createWorkOrder.mutateAsync({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        vehicles: form.vehicles.split(',').map(v => v.trim()).filter(Boolean),
        dateIn: BigInt(dateInMs),
        problemDescription: form.problemDescription.trim(),
        repairAction: form.repairAction.trim(),
        technician: form.technician.trim(),
      });
      toast.success('Work order berhasil dibuat');
      closeDialog();
    } catch (e) {
      toast.error('Gagal membuat work order');
      console.error(e);
    }
  };

  const handleComplete = async () => {
    if (!selectedOrder) return;
    try {
      await updateWorkOrder.mutateAsync({
        ...selectedOrder,
        status: WorkOrderStatus.done,
        dateOut: BigInt(Date.now()),
      });
      toast.success('Work order selesai');
      closeDialog();
    } catch (e) {
      toast.error('Gagal menyelesaikan work order');
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    try {
      await deleteWorkOrder.mutateAsync(selectedOrder.id);
      toast.success('Work order berhasil dihapus');
      closeDialog();
    } catch (e) {
      toast.error('Gagal menghapus work order');
      console.error(e);
    }
  };

  const handleGoToCashier = (wo: WorkOrder) => {
    storeWorkOrderNavData({
      workOrderId: wo.id,
      customerName: wo.customerName,
      customerPhone: wo.customerPhone,
      vehicleInfo: wo.vehicles.join(', '),
    });
    navigate({ to: '/' });
  };

  const pendingCount = workOrders.filter(wo => wo.status === WorkOrderStatus.pending).length;
  const inProgressCount = workOrders.filter(wo => wo.status === WorkOrderStatus.inProgress).length;
  const doneCount = workOrders.filter(wo => wo.status === WorkOrderStatus.done).length;

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Menunggu</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Dikerjakan</p>
            <p className="text-2xl font-bold text-primary">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Selesai</p>
            <p className="text-2xl font-bold text-green-600">{doneCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari work order..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Buat Work Order
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daftar Work Order</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. WO</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Kendaraan</TableHead>
                    <TableHead>Tanggal Masuk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Tidak ada work order
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(wo => (
                      <TableRow key={wo.id}>
                        <TableCell className="font-mono text-sm">{wo.workOrderNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{wo.customerName}</p>
                            {wo.customerPhone && (
                              <p className="text-xs text-muted-foreground">{wo.customerPhone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{wo.vehicles.join(', ')}</TableCell>
                        <TableCell className="text-sm">{formatDate(wo.dateIn)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[wo.status]}>
                            {statusLabel[wo.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openView(wo)}
                              title="Lihat detail"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {wo.status !== WorkOrderStatus.done && wo.status !== WorkOrderStatus.cancelled && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openComplete(wo)}
                                title="Tandai selesai"
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGoToCashier(wo)}
                              title="Ke kasir"
                              className="text-primary hover:text-primary/80"
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDelete(wo)}
                              title="Hapus"
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Work Order Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama Pelanggan *</Label>
                <Input
                  value={form.customerName}
                  onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="Nama pelanggan"
                />
              </div>
              <div>
                <Label>Nomor HP</Label>
                <Input
                  value={form.customerPhone}
                  onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                  placeholder="08xx..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kendaraan * (pisahkan dengan koma)</Label>
                <Input
                  value={form.vehicles}
                  onChange={e => setForm(f => ({ ...f, vehicles: e.target.value }))}
                  placeholder="Honda Beat, B 1234 XY"
                />
              </div>
              <div>
                <Label>Tanggal Masuk</Label>
                <Input
                  type="date"
                  value={form.dateIn}
                  onChange={e => setForm(f => ({ ...f, dateIn: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Keluhan</Label>
              <Textarea
                value={form.problemDescription}
                onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))}
                placeholder="Deskripsi keluhan pelanggan"
                rows={2}
              />
            </div>
            <div>
              <Label>Tindakan Perbaikan</Label>
              <Textarea
                value={form.repairAction}
                onChange={e => setForm(f => ({ ...f, repairAction: e.target.value }))}
                placeholder="Tindakan yang dilakukan"
                rows={2}
              />
            </div>
            <div>
              <Label>Teknisi</Label>
              <Input
                value={form.technician}
                onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}
                placeholder="Nama teknisi"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button onClick={handleCreate} disabled={createWorkOrder.isPending}>
              {createWorkOrder.isPending ? 'Menyimpan...' : 'Buat Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={dialogMode === 'view'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Work Order</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">No. Work Order</p>
                  <p className="font-mono font-medium">{selectedOrder.workOrderNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={statusVariant[selectedOrder.status]}>
                    {statusLabel[selectedOrder.status]}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Pelanggan</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Nomor HP</p>
                  <p>{selectedOrder.customerPhone || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Kendaraan</p>
                <p>{selectedOrder.vehicles.join(', ')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Tanggal Masuk</p>
                  <p>{formatDate(selectedOrder.dateIn)}</p>
                </div>
                {selectedOrder.dateOut !== undefined && selectedOrder.dateOut !== null && (
                  <div>
                    <p className="text-muted-foreground text-xs">Tanggal Keluar</p>
                    <p>{formatDate(selectedOrder.dateOut)}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Keluhan</p>
                <p className="whitespace-pre-wrap">{selectedOrder.problemDescription || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tindakan Perbaikan</p>
                <p className="whitespace-pre-wrap">{selectedOrder.repairAction || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Teknisi</p>
                <p>{selectedOrder.technician || '-'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              <X className="h-4 w-4 mr-1" />
              Tutup
            </Button>
            {selectedOrder && (
              <Button onClick={() => { closeDialog(); handleGoToCashier(selectedOrder); }}>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Ke Kasir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={dialogMode === 'complete'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selesaikan Work Order</DialogTitle>
            <DialogDescription>
              Tandai work order <strong>{selectedOrder?.workOrderNumber}</strong> sebagai selesai?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              onClick={handleComplete}
              disabled={updateWorkOrder.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {updateWorkOrder.isPending ? 'Memproses...' : 'Selesaikan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Work Order</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus work order <strong>{selectedOrder?.workOrderNumber}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteWorkOrder.isPending}
            >
              {deleteWorkOrder.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
