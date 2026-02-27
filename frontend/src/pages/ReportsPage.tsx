import { useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDailyReport, useMonthlyReport, useTopSellingItems, useProfitLoss } from '@/hooks/useQueries';
import { formatRupiah, getStartOfDay, getStartOfMonth, dateToNanoseconds } from '@/lib/utils';

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const [dailyDate, setDailyDate] = useState(today);
  const [monthlyMonth, setMonthlyMonth] = useState(thisMonth);
  const [topCount, setTopCount] = useState(10);
  const [profitStart, setProfitStart] = useState(today);
  const [profitEnd, setProfitEnd] = useState(today);

  // Convert date strings to bigint nanoseconds for the hooks
  const dailyTs = dailyDate
    ? getStartOfDay(new Date(dailyDate + 'T00:00:00'))
    : null;
  const monthlyTs = monthlyMonth
    ? getStartOfMonth(new Date(monthlyMonth + '-01'))
    : null;

  const profitStartTs = profitStart
    ? (() => {
        const d = new Date(profitStart + 'T00:00:00');
        d.setHours(0, 0, 0, 0);
        return dateToNanoseconds(d);
      })()
    : null;
  const profitEndTs = profitEnd
    ? (() => {
        const d = new Date(profitEnd + 'T23:59:59');
        d.setHours(23, 59, 59, 999);
        return dateToNanoseconds(d);
      })()
    : null;

  const { data: dailyReport, isLoading: dailyLoading } = useDailyReport(dailyTs);
  const { data: monthlyReport, isLoading: monthlyLoading } = useMonthlyReport(monthlyTs);
  const { data: topItems = [], isLoading: topLoading } = useTopSellingItems(BigInt(topCount));
  const { data: profitData, isLoading: profitLoading, refetch: refetchProfit } = useProfitLoss(
    profitStartTs,
    profitEndTs
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Laporan</h1>
        <p className="text-sm text-muted-foreground mt-1">Analisis performa bisnis bengkel Anda</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="mb-4">
          <TabsTrigger value="daily">Laporan Harian</TabsTrigger>
          <TabsTrigger value="monthly">Laporan Bulanan</TabsTrigger>
          <TabsTrigger value="top">Barang Terlaris</TabsTrigger>
          <TabsTrigger value="profit">Laba Rugi</TabsTrigger>
        </TabsList>

        {/* Daily Report */}
        <TabsContent value="daily" className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Tanggal:</label>
            <Input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="w-44"
            />
          </div>
          {dailyLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="animate-spin" size={20} />
              <span>Memuat laporan...</span>
            </div>
          ) : dailyReport ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-brand">{formatRupiah(Number(dailyReport.totalRevenue))}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{String(dailyReport.transactionCount)}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* Monthly Report */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Bulan:</label>
            <Input
              type="month"
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
              className="w-44"
            />
          </div>
          {monthlyLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="animate-spin" size={20} />
              <span>Memuat laporan...</span>
            </div>
          ) : monthlyReport ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-brand">{formatRupiah(Number(monthlyReport.totalRevenue))}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{String(monthlyReport.transactionCount)}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* Top Selling */}
        <TabsContent value="top" className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Tampilkan:</label>
            <Input
              type="number"
              value={topCount}
              onChange={(e) => setTopCount(Math.max(1, Number(e.target.value)))}
              className="w-24"
              min={1}
              max={100}
            />
            <span className="text-sm text-muted-foreground">barang teratas</span>
          </div>
          {topLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="animate-spin" size={20} />
              <span>Memuat data...</span>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peringkat</TableHead>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead className="text-right">Total Terjual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Belum ada data penjualan
                      </TableCell>
                    </TableRow>
                  ) : (
                    topItems.map(([name, count], i) => (
                      <TableRow key={name}>
                        <TableCell className="font-medium">#{i + 1}</TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell className="text-right font-semibold">{String(count)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Profit/Loss */}
        <TabsContent value="profit" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">Dari:</label>
              <Input
                type="date"
                value={profitStart}
                onChange={(e) => setProfitStart(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">Sampai:</label>
              <Input
                type="date"
                value={profitEnd}
                onChange={(e) => setProfitEnd(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={() => refetchProfit()} disabled={profitLoading} size="sm">
              {profitLoading ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <TrendingUp size={14} className="mr-1.5" />
              )}
              Hitung
            </Button>
          </div>
          {profitLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="animate-spin" size={20} />
              <span>Menghitung laba rugi...</span>
            </div>
          ) : profitData !== undefined && profitData !== null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Laba Kotor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${Number(profitData) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatRupiah(Number(profitData))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Periode: {profitStart} s/d {profitEnd}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
