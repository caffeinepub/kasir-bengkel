import { useState } from 'react';
import { useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useDeleteWorkOrder } from '../hooks/useQueries';
import { WorkOrder, WorkOrderStatus } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Eye, Trash2, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { storeWorkOrderNavData } from '../lib/urlParams';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

const statusLabel: Record<string, string> = {
  pending: 'Menunggu',
  inProgress: 'Dikerjakan',
  done: 'Selesai',
  cancelled: 'Dibatalkan',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  inProgress: 'default',
  done: 'outline',
  cancelled: 'destructive',
};

interface WorkOrderFormData {
  customerName: string;
  customerPhone: string;
  vehicles: string;
  dateIn: string;
  problemDescription: string;
  repairAction: string;
  technician: string;
}

const emptyForm: WorkOrderFormData = {
  customerName: '',
  customerPhone: '',
  vehicles: '',
  dateIn: new Date().toISOString().split('T')[0],
  problemDescription: '',
  repairAction: '',
  technician: '',
};

export default function ServicePage() {
  const navigate = useNavigate();
  const { data: workOrders = [], isLoading } = useWorkOrders();
  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();
  const deleteWorkOrder = useDeleteWorkOrder();

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [formData, setFormData] = useState<WorkOrderFormData>(emptyForm);
  const [completeRepairAction, setCompleteRepairAction] = useState('');
  const [completeTechnician, setCompleteTechnician] = useState('');

  const filtered = workOrders.filter(
    (wo) =>
      wo.customerName.toLowerCase().includes(search.toLowerCase()) ||
      wo.workOrderNumber.toLowerCase().includes(search.toLowerCase()) ||
      wo.vehicles.some((v) => v.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAdd = async () => {
    if (!formData.customerName.trim()) {
      toast.error('Nama pelanggan wajib diisi');
      return;
    }
    if (!formData.vehicles.trim()) {
      toast.error('Kendaraan wajib diisi');
      return;
    }
    if (!formData.problemDescription.trim()) {
      toast.error('Deskripsi masalah wajib diisi');
      return;
    }
    try {
      const dateInMs = new Date(formData.dateIn).getTime();
      const dateInNs = BigInt(dateInMs) * 1_000_000n;
      await createWorkOrder.mutateAsync({
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        vehicles: formData.vehicles.split(',').map((v) => v.trim()).filter(Boolean),
        dateIn: dateInNs,
        problemDescription: formData.problemDescription.trim(),
        repairAction: formData.repairAction.trim(),
        technician: formData.technician.trim(),
      });
      toast.success('Work order berhasil dibuat');
      setShowAddDialog(false);
      setFormData(emptyForm);
    } catch {
      toast.error('Gagal membuat work order');
    }
  };

  const handleOpenComplete = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setCompleteRepairAction(wo.repairAction || '');
    setCompleteTechnician(wo.technician || '');
    setShowCompleteDialog(true);
  };

  const handleComplete = async () => {
    if (!selectedWO) return;
    if (!completeRepairAction.trim()) {
      toast.error('Tindakan perbaikan wajib diisi');
      return;
    }
    if (!completeTechnician.trim()) {
      toast.error('Nama teknisi wajib diisi');
      return;
    }
    try {
      const now = BigInt(Date.now()) * 1_000_000n;
      const updated: WorkOrder = {
        ...selectedWO,
        status: WorkOrderStatus.done,
        repairAction: completeRepairAction.trim(),
        technician: completeTechnician.trim(),
        dateOut: now,
      };
      await updateWorkOrder.mutateAsync(updated);
      toast.success('Work order selesai');
      setShowCompleteDialog(false);

      // Navigate to cashier with pre-filled data
      storeWorkOrderNavData({
        customerName: selectedWO.customerName,
        customerPhone: selectedWO.customerPhone,
        vehicleInfo: selectedWO.vehicles.join(', '),
        workOrderId: selectedWO.id,
      });
      navigate({ to: '/' });
    } catch {
      toast.error('Gagal menyelesaikan work order');
    }
  };

  const handleNavigateToCashier = (wo: WorkOrder) => {
    storeWorkOrderNavData({
      customerName: wo.customerName,
      customerPhone: wo.customerPhone,
      vehicleInfo: wo.vehicles.join(', '),
      workOrderId: wo.id,
    });
    navigate({ to: '/' });
  };

  const handleDelete = async () => {
    if (!selectedWO) return;
    try {
      await deleteWorkOrder.mutateAsync(selectedWO.id);
      toast.success('Work order dihapus');
      setShowDeleteDialog(false);
      setSelectedWO(null);
    } catch {
      toast.error('Gagal menghapus work order');
    }
  };

  const handleViewDetail = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setShowDetailDialog(true);
  };

  const handleOpenDelete = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setShowDeleteDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Work Order Servis</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola pekerjaan servis kendaraan</p>
        </div>
        <Button onClick={() => { setFormData(emptyForm); setShowAddDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Buat Work Order
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari pelanggan, nomor WO, kendaraan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Tidak ada work order ditemukan
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-mono text-sm">{wo.workOrderNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{wo.customerName}</div>
                    {wo.customerPhone && (
                      <div className="text-xs text-muted-foreground">{wo.customerPhone}</div>
                    )}
                  </TableCell>
                  <TableCell>{wo.vehicles.join(', ')}</TableCell>
                  <TableCell>{formatDate(wo.dateIn)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[wo.status] ?? 'secondary'}>
                      {statusLabel[wo.status] ?? wo.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetail(wo)}
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {wo.status !== WorkOrderStatus.done && wo.status !== WorkOrderStatus.cancelled && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenComplete(wo)}
                          title="Selesaikan Work Order"
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {wo.status === WorkOrderStatus.done && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleNavigateToCashier(wo)}
                          title="Buat Transaksi"
                          className="text-brand hover:text-brand/80"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(wo)}
                        title="Hapus"
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Work Order Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Work Order Baru</DialogTitle>
            <DialogDescription>Isi data work order servis kendaraan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nama Pelanggan *</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Nama pelanggan"
                />
              </div>
              <div className="space-y-1">
                <Label>No. HP</Label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Kendaraan * <span className="text-xs text-muted-foreground">(pisahkan dengan koma)</span></Label>
              <Input
                value={formData.vehicles}
                onChange={(e) => setFormData({ ...formData, vehicles: e.target.value })}
                placeholder="Honda Beat 2020, B 1234 ABC"
              />
            </div>
            <div className="space-y-1">
              <Label>Tanggal Masuk</Label>
              <Input
                type="date"
                value={formData.dateIn}
                onChange={(e) => setFormData({ ...formData, dateIn: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi Masalah *</Label>
              <Textarea
                value={formData.problemDescription}
                onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                placeholder="Jelaskan masalah kendaraan..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Tindakan Perbaikan</Label>
              <Textarea
                value={formData.repairAction}
                onChange={(e) => setFormData({ ...formData, repairAction: e.target.value })}
                placeholder="Tindakan yang dilakukan..."
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Teknisi</Label>
              <Input
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                placeholder="Nama teknisi"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={createWorkOrder.isPending}>
              {createWorkOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Buat Work Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Work Order</DialogTitle>
            <DialogDescription>Informasi lengkap work order</DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">No. Work Order</p>
                  <p className="font-mono font-medium">{selectedWO.workOrderNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={statusVariant[selectedWO.status] ?? 'secondary'}>
                    {statusLabel[selectedWO.status] ?? selectedWO.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pelanggan</p>
                  <p className="font-medium">{selectedWO.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">No. HP</p>
                  <p>{selectedWO.customerPhone || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Kendaraan</p>
                  <p>{selectedWO.vehicles.join(', ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tanggal Masuk</p>
                  <p>{formatDate(selectedWO.dateIn)}</p>
                </div>
                {selectedWO.dateOut && (
                  <div>
                    <p className="text-muted-foreground text-xs">Tanggal Selesai</p>
                    <p>{formatDate(selectedWO.dateOut)}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Teknisi</p>
                  <p>{selectedWO.technician || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Deskripsi Masalah</p>
                <p className="mt-1 p-2 bg-muted rounded text-sm">{selectedWO.problemDescription || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tindakan Perbaikan</p>
                <p className="mt-1 p-2 bg-muted rounded text-sm">{selectedWO.repairAction || '-'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selesaikan Work Order</DialogTitle>
            <DialogDescription>
              Konfirmasi penyelesaian work order untuk {selectedWO?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Tindakan Perbaikan *</Label>
              <Textarea
                value={completeRepairAction}
                onChange={(e) => setCompleteRepairAction(e.target.value)}
                placeholder="Tindakan perbaikan yang dilakukan..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Teknisi *</Label>
              <Input
                value={completeTechnician}
                onChange={(e) => setCompleteTechnician(e.target.value)}
                placeholder="Nama teknisi"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Batal</Button>
            <Button onClick={handleComplete} disabled={updateWorkOrder.isPending}>
              {updateWorkOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Selesai & Buat Transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Work Order</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus work order ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteWorkOrder.isPending}>
              {deleteWorkOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
