import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "LKR"): string {
  return `${currency} ${amount.toLocaleString("en-LK")}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Compact currency: LKR 13.99M / LKR 530K / LKR 8,200 */
export function formatCompact(amount: number, currency = "LKR"): string {
  if (Math.abs(amount) >= 1_000_000)
    return `${currency} ${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000)
    return `${currency} ${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount, currency);
}

/** Stock status from current + reorder level */
export type StockStatus = "out_of_stock" | "low_stock" | "at_reorder" | "in_stock";
export function getStockStatus(current: number, reorder: number): StockStatus {
  if (current <= 0)       return "out_of_stock";
  if (current < reorder)  return "low_stock";
  if (current === reorder) return "at_reorder";
  return "in_stock";
}

export const STOCK_STATUS_META: Record<StockStatus, { label: string; badgeVariant: string; chipClass: string }> = {
  out_of_stock: {
    label:        "Out of Stock",
    badgeVariant: "critical",
    chipClass:    "bg-red-100 text-red-800 border-red-200",
  },
  low_stock: {
    label:        "Low Stock",
    badgeVariant: "critical",
    chipClass:    "bg-red-50 text-red-700 border-red-200",
  },
  at_reorder: {
    label:        "Reorder Now",
    badgeVariant: "warning",
    chipClass:    "bg-amber-100 text-amber-800 border-amber-200",
  },
  in_stock: {
    label:        "In Stock",
    badgeVariant: "success",
    chipClass:    "bg-green-50 text-green-700 border-green-200",
  },
};
