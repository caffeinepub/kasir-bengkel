import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { ItemKind } from "@/backend";
import type { InventoryItem, TransactionItem } from "@/backend";

// ─── Inventory ────────────────────────────────────────────────────────────────

export function useInventoryItems() {
  const { actor, isFetching } = useActor();
  return useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllInventoryItems();
    },
    enabled: !!actor && !isFetching,
  });
}

interface AddInventoryItemParams {
  id: string;
  name: string;
  sellingPrice: bigint;
  purchasePrice: bigint;
  quantity: bigint | null;
  kind: ItemKind;
}

export function useAddInventoryItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddInventoryItemParams) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.addInventoryItem(
        params.id,
        params.name,
        params.sellingPrice,
        params.purchasePrice,
        params.quantity,
        params.kind
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteInventoryItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.deleteInventoryItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

interface ReplaceInventoryItemParams {
  id: string;
  name: string;
  sellingPrice: bigint;
  purchasePrice: bigint;
  quantity: bigint | null;
  kind: ItemKind;
}

export function useReplaceInventoryItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReplaceInventoryItemParams) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.deleteInventoryItem(params.id);
      await actor.addInventoryItem(
        params.id,
        params.name,
        params.sellingPrice,
        params.purchasePrice,
        params.quantity,
        params.kind
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateInventoryQuantity() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, newQuantity }: { itemId: string; newQuantity: bigint }) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.updateInventoryItemQuantity(itemId, newQuantity);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["transactions"],
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
      vehicleInfo: string;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.createTransaction(
        params.items,
        params.total,
        params.customerName,
        params.vehicleInfo
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteTransaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.deleteTransaction(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ─── Customers ────────────────────────────────────────────────────────────────

export function useCustomers() {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllCustomers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddCustomer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: string) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.addCustomer(customer);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useDeleteCustomer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: string) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.deleteCustomer(customer);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ─── Shop Settings ────────────────────────────────────────────────────────────

export function useShopSettings() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["shopSettings"],
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
      if (!actor) throw new Error("Actor not initialized");
      await actor.updatePersistentSettings(
        params.shopName,
        params.address,
        params.phoneNumber,
        params.thankYouMessage
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
    },
  });
}

export function useUploadLogo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: import("@/backend").ExternalBlob) => {
      if (!actor) throw new Error("Actor not initialized");
      await actor.uploadLogo(file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
    },
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useDailyReport(day: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["dailyReport", day?.toString()],
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
    queryKey: ["monthlyReport", month?.toString()],
    queryFn: async () => {
      if (!actor || month === null) return null;
      return actor.getMonthlyReport(month);
    },
    enabled: !!actor && !isFetching && month !== null,
  });
}

export function useTopSellingItems(count: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["topSelling", count.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopSellingItems(count);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTransactionsByMonth(monthTimestamp: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["transactionsByMonth", monthTimestamp?.toString()],
    queryFn: async () => {
      if (!actor || monthTimestamp === null) return [];
      return actor.getTransactionsByMonth(monthTimestamp);
    },
    enabled: !!actor && !isFetching && monthTimestamp !== null,
  });
}

export function useProfitLoss(startTime: bigint | null, endTime: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["profitLoss", startTime?.toString(), endTime?.toString()],
    queryFn: async () => {
      if (!actor || startTime === null || endTime === null) return null;
      return actor.calculateProfitLoss(startTime, endTime);
    },
    enabled: !!actor && !isFetching && startTime !== null && endTime !== null,
  });
}
