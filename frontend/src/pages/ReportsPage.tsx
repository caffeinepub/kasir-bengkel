import { useState } from 'react';
import { TrendingUp, ShoppingBag, Receipt, Trophy, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useDailyReport, useMonthlyReport, useTopSellingItems, useProfitLoss } from '@/hooks/useQueries';
import { formatRupiah, getStartOfDay, getStartOfMonth, dateToNanoseconds } from '@/lib/utils';

export default function ReportsPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(today.toISOString().slice(0, 7));
  const [profitStartDate, setProfitStartDate] = useState(today.toISOString().split('T')[0]);
  const [profitEndDate, setProfitEndDate] = useState(today.toISOString().split('T')[0]);

  const dayTs = getStartOfDay(new Date(selectedDate + 'T00:00:00'));
  const monthTs = getStartOfMonth(new Date(selectedMonth + '-01'));

  // Profit/Loss date range: start of start day to end of end day
  const profitStart = (() => {
    const d = new Date(profitStartDate + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return dateToNanoseconds(d);
  })();
  const profitEnd = (() => {
    const d = new Date(profitEndDate + 'T23:59:59');
    d.setHours(23, 59, 59, 999);
    return dateToNanoseconds(d);
  })();

  const { data: dailyReport, isLoading: loadingDaily } = useDailyReport(dayTs);
  const { data: monthlyReport, isLoading: loadingMonthly } = useMonthlyReport(monthTs);
  const { data: topItems = [], isLoading: loadingTop } = useTopSellingItems(BigInt(10));
  const { data: profitLoss, isLoading: loadingProfit } = useProfitLoss(profitStart, profitEnd);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Laporan</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Ringkasan penjualan harian, bulanan, dan laba rugi</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="mb-6">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Harian
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Bulanan
          </TabsTrigger>
          <TabsTrigger value="top" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Terlaris
          </TabsTrigger>
          <TabsTrigger value="profit" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Laba Rugi
          </TabsTrigger>
        </TabsList>

        {/* Daily */}
        <TabsContent value="daily">
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-muted-foreground">Pilih Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title="Total Pendapatan"
              icon={<TrendingUp className="w-5 h-5 text-brand" />}
              value={loadingDaily ? null : formatRupiah(Number(dailyReport?.totalRevenue ?? 0))}
              subtitle={selectedDate}
            />
            <StatCard
              title="Jumlah Transaksi"
              icon={<Receipt className="w-5 h-5 text-brand" />}
              value={loadingDaily ? null : String(dailyReport?.transactionCount ?? 0)}
              subtitle="transaksi hari ini"
            />
          </div>
        </TabsContent>

        {/* Monthly */}
        <TabsContent value="monthly">
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-muted-foreground">Pilih Bulan:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title="Total Pendapatan Bulan Ini"
              icon={<TrendingUp className="w-5 h-5 text-brand" />}
              value={loadingMonthly ? null : formatRupiah(Number(monthlyReport?.totalRevenue ?? 0))}
              subtitle={selectedMonth}
            />
            <StatCard
              title="Jumlah Transaksi"
              icon={<Receipt className="w-5 h-5 text-brand" />}
              value={loadingMonthly ? null : String(monthlyReport?.transactionCount ?? 0)}
              subtitle="transaksi bulan ini"
            />
          </div>
        </TabsContent>

        {/* Top Selling */}
        <TabsContent value="top">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand" /> 10 Item Terlaris
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Berdasarkan total kuantitas terjual</p>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            {loadingTop ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : topItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Belum ada data penjualan</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {topItems.map(([name, qty], idx) => (
                  <div key={name} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      idx === 0 ? 'bg-yellow-500 text-white' :
                      idx === 1 ? 'bg-gray-400 text-white' :
                      idx === 2 ? 'bg-amber-700 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="flex-1 font-medium">{name}</span>
                    <Badge variant="secondary" className="font-mono">
                      {String(qty)} terjual
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Profit / Loss */}
        <TabsContent value="profit">
          <div className="mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-brand" /> Laporan Laba Rugi
            </h2>
            <p className="text-sm text-muted-foreground">
              Laba dihitung dari (Harga Jual − Harga Beli) × Qty untuk setiap barang yang terjual dalam periode yang dipilih.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Dari Tanggal:</label>
              <input
                type="date"
                value={profitStartDate}
                onChange={e => setProfitStartDate(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sampai Tanggal:</label>
              <input
                type="date"
                value={profitEndDate}
                min={profitStartDate}
                onChange={e => setProfitEndDate(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-border sm:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Laba Kotor
                </CardTitle>
                <DollarSign className="w-5 h-5 text-brand" />
              </CardHeader>
              <CardContent>
                {loadingProfit ? (
                  <Skeleton className="h-10 w-48" />
                ) : (
                  <>
                    <div className={`text-3xl font-bold ${Number(profitLoss ?? 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      {formatRupiah(Number(profitLoss ?? 0))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Periode: {profitStartDate} s/d {profitEndDate}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 p-4 rounded-xl border border-border bg-muted/10 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Catatan:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Laba dihitung hanya untuk item bertipe <strong>Barang</strong> (bukan Jasa).</li>
              <li>Rumus: Σ (Harga Jual − Harga Beli) × Qty terjual.</li>
              <li>Jika harga beli lebih tinggi dari harga jual, item tersebut tidak dihitung (dianggap 0).</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, icon, value, subtitle }: { title: string; icon: React.ReactNode; value: string | null; subtitle: string }) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-3xl font-bold text-foreground">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
