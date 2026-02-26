import { Link, useRouterState } from '@tanstack/react-router';
import { ShoppingCart, Package, History, BarChart2, Settings, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Kasir', icon: ShoppingCart },
  { to: '/catalog', label: 'Katalog', icon: Package },
  { to: '/transactions', label: 'Riwayat', icon: History },
  { to: '/reports', label: 'Laporan', icon: BarChart2 },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
];

export default function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="no-print w-64 bg-sidebar flex flex-col border-r border-sidebar-border shrink-0">
      {/* Logo & Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sidebar-foreground text-sm leading-tight">Kasir Bengkel</p>
          <p className="text-xs text-muted-foreground">Workshop POS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Built with ❤️ using{' '}
          <a
            href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname || 'kasir-bengkel')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            caffeine.ai
          </a>
        </p>
        <p className="text-xs text-muted-foreground text-center mt-0.5">© {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
