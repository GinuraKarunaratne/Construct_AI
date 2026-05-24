"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { materialsApi, TransactionCreate } from "@/services/materials";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";

const TXN_TYPES = ["delivery", "issue", "return", "wastage", "adjustment"] as const;

export default function MaterialsPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [txnModal, setTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState<TransactionCreate>({
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

  const lowStockItems = (materials ?? []).filter((m) => m.is_low_stock);
  const selectedMaterial = materials?.find((m) => m.id === selectedMaterialId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Materials</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {materials?.length ?? 0} items · {lowStockItems.length} low stock
          </p>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""}{" "}
              below reorder level
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((m) => (
              <span
                key={m.id}
                className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium"
              >
                {m.name} — {m.current_stock.toFixed(0)} {m.unit} remaining
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Inventory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Material</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Category</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Current Stock</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Reorder Level</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Unit Cost</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {(materials ?? []).map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.unit}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-semibold ${
                        m.is_low_stock ? "text-red-600" : "text-slate-800"
                      }`}
                    >
                      {m.current_stock.toFixed(0)}
                    </span>
                    <span className="text-slate-400 ml-1">{m.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {m.reorder_level} {m.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatCurrency(m.unit_cost_estimate)}
                  </td>
                  <td className="px-4 py-3">
                    {m.is_low_stock ? (
                      <Badge label="Low Stock" variant="critical" />
                    ) : (
                      <Badge label="In Stock" variant="success" />
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openTxn(m.id)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                    >
                      + Transaction
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      {transactions && transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">
              Recent Transactions
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Supplier</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Ref</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 15).map((tx) => {
                  const mat = materials?.find((m) => m.id === tx.material_item_id);
                  return (
                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-600">{tx.transaction_date}</td>
                      <td className="px-4 py-2.5">
                        <Badge label={tx.transaction_type} variant={tx.transaction_type === "delivery" ? "success" : tx.transaction_type === "issue" ? "info" : "default"} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {tx.transaction_type === "issue" || tx.transaction_type === "wastage"
                          ? `-${tx.quantity}`
                          : `+${tx.quantity}`}{" "}
                        <span className="text-slate-400 font-normal">{mat?.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{tx.supplier_name ?? "—"}</td>
                      <td className="px-5 py-2.5 text-slate-500 font-mono text-xs">{tx.reference_no ?? "—"}</td>
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
        title={`Record Transaction — ${selectedMaterial?.name ?? ""}`}
      >
        <form onSubmit={handleTxnSubmit} className="space-y-4">
          {txnErr && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {txnErr}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Transaction Type *
            </label>
            <select
              required
              value={txnForm.transaction_type}
              onChange={(e) =>
                setTxnForm((f) => ({
                  ...f,
                  transaction_type: e.target.value as typeof txnForm.transaction_type,
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TXN_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unit Cost (LKR)
              </label>
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={txnForm.transaction_date}
              onChange={(e) =>
                setTxnForm((f) => ({ ...f, transaction_date: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Supplier
              </label>
              <input
                value={txnForm.supplier_name ?? ""}
                onChange={(e) =>
                  setTxnForm((f) => ({ ...f, supplier_name: e.target.value }))
                }
                placeholder="Supplier name"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reference No
              </label>
              <input
                value={txnForm.reference_no ?? ""}
                onChange={(e) =>
                  setTxnForm((f) => ({ ...f, reference_no: e.target.value }))
                }
                placeholder="REF-001"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTxnModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addTxn.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
            >
              {addTxn.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Save Transaction
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
