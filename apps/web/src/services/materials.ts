import { apiClient } from "./api";

export interface MaterialStockOut {
  id: number;
  project_id: number;
  name: string;
  category?: string | null;
  unit: string;
  estimated_quantity: number;
  reorder_level: number;
  unit_cost_estimate: number;
  current_stock: number;
  is_low_stock: boolean;
}

export interface TransactionOut {
  id: number;
  project_id: number;
  material_item_id: number;
  transaction_type: string;
  quantity: number;
  unit_cost?: number | null;
  supplier_name?: string | null;
  reference_no?: string | null;
  transaction_date: string;
  notes?: string | null;
}

export interface MaterialCreate {
  name: string;
  category?: string | null;
  unit?: string;
  estimated_quantity?: number;
  reorder_level?: number;
  unit_cost_estimate?: number;
}

export interface TransactionCreate {
  transaction_type: "delivery" | "issue" | "return" | "wastage" | "adjustment";
  quantity: number;
  unit_cost?: number;
  supplier_name?: string;
  reference_no?: string;
  transaction_date: string;
  notes?: string;
}

export const materialsApi = {
  list: (projectId: number) =>
    apiClient
      .get<MaterialStockOut[]>(`/projects/${projectId}/materials`)
      .then((r) => r.data),
  create: (projectId: number, data: MaterialCreate) =>
    apiClient
      .post<MaterialStockOut>(`/projects/${projectId}/materials`, data)
      .then((r) => r.data),
  lowStock: (projectId: number) =>
    apiClient
      .get<MaterialStockOut[]>(`/projects/${projectId}/materials/low-stock`)
      .then((r) => r.data),
  transactions: (projectId: number) =>
    apiClient
      .get<TransactionOut[]>(`/projects/${projectId}/materials/transactions`)
      .then((r) => r.data),
  addTransaction: (materialId: number, data: TransactionCreate) =>
    apiClient
      .post<TransactionOut>(`/materials/${materialId}/transactions`, data)
      .then((r) => r.data),
};
