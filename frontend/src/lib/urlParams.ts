// Utility for passing data between pages via sessionStorage

const SESSION_KEY = 'workOrderNavData';

export interface WorkOrderNavData {
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  workOrderId?: string;
}

export function storeWorkOrderNavData(data: WorkOrderNavData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function readWorkOrderNavData(): WorkOrderNavData | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkOrderNavData;
  } catch {
    return null;
  }
}

export function clearWorkOrderNavData(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
