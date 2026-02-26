import { useState, useEffect, useRef } from 'react';
import { Upload, Save, Store, Phone, MapPin, MessageSquare, Image } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useShopSettings, useUpdateShopSettings, useUploadLogo } from '@/hooks/useQueries';
import { ExternalBlob } from '../backend';

export default function SettingsPage() {
  const { data: settings, isLoading } = useShopSettings();
  const updateSettings = useUpdateShopSettings();
  const uploadLogo = useUploadLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    shopName: '',
    address: '',
    phoneNumber: '',
    thankYouMessage: '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        shopName: settings.shopName,
        address: settings.address,
        phoneNumber: settings.phoneNumber,
        thankYouMessage: settings.thankYouMessage,
      });
      if (settings.logo) {
        setLogoPreview(settings.logo.getDirectURL());
      }
    }
  }, [settings]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress(pct => setUploadProgress(pct));
      await uploadLogo.mutateAsync(blob);
      toast.success('Logo berhasil diunggah');
    } catch (err) {
      toast.error('Gagal mengunggah logo');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    if (!form.shopName.trim()) { toast.error('Nama toko harus diisi'); return; }
    try {
      await updateSettings.mutateAsync(form);
      toast.success('Pengaturan berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan pengaturan');
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Pengaturan Toko</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Konfigurasi informasi bengkel yang tampil di struk</p>
      </div>

      <div className="space-y-6">
        {/* Logo */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4 text-brand" /> Logo Toko
            </CardTitle>
            <CardDescription>Logo akan tampil di bagian atas struk cetak</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <img
                    src="/assets/generated/default-shop-logo.dim_300x300.png"
                    alt="Default Logo"
                    className="w-full h-full object-contain opacity-50"
                  />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="mb-2"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? `Mengunggah... ${uploadProgress}%` : 'Pilih Gambar'}
                </Button>
                {isUploading && (
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                    <div
                      className="bg-brand h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Format: JPG, PNG, GIF. Maks 2MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shop Info */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4 text-brand" /> Informasi Toko
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Store className="w-3.5 h-3.5" /> Nama Toko
              </Label>
              <Input
                value={form.shopName}
                onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))}
                placeholder="Bengkel Maju Jaya"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5" /> Alamat
              </Label>
              <Textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Jl. Raya No. 123, Kota..."
                rows={2}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Phone className="w-3.5 h-3.5" /> Nomor Telepon
              </Label>
              <Input
                value={form.phoneNumber}
                onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="0812-3456-7890"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Receipt Message */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand" /> Pesan Struk
            </CardTitle>
            <CardDescription>Pesan yang tampil di bagian bawah struk</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.thankYouMessage}
              onChange={e => setForm(f => ({ ...f, thankYouMessage: e.target.value }))}
              placeholder="Terima kasih atas kepercayaan Anda. Semoga kendaraan Anda selalu prima!"
              rows={3}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        <Separator />

        <Button
          className="bg-brand hover:bg-brand-dark text-white font-semibold px-8"
          size="lg"
          onClick={handleSave}
          disabled={updateSettings.isPending || isLoading}
        >
          <Save className="w-4 h-4 mr-2" />
          {updateSettings.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </Button>
      </div>
    </div>
  );
}
