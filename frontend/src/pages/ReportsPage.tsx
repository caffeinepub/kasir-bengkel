import { useState } from 'react';
import { TrendingUp, ShoppingBag, Receipt, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useDailyReport, useMonthlyReport, useTopSellingItems } from '@/hooks/useQueries';
import { formatRupiah, getStartOfDay, getStartOfMonth } from '@/lib/utils';

export default function ReportsPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(today.toISOString().slice(0, 7));

  const dayTs = getStartOfDay(new Date(selectedDate + 'T00:00:00'));
  const monthTs = getStartOfMonth(new Date(selectedMonth + '-01'));

  const { data: dailyReport, isLoading: loadingDaily } = useDailyReport(dayTs);
  const { data: monthlyReport, isLoading: loadingMonthly } = useMonthlyReport(monthTs);
  const { data: topItems = [], isLoading: loadingTop } = useTopSellingItems(BigInt(10));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Laporan</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Ringkasan penjualan harian dan bulanan</p>
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
