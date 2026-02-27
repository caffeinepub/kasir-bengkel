import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import Sidebar from './components/Sidebar';
import CashierPage from './pages/CashierPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import InventoryPage from './pages/InventoryPage';
import ServicePage from './pages/ServicePage';

const queryClient = new QueryClient();

function Layout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const cashierRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: CashierPage });
const inventoryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/inventory', component: InventoryPage });
const serviceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/service', component: ServicePage });
const transactionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/transactions', component: TransactionHistoryPage });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage });

const routeTree = rootRoute.addChildren([
  cashierRoute,
  inventoryRoute,
  serviceRoute,
  transactionsRoute,
  reportsRoute,
  settingsRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default AppContent;
