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
export type Time = bigint;
export interface WorkOrder {
    id: string;
    customerName: string;
    status: WorkOrderStatus;
    technician: string;
    vehicles: Array<string>;
    dateOut?: bigint;
    dateIn: bigint;
    customerPhone: string;
    repairAction: string;
    problemDescription: string;
    workOrderNumber: string;
}
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
export interface Transaction {
    id: bigint;
    customerName: string;
    vehicleInfo: string;
    total: bigint;
    customerPhone: string;
    timestamp: Time;
    items: Array<TransactionItem>;
}
export interface InventoryItem {
    id: string;
    purchasePrice: bigint;
    kind: ItemKind;
    name: string;
    sellingPrice: bigint;
    quantity?: bigint;
}
export interface DailyReport {
    day: Time;
    totalRevenue: bigint;
    transactionCount: bigint;
}
export interface UserProfile {
    name: string;
}
export enum ItemKind {
    service = "service",
    goods = "goods"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum WorkOrderStatus {
    cancelled = "cancelled",
    pending = "pending",
    done = "done",
    inProgress = "inProgress"
}
export interface backendInterface {
    addCustomer(customer: string): Promise<void>;
    addInventoryItem(id: string, name: string, sellingPrice: bigint, purchasePrice: bigint, quantity: bigint | null, kind: ItemKind): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    calculateProfitLoss(startTime: Time, endTime: Time): Promise<bigint>;
    createTransaction(items: Array<TransactionItem>, total: bigint, customerName: string, customerPhone: string, vehicleInfo: string): Promise<bigint>;
    createWorkOrder(customerName: string, customerPhone: string, vehicles: Array<string>, dateIn: bigint, problemDescription: string, repairAction: string, technician: string): Promise<WorkOrder>;
    deleteCustomer(customer: string): Promise<void>;
    deleteInventoryItem(id: string): Promise<void>;
    deleteWorkOrder(id: string): Promise<void>;
    getAllCustomers(): Promise<Array<string>>;
    getAllInventoryItems(): Promise<Array<InventoryItem>>;
    getAllTransactions(): Promise<Array<Transaction>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getDailyReport(day: Time): Promise<DailyReport>;
    getInventoryItem(id: string): Promise<InventoryItem | null>;
    getMonthlyReport(month: Time): Promise<MonthlyReport>;
    getPersistentSettings(): Promise<ShopSettings | null>;
    getTopSellingItems(count: bigint): Promise<Array<[string, bigint]>>;
    getTransaction(id: bigint): Promise<Transaction | null>;
    getTransactionsByCustomer(customer: string): Promise<Array<Transaction>>;
    getTransactionsByMonth(monthTimestamp: Time): Promise<Array<Transaction>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getWorkOrder(id: string): Promise<WorkOrder | null>;
    isCallerAdmin(): Promise<boolean>;
    listWorkOrders(): Promise<Array<WorkOrder>>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateAllItems(items: Array<InventoryItem>): Promise<void>;
    updateInventoryItemQuantity(itemId: string, newQuantity: bigint): Promise<void>;
    updatePersistentSettings(shopName: string, address: string, phoneNumber: string, thankYouMessage: string): Promise<void>;
    updateWorkOrder(workOrder: WorkOrder): Promise<void>;
    uploadLogo(file: ExternalBlob): Promise<void>;
}
