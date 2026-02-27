import { Link, useLocation } from '@tanstack/react-router';
import {
  ShoppingCart,
  Package,
  History,
  BarChart2,
  Settings,
  Wrench,
  BookOpen,
} from 'lucide-react';

const navItems = [
  { label: 'Kasir', icon: ShoppingCart, path: '/' },
  { label: 'Inventori', icon: Package, path: '/inventory' },
  { label: 'Servis', icon: Wrench, path: '/service' },
  { label: 'Transaksi', icon: History, path: '/transactions' },
  { label: 'Laporan', icon: BarChart2, path: '/reports' },
  { label: 'Pengaturan', icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 bg-sidebar flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sidebar-foreground text-sm tracking-wide">Bengkel POS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
