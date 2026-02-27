import { useState, useEffect, useRef } from 'react';
import { Save, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useShopSettings, useUpdateShopSettings, useUploadLogo } from '@/hooks/useQueries';
import { ExternalBlob } from '@/backend';

export default function SettingsPage() {
  const { data: settings, isLoading } = useShopSettings();
  const updateSettings = useUpdateShopSettings();
  const uploadLogo = useUploadLogo();

  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName || '');
      setAddress(settings.address || '');
      setPhoneNumber(settings.phoneNumber || '');
      setThankYouMessage(settings.thankYouMessage || '');
      if (settings.logo) {
        setLogoPreview(settings.logo.getDirectURL());
      }
    }
  }, [settings]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) => {
        setUploadProgress(pct);
      });
      await uploadLogo.mutateAsync(blob);
      setLogoPreview(URL.createObjectURL(file));
      toast.success('Logo berhasil diunggah');
    } catch (e: unknown) {
      toast.error('Gagal mengunggah logo: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({ shopName, address, phoneNumber, thankYouMessage });
      toast.success('Pengaturan berhasil disimpan');
    } catch (e: unknown) {
      toast.error('Gagal menyimpan pengaturan: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola informasi bengkel Anda</p>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Logo Bengkel</CardTitle>
          <CardDescription>Logo akan ditampilkan pada struk pembayaran</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground text-center px-2">Belum ada logo</span>
              )}
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <Upload size={14} className="mr-1.5" />
                )}
                {isUploading ? `Mengunggah... ${uploadProgress}%` : 'Unggah Logo'}
              </Button>
              {logoPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setLogoPreview(null)}
                >
                  <X size={14} className="mr-1.5" />
                  Hapus Logo
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
          {isUploading && <Progress value={uploadProgress} className="h-1.5" />}
        </CardContent>
      </Card>

      {/* Shop Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Bengkel</CardTitle>
          <CardDescription>Informasi ini akan ditampilkan pada struk pembayaran</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama Bengkel</Label>
            <Input
              placeholder="Masukkan nama bengkel"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Alamat</Label>
            <Textarea
              placeholder="Masukkan alamat bengkel"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nomor Telepon</Label>
            <Input
              placeholder="Masukkan nomor telepon"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pesan Terima Kasih</Label>
            <Textarea
              placeholder="Pesan yang ditampilkan di bagian bawah struk"
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Save size={14} className="mr-1.5" />
            )}
            Simpan Pengaturan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
