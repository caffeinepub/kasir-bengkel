import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { ExternalBlob, ProductType, type TransactionItem, type ShopSettings, type InventoryItem, type Transaction } from '../backend';

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

// ─── Inventory ────────────────────────────────────────────────────────────────

export function useInventoryItems() {
  const { actor, isFetching } = useActor();
  return useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllInventoryItems();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddInventoryItem() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      name: string;
      sellingPrice: bigint;
      purchasePrice: bigint;
      quantity: bigint | null;
      productType: ProductType;
    }) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.addInventoryItem(
        data.id,
        data.name,
        data.sellingPrice,
        data.purchasePrice,
        data.quantity,
        data.productType
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useReplaceInventoryItem() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      name: string;
      sellingPrice: bigint;
      purchasePrice: bigint;
      quantity: bigint | null;
      productType: ProductType;
    }) => {
      if (!actor) throw new Error('Actor not ready');
      // Delete existing then re-add with updated data
      await actor.deleteInventoryItem(data.id);
      await actor.addInventoryItem(
        data.id,
        data.name,
        data.sellingPrice,
        data.purchasePrice,
        data.quantity,
        data.productType
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useUpdateInventoryQuantity() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { itemId: bigint; newQuantity: bigint }) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.updateInventoryItemQuantity(data.itemId, data.newQuantity);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useDeleteInventoryItem() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.deleteInventoryItem(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
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
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteTransaction() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error('Actor not ready');
      await actor.deleteTransaction(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
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

export function useProfitLoss(startTime: bigint | null, endTime: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<bigint | null>({
    queryKey: ['profitLoss', startTime?.toString(), endTime?.toString()],
    queryFn: async () => {
      if (!actor || startTime === null || endTime === null) return null;
      return actor.calculateProfitLoss(startTime, endTime);
    },
    enabled: !!actor && !isFetching && startTime !== null && endTime !== null,
  });
}
