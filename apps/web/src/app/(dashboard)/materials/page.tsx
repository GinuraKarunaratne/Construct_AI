"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { materialsApi, TransactionCreate } from "@/services/materials";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, getStockStatus, STOCK_STATUS_META } from "@/lib/utils";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const TXN_TYPES = ["delivery", "issue", "return", "wastage", "adjustment"] as const;

export default function MaterialsPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [txnModal, setTxnModal]   = useState(false);
  const [txnForm, setTxnForm]     = useState<TransactionCreate>({
    transaction_type: "delivery",
    quantity: 0,
    unit_cost: undefined,
    supplier_name: "",
    reference_no: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [txnErr, setTxnErr] = useState<string | null>(null);

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials", projectId],
    queryFn: () => materialsApi.list(projectId!),
    enabled: !!projectId,
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", projectId],
    queryFn: () => materialsApi.transactions(projectId!),
    enabled: !!projectId,
  });

  const addTxn = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TransactionCreate }) =>
      materialsApi.addTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", projectId] });
      qc.invalidateQueries({ queryKey: ["transactions", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard", projectId] });
      setTxnModal(false);
      setTxnErr(null);
    },
    onError: (e: unknown) => {
      setTxnErr(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Transaction failed"
      );
    },
  });

  function openTxn(materialId: number) {
    setSelectedMaterialId(materialId);
    setTxnErr(null);
    setTxnForm({
      transaction_type: "delivery",
      quantity: 0,
      unit_cost: undefined,
      supplier_name: "",
      reference_no: "",
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setTxnModal(true);
  }

  function handleTxnSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedMaterialId) return;
    setTxnErr(null);
    addTxn.mutate({ id: selectedMaterialId, data: txnForm });
  }

  if (projLoading || isLoading) return <LoadingSpinner message="Loading materials…" />;

  const selectedMaterial = materials?.find((m) => m.id === selectedMaterialId);

  // Compute stock status for every material
  const materialsWithStatus = (materials ?? []).map((m) => ({
    ...m,
    stockStatus: getStockStatus(m.current_stock, m.reorder_level),
  }));

  // Items needing attention — sorted: out_of_stock first, then low_stock, then at_reorder
  const URGENCY_ORDER: Record<string, number> = {
    out_of_stock: 0,
    low_stock:    1,
    at_reorder:   2,
    in_stock:     99,
  };
  const urgentItems = materialsWithStatus
    .filter((m) => m.stockStatus !== "in_stock")
    .sort((a, b) => URGENCY_ORDER[a.stockStatus] - URGENCY_ORDER[b.stockStatus]);

  const filteredMaterials = materialsWithStatus.filter((m) => {
    const q = materialSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || (m.category ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Materials</h1>
          <p className="page-subtitle">
            {materials?.length ?? 0} items &middot; {urgentItems.length} need attention
          </p>
        </div>
      </div>

      {/* Stock attention banner */}
      {urgentItems.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {urgentItems.filter((m) => m.stockStatus === "out_of_stock").length > 0 && (
                <span className="text-red-700">
                  {urgentItems.filter((m) => m.stockStatus === "out_of_stock").length} out of stock ·{" "}
                </span>
              )}
              {urgentItems.filter((m) => m.stockStatus === "low_stock").length > 0 && (
                <span>
                  {urgentItems.filter((m) => m.stockStatus === "low_stock").length} low stock ·{" "}
                </span>
              )}
              {urgentItems.filter((m) => m.stockStatus === "at_reorder").length > 0 && (
                <span className="text-amber-700">
                  {urgentItems.filter((m) => m.stockStatus === "at_reorder").length} at reorder level
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {urgentItems.map((m) => {
                const meta = STOCK_STATUS_META[m.stockStatus];
                return (
                  <span
                    key={m.id}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold border",
                      meta.chipClass
                    )}
                  >
                    {m.name} — {m.current_stock <= 0 ? "0" : m.current_stock.toFixed(0)} {m.unit}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Inventory table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Inventory</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search materials…"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <span className="text-xs text-stone-400 whitespace-nowrap">
              {filteredMaterials.length} items
            </span>
          </div>
        </div>
        {materialsWithStatus.length === 0 ? (
          <EmptyState title="No materials found" description="Add materials to start tracking inventory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Category</th>
                  <th className="th-right">Stock</th>
                  <th className="th-right">Reorder At</th>
                  <th className="th-right">Unit Cost</th>
                  <th>Status</th>
                  <th className="th-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((m) => {
                  const meta = STOCK_STATUS_META[m.stockStatus];
                  const isUrgent = m.stockStatus === "out_of_stock" || m.stockStatus === "low_stock";
                  return (
                    <tr key={m.id}>
                      <td>
                        <p className={cn("font-semibold", isUrgent ? "text-red-700" : "text-stone-800")}>
                          {m.name}
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">{m.unit}</p>
                      </td>
                      <td className="text-stone-500">{m.category ?? "—"}</td>
                      <td className="td-right">
                        <span className={cn(
                          "font-bold tabular-nums",
                          m.stockStatus === "out_of_stock" ? "text-red-600"
                          : m.stockStatus === "low_stock"   ? "text-red-500"
                          : m.stockStatus === "at_reorder"  ? "text-amber-600"
                          : "text-stone-800"
                        )}>
                          {m.current_stock.toFixed(0)}
                        </span>
                        <span className="text-stone-400 ml-1 text-xs">{m.unit}</span>
                      </td>
                      <td className="td-right text-stone-500 tabular-nums">
                        {m.reorder_level} {m.unit}
                      </td>
                      <td className="td-right text-stone-600 tabular-nums">
                        {formatCurrency(m.unit_cost_estimate)}
                      </td>
                      <td>
                        <Badge label={meta.label} variant={meta.badgeVariant} />
                      </td>
                      <td className="td-right">
                        <button
                          onClick={() => openTxn(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-white hover:bg-brand-600 rounded-lg border border-brand-200 hover:border-brand-600 transition-colors duration-150"
                        >
                          <Plus className="w-3 h-3" strokeWidth={2.5} />
                          Update Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {transactions && transactions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Transactions</h2>
            <span className="text-xs text-stone-400">Last 15</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th className="th-right">Qty</th>
                  <th>Supplier</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 15).map((tx) => {
                  const mat = materials?.find((m) => m.id === tx.material_item_id);
                  const isOut = tx.transaction_type === "issue" || tx.transaction_type === "wastage";
                  return (
                    <tr key={tx.id}>
                      <td className="text-stone-500 tabular-nums">{tx.transaction_date}</td>
                      <td className="font-medium text-stone-800">{mat?.name ?? "—"}</td>
                      <td>
                        <Badge
                          label={tx.transaction_type}
                          variant={
                            tx.transaction_type === "delivery" ? "success"
                            : tx.transaction_type === "issue"   ? "info"
                            : tx.transaction_type === "wastage" ? "critical"
                            : "default"
                          }
                        />
                      </td>
                      <td className="td-right tabular-nums">
                        <span className={isOut ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                          {isOut ? "−" : "+"}{tx.quantity}
                        </span>
                        <span className="text-stone-400 ml-1 text-xs font-normal">{mat?.unit}</span>
                      </td>
                      <td className="text-stone-500">{tx.supplier_name ?? "—"}</td>
                      <td className="font-mono text-xs text-stone-400">{tx.reference_no ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      <Modal
        open={txnModal}
        onClose={() => setTxnModal(false)}
        title={`Update Stock — ${selectedMaterial?.name ?? ""}`}
      >
        <form onSubmit={handleTxnSubmit} className="space-y-4">
          {txnErr && (
            <div role="alert" className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              {txnErr}
            </div>
          )}
          <div>
            <label className="form-label">Transaction Type *</label>
            <select
              required
              value={txnForm.transaction_type}
              onChange={(e) =>
                setTxnForm((f) => ({
                  ...f,
                  transaction_type: e.target.value as typeof txnForm.transaction_type,
                }))
              }
              className="form-input"
            >
              {TXN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "delivery"   ? "Stock Received (Delivery)"
                  : t === "issue"     ? "Stock Used (Issue)"
                  : t === "return"    ? "Stock Returned"
                  : t === "wastage"   ? "Damaged / Wasted"
                  : "Stock Correction (Adjustment)"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">
                Quantity ({selectedMaterial?.unit}) *
              </label>
              <input
                type="number"
                required
                min={0.01}
                step="any"
                value={txnForm.quantity || ""}
                onChange={(e) =>
                  setTxnForm((f) => ({ ...f, quantity: Number(e.target.value) }))
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Unit Cost (LKR)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={txnForm.unit_cost ?? ""}
                onChange={(e) =>
                  setTxnForm((f) => ({
                    ...f,
                    unit_cost: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="form-input"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Date *</label>
            <input
              type="date"
              required
              value={txnForm.transaction_date}
              onChange={(e) =>
                setTxnForm((f) => ({ ...f, transaction_date: e.target.value }))
              }
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Supplier</label>
              <input
                value={txnForm.supplier_name ?? ""}
                onChange={(e) =>
                  setTxnForm((f) => ({ ...f, supplier_name: e.target.value }))
                }
                placeholder="Supplier name"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Reference No</label>
              <input
                value={txnForm.reference_no ?? ""}
                onChange={(e) =>
                  setTxnForm((f) => ({ ...f, reference_no: e.target.value }))
                }
                placeholder="REF-001"
                className="form-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setTxnModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addTxn.isPending}
              className="btn-primary"
            >
              {addTxn.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
