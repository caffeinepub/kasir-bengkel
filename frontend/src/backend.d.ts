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
export interface Product {
    id: bigint;
    name: string;
    stock: bigint;
    price: bigint;
}
export interface MonthlyReport {
    month: Time;
    totalRevenue: bigint;
    transactionCount: bigint;
}
export type Time = bigint;
export interface TransactionItem {
    id: bigint;
    name: string;
    itemType: ItemType;
    quantity: bigint;
    price: bigint;
}
export interface Service {
    id: bigint;
    name: string;
    description: string;
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
export enum ItemType {
    service = "service",
    product = "product"
}
export interface backendInterface {
    addCustomer(customer: string): Promise<void>;
    addProduct(id: bigint, name: string, price: bigint, stock: bigint): Promise<void>;
    addService(id: bigint, name: string, price: bigint, description: string): Promise<void>;
    createTransaction(items: Array<TransactionItem>, total: bigint, customerName: string, vehicleInfo: string): Promise<bigint>;
    deleteCustomer(customer: string): Promise<void>;
    deleteProduct(id: bigint): Promise<void>;
    deleteService(id: bigint): Promise<void>;
    deleteTransaction(id: bigint): Promise<void>;
    getAllCustomers(): Promise<Array<string>>;
    getAllProducts(): Promise<Array<Product>>;
    getAllServices(): Promise<Array<Service>>;
    getAllTransactions(): Promise<Array<Transaction>>;
    getDailyReport(day: Time): Promise<DailyReport>;
    getMonthlyReport(month: Time): Promise<MonthlyReport>;
    getShopSettings(): Promise<ShopSettings>;
    getTopSellingItems(count: bigint): Promise<Array<[string, bigint]>>;
    getTransaction(id: bigint): Promise<Transaction | null>;
    getTransactionsByCustomer(customer: string): Promise<Array<Transaction>>;
    getTransactionsByMonth(monthTimestamp: Time): Promise<Array<Transaction>>;
    updateProductStock(productId: bigint, newStock: bigint): Promise<void>;
    updateShopSettings(shopName: string, address: string, phoneNumber: string, thankYouMessage: string): Promise<void>;
    uploadLogo(file: ExternalBlob): Promise<void>;
}
