import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { ExternalBlob, type TransactionItem, type ShopSettings, type Product, type Service, type Transaction } from '../backend';

// ─── Shop Settings ───────────────────────────────────────────────────────────

export function useShopSettings() {
  const { actor, isFetching } = useActor();
  return useQuery<ShopSettings | null>({
    queryKey: ['shopSettings'],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getShopSettings();
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateShopSettings() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { shopName: string; address: string; phoneNumber: string; thankYouMessage: string }) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.updateShopSettings(data.shopName, data.address, data.phoneNumber, data.thankYouMessage);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopSettings'] }),
  });
}

export function useUploadLogo() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: ExternalBlob) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.uploadLogo(file);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopSettings'] }),
  });
}

// ─── Products ────────────────────────────────────────────────────────────────

export function useProducts() {
  const { actor, isFetching } = useActor();
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllProducts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddProduct() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: bigint; name: string; price: bigint; stock: bigint }) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.addProduct(data.id, data.name, data.price, data.stock);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProductStock() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { productId: bigint; newStock: bigint }) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.updateProductStock(data.productId, data.newStock);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.deleteProduct(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

// ─── Services ────────────────────────────────────────────────────────────────

export function useServices() {
  const { actor, isFetching } = useActor();
  return useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllServices();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddService() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: bigint; name: string; price: bigint; description: string }) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.addService(data.id, data.name, data.price, data.description);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.deleteService(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions() {
  const { actor, isFetching } = useActor();
  return useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllTransactions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { items: TransactionItem[]; total: bigint; customerName: string; vehicleInfo: string }) => {
      if (!actor) throw new Error('Actor not ready');
      return actor.createTransaction(data.items, data.total, data.customerName, data.vehicleInfo);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ─── Customers ────────────────────────────────────────────────────────────────

export function useCustomers() {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllCustomers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddCustomer() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer: string) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.addCustomer(customer);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useDailyReport(day: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['dailyReport', day?.toString()],
    queryFn: async () => {
      if (!actor || day === null) return null;
      return actor.getDailyReport(day);
    },
    enabled: !!actor && !isFetching && day !== null,
  });
}

export function useMonthlyReport(month: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['monthlyReport', month?.toString()],
    queryFn: async () => {
      if (!actor || month === null) return null;
      return actor.getMonthlyReport(month);
    },
    enabled: !!actor && !isFetching && month !== null,
  });
}

export function useTopSellingItems(count: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<[string, bigint][]>({
    queryKey: ['topSelling', count.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopSellingItems(count);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTransactionsByMonth(monthTimestamp: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Transaction[]>({
    queryKey: ['transactionsByMonth', monthTimestamp?.toString()],
    queryFn: async () => {
      if (!actor || monthTimestamp === null) return [];
      return actor.getTransactionsByMonth(monthTimestamp);
    },
    enabled: !!actor && !isFetching && monthTimestamp !== null,
  });
}
