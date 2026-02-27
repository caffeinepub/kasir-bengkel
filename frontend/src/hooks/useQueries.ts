import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type {
  InventoryItem,
  ItemKind,
  TransactionItem,
  WorkOrder,
  UserProfile,
  DailyReport,
  MonthlyReport,
  ShopSettings,
  Transaction,
  ExternalBlob,
} from '../backend';

// ─── User Profile ─────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      id: string;
      name: string;
      sellingPrice: bigint;
      purchasePrice: bigint;
      quantity: bigint | null;
      kind: ItemKind;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addInventoryItem(
        item.id,
        item.name,
        item.sellingPrice,
        item.purchasePrice,
        item.quantity,
        item.kind
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventoryItemQuantity() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, newQuantity }: { itemId: string; newQuantity: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateInventoryItemQuantity(itemId, newQuantity);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateAllItems() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: InventoryItem[]) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateAllItems(items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteInventoryItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteInventoryItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      items: TransactionItem[];
      total: bigint;
      customerName: string;
      customerPhone: string;
      vehicleInfo: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createTransaction(
        params.items,
        params.total,
        params.customerName,
        params.customerPhone,
        params.vehicleInfo
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// ─── Shop Settings ────────────────────────────────────────────────────────────

export function useShopSettings() {
  const { actor, isFetching } = useActor();

  return useQuery<ShopSettings | null>({
    queryKey: ['shopSettings'],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getPersistentSettings();
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateShopSettings() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      shopName: string;
      address: string;
      phoneNumber: string;
      thankYouMessage: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updatePersistentSettings(
        params.shopName,
        params.address,
        params.phoneNumber,
        params.thankYouMessage
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSettings'] });
    },
  });
}

export function useUploadLogo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: ExternalBlob) => {
      if (!actor) throw new Error('Actor not available');
      return actor.uploadLogo(file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSettings'] });
    },
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useDailyReport(day: bigint | null) {
  const { actor, isFetching } = useActor();

  return useQuery<DailyReport | null>({
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

  return useQuery<MonthlyReport | null>({
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

  return useQuery<Array<[string, bigint]>>({
    queryKey: ['topSellingItems', count.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopSellingItems(count);
    },
    enabled: !!actor && !isFetching,
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

// ─── Work Orders ──────────────────────────────────────────────────────────────

export function useWorkOrders() {
  const { actor, isFetching } = useActor();

  return useQuery<WorkOrder[]>({
    queryKey: ['workOrders'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listWorkOrders();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateWorkOrder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      customerName: string;
      customerPhone: string;
      vehicles: string[];
      dateIn: bigint;
      problemDescription: string;
      repairAction: string;
      technician: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createWorkOrder(
        params.customerName,
        params.customerPhone,
        params.vehicles,
        params.dateIn,
        params.problemDescription,
        params.repairAction,
        params.technician
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
}

export function useUpdateWorkOrder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workOrder: WorkOrder) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateWorkOrder(workOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
}

export function useDeleteWorkOrder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteWorkOrder(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
}
