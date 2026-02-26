import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import Sidebar from '@/components/Sidebar';
import CashierPage from '@/pages/CashierPage';
import CatalogPage from '@/pages/CatalogPage';
import TransactionHistoryPage from '@/pages/TransactionHistoryPage';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';

function Layout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto no-print">
        <Outlet />
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const cashierRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: CashierPage });
const catalogRoute = createRoute({ getParentRoute: () => rootRoute, path: '/catalog', component: CatalogPage });
const transactionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/transactions', component: TransactionHistoryPage });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage });

const routeTree = rootRoute.addChildren([cashierRoute, catalogRoute, transactionsRoute, reportsRoute, settingsRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
