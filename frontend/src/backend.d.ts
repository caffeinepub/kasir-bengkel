import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface MonthlyReport {
    month: Time;
    totalRevenue: bigint;
    transactionCount: bigint;
}
export interface InventoryItem {
    id: string;
    purchasePrice: bigint;
    kind: ItemKind;
    name: string;
    sellingPrice: bigint;
    quantity?: bigint;
}
export type Time = bigint;
export interface TransactionItem {
    id: string;
    name: string;
    itemType: ItemKind;
    quantity: bigint;
    price: bigint;
}
export interface ShopSettings {
    logo?: ExternalBlob;
    address: string;
    shopName: string;
    phoneNumber: string;
    thankYouMessage: string;
}
export interface DailyReport {
    day: Time;
    totalRevenue: bigint;
    transactionCount: bigint;
}
export interface Transaction {
    id: bigint;
    customerName: string;
    vehicleInfo: string;
    total: bigint;
    timestamp: Time;
    items: Array<TransactionItem>;
}
export enum ItemKind {
    service = "service",
    goods = "goods"
}
export interface backendInterface {
    addCustomer(customer: string): Promise<void>;
    addInventoryItem(id: string, name: string, sellingPrice: bigint, purchasePrice: bigint, quantity: bigint | null, kind: ItemKind): Promise<void>;
    calculateProfitLoss(startTime: Time, endTime: Time): Promise<bigint>;
    createTransaction(items: Array<TransactionItem>, total: bigint, customerName: string, vehicleInfo: string): Promise<bigint>;
    deleteCustomer(customer: string): Promise<void>;
    deleteInventoryItem(id: string): Promise<void>;
    deleteTransaction(id: bigint): Promise<void>;
    getAllCustomers(): Promise<Array<string>>;
    getAllInventoryItems(): Promise<Array<InventoryItem>>;
    getAllTransactions(): Promise<Array<Transaction>>;
    getDailyReport(day: Time): Promise<DailyReport>;
    getInventoryItem(id: string): Promise<InventoryItem | null>;
    getMonthlyReport(month: Time): Promise<MonthlyReport>;
    getPersistentSettings(): Promise<ShopSettings>;
    getTopSellingItems(count: bigint): Promise<Array<[string, bigint]>>;
    getTransaction(id: bigint): Promise<Transaction | null>;
    getTransactionsByCustomer(customer: string): Promise<Array<Transaction>>;
    getTransactionsByMonth(monthTimestamp: Time): Promise<Array<Transaction>>;
    updateAllItems(items: Array<InventoryItem>): Promise<void>;
    updateInventoryItemQuantity(itemId: string, newQuantity: bigint): Promise<void>;
    updatePersistentSettings(shopName: string, address: string, phoneNumber: string, thankYouMessage: string): Promise<void>;
    uploadLogo(file: ExternalBlob): Promise<void>;
}
