import { Link, useLocation } from '@tanstack/react-router';
import { ShoppingCart, Package, History, BarChart2, Settings } from 'lucide-react';

const navItems = [
  { label: 'Kasir', icon: ShoppingCart, path: '/' },
  { label: 'Inventori', icon: Package, path: '/inventory' },
  { label: 'Transaksi', icon: History, path: '/transactions' },
  { label: 'Laporan', icon: BarChart2, path: '/reports' },
  { label: 'Pengaturan', icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar-nav flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground shadow-lg">
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="/assets/generated/bengkel-logo.dim_256x256.png"
            alt="Logo"
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-lg font-bold text-brand leading-tight">Kasir Bengkel</h1>
            <p className="text-xs text-sidebar-foreground/60">Manajemen Toko</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 text-center">
          © {new Date().getFullYear()} Kasir Bengkel
        </p>
      </div>
    </aside>
  );
}
