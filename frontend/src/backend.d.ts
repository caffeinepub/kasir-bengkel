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
    id: bigint;
    purchasePrice: bigint;
    name: string;
    sellingPrice: bigint;
    productType: ProductType;
    quantity?: bigint;
}
export type Time = bigint;
export interface TransactionItem {
    id: bigint;
    name: string;
    itemType: ProductType;
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
export enum ProductType {
    service = "service",
    goods = "goods"
}
export interface backendInterface {
    addCustomer(customer: string): Promise<void>;
    addInventoryItem(id: bigint, name: string, sellingPrice: bigint, purchasePrice: bigint, quantity: bigint | null, productType: ProductType): Promise<void>;
    calculateProfitLoss(startTime: Time, endTime: Time): Promise<bigint>;
    createTransaction(items: Array<TransactionItem>, total: bigint, customerName: string, vehicleInfo: string): Promise<bigint>;
    deleteCustomer(customer: string): Promise<void>;
    deleteInventoryItem(id: bigint): Promise<void>;
    deleteTransaction(id: bigint): Promise<void>;
    getAllCustomers(): Promise<Array<string>>;
    getAllInventoryItems(): Promise<Array<InventoryItem>>;
    getAllTransactions(): Promise<Array<Transaction>>;
    getDailyReport(day: Time): Promise<DailyReport>;
    getInventoryItem(id: bigint): Promise<InventoryItem | null>;
    getMonthlyReport(month: Time): Promise<MonthlyReport>;
    getShopSettings(): Promise<ShopSettings>;
    getTopSellingItems(count: bigint): Promise<Array<[string, bigint]>>;
    getTransaction(id: bigint): Promise<Transaction | null>;
    getTransactionsByCustomer(customer: string): Promise<Array<Transaction>>;
    getTransactionsByMonth(monthTimestamp: Time): Promise<Array<Transaction>>;
    updateInventoryItemQuantity(itemId: bigint, newQuantity: bigint): Promise<void>;
    updateShopSettings(shopName: string, address: string, phoneNumber: string, thankYouMessage: string): Promise<void>;
    uploadLogo(file: ExternalBlob): Promise<void>;
}
