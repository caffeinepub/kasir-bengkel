import { forwardRef } from 'react';
import type { Transaction, ShopSettings } from '../backend';
import { formatRupiah, formatDateTime } from '@/lib/utils';

interface ReceiptProps {
  transaction: Transaction;
  settings: ShopSettings | null;
}

const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ transaction, settings }, ref) => {
  const logoUrl = settings?.logo ? settings.logo.getDirectURL() : '/assets/generated/default-shop-logo.dim_300x300.png';
  const shopName = settings?.shopName || 'Bengkel Kami';
  const address = settings?.address || '';
  const phone = settings?.phoneNumber || '';
  const thankYou = settings?.thankYouMessage || 'Terima kasih atas kunjungan Anda!';

  return (
    <div ref={ref} className="receipt-print bg-white text-black font-mono text-xs w-full max-w-xs mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-3">
        <img
          src={logoUrl}
          alt="Logo Toko"
          className="w-16 h-16 object-contain mx-auto mb-2"
          onError={(e) => { (e.target as HTMLImageElement).src = '/assets/generated/default-shop-logo.dim_300x300.png'; }}
        />
        <div className="font-bold text-sm uppercase tracking-wide">{shopName}</div>
        {address && <div className="text-xs mt-0.5">{address}</div>}
        {phone && <div className="text-xs">Telp: {phone}</div>}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Transaction Info */}
      <div className="space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span>No. Transaksi</span>
          <span className="font-semibold">#{String(transaction.id).padStart(5, '0')}</span>
        </div>
        <div className="flex justify-between">
          <span>Tanggal</span>
          <span>{formatDateTime(transaction.timestamp)}</span>
        </div>
        {transaction.customerName && (
          <div className="flex justify-between">
            <span>Pelanggan</span>
            <span className="font-semibold max-w-[120px] text-right truncate">{transaction.customerName}</span>
          </div>
        )}
        {transaction.vehicleInfo && (
          <div className="flex justify-between">
            <span>Kendaraan</span>
            <span className="font-semibold max-w-[120px] text-right truncate">{transaction.vehicleInfo}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Items */}
      <div className="space-y-1 mb-2">
        {transaction.items.map((item, idx) => (
          <div key={idx}>
            <div className="font-medium truncate">{item.name}</div>
            <div className="flex justify-between text-gray-600">
              <span>{Number(item.quantity)} x {formatRupiah(Number(item.price))}</span>
              <span className="font-semibold text-black">{formatRupiah(Number(item.quantity) * Number(item.price))}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Total */}
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{formatRupiah(Number(transaction.total))}</span>
      </div>

      <div className="border-t border-dashed border-gray-400 my-3" />

      {/* Thank You */}
      <div className="text-center text-xs italic">{thankYou}</div>
      <div className="text-center text-xs mt-1 text-gray-500">Powered by Kasir Bengkel</div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;
