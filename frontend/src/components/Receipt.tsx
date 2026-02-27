import { forwardRef } from 'react';
import type { Transaction, ShopSettings } from '@/backend';
import { formatRupiah, formatDateTime } from '@/lib/utils';

interface ReceiptProps {
  transaction: Transaction;
  shopSettings?: ShopSettings;
  discount?: number;
}

const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ transaction, shopSettings, discount = 0 }, ref) => {
    const subtotal = transaction.items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    return (
      <div ref={ref} className="receipt-content font-mono text-xs text-foreground bg-background p-4 rounded-lg border">
        {/* Header */}
        <div className="text-center mb-3">
          {shopSettings?.logo && (
            <img
              src={shopSettings.logo.getDirectURL()}
              alt="Logo"
              className="w-16 h-16 object-contain mx-auto mb-2"
            />
          )}
          <p className="font-bold text-sm">{shopSettings?.shopName || 'Kasir Bengkel'}</p>
          {shopSettings?.address && <p className="text-muted-foreground">{shopSettings.address}</p>}
          {shopSettings?.phoneNumber && <p className="text-muted-foreground">Telp: {shopSettings.phoneNumber}</p>}
        </div>

        <div className="border-t border-dashed border-border my-2" />

        {/* Transaction Info */}
        <div className="space-y-0.5 mb-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">No. Transaksi</span>
            <span>#{String(transaction.id)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tanggal</span>
            <span>{formatDateTime(transaction.timestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pelanggan</span>
            <span>{transaction.customerName}</span>
          </div>
          {transaction.customerPhone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nomor HP</span>
              <span>{transaction.customerPhone}</span>
            </div>
          )}
          {transaction.vehicleInfo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kendaraan</span>
              <span>{transaction.vehicleInfo}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-border my-2" />

        {/* Items */}
        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-muted-foreground">
            <span>Barang/Jasa</span>
            <span>Subtotal</span>
          </div>
          {transaction.items.map((item, i) => (
            <div key={i} className="space-y-0.5">
              <p className="font-medium">{item.name}</p>
              <div className="flex justify-between text-muted-foreground">
                <span>{String(item.quantity)} x {formatRupiah(Number(item.price))}</span>
                <span>{formatRupiah(Number(item.price) * Number(item.quantity))}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-border my-2" />

        {/* Totals */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diskon</span>
              <span>- {formatRupiah(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm">
            <span>Total</span>
            <span>{formatRupiah(Number(transaction.total))}</span>
          </div>
        </div>

        {shopSettings?.thankYouMessage && (
          <>
            <div className="border-t border-dashed border-border my-2" />
            <p className="text-center text-muted-foreground">{shopSettings.thankYouMessage}</p>
          </>
        )}

        <div className="border-t border-dashed border-border my-2" />
        <p className="text-center text-muted-foreground text-xs">Terima kasih atas kunjungan Anda!</p>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
export default Receipt;
