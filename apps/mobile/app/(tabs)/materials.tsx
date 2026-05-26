/**
 * ConstructAI Mobile — Materials Stock Check Screen
 * ==================================================
 * Shows current stock levels for all materials on the selected project.
 * Highlights low-stock items with a red badge.
 * Lets field workers log a quick stock transaction (delivery / issue / return).
 *
 * API:
 *   GET  /projects/{id}/materials              → list of MaterialStockOut
 *   GET  /projects/{id}/materials/low-stock    → low-stock items only
 *   POST /materials/{material_id}/transactions → log a transaction
 */

import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Pressable, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { useProject } from "@/context/ProjectContext";
import { COLORS, SPACING } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MaterialStockOut {
  id: number;
  name: string;
  category?: string | null;
  unit: string;
  estimated_quantity: number;
  reorder_level: number;
  unit_cost_estimate: number;
  current_stock: number;
  is_low_stock: boolean;
}

interface TransactionCreate {
  transaction_type: string;
  quantity: number;
  unit_cost?: number;
  notes?: string;
  transaction_date: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const TX_TYPES = [
  { label: "Delivery (in)",  value: "delivery" },
  { label: "Issue (out)",    value: "issue"    },
  { label: "Return",         value: "return"   },
  { label: "Wastage",        value: "wastage"  },
];

// ─── Small components ─────────────────────────────────────────────────────────
function StockBar({ current, estimated }: { current: number; estimated: number }) {
  const pct = estimated > 0 ? Math.min(current / estimated, 1) : 0;
  const barColor = pct < 0.25 ? COLORS.danger : pct < 0.5 ? COLORS.warning : COLORS.success;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${(pct * 100).toFixed(0)}%` as `${number}%`, backgroundColor: barColor }]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, overflow: "hidden", marginTop: 4 },
  fill:  { height: "100%", borderRadius: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MaterialsScreen() {
  const { selectedProjectId: projectId } = useProject();
  const qc = useQueryClient();

  const [filterLow, setFilterLow] = useState(false);
  const [txMaterial, setTxMaterial] = useState<MaterialStockOut | null>(null);
  const [txType, setTxType]         = useState("delivery");
  const [txQty, setTxQty]           = useState("");
  const [txDate, setTxDate]         = useState(todayISO());
  const [txNotes, setTxNotes]       = useState("");
  const [txPickerOpen, setTxPickerOpen] = useState(false);

  const { data: materials, isLoading } = useQuery<MaterialStockOut[]>({
    queryKey: ["mobile-materials", projectId, filterLow],
    queryFn: () => {
      const path = filterLow
        ? `/projects/${projectId}/materials/low-stock`
        : `/projects/${projectId}/materials`;
      return apiClient.get<MaterialStockOut[]>(path).then((r) => r.data);
    },
    enabled: !!projectId,
  });

  const logTx = useMutation({
    mutationFn: ({ matId, body }: { matId: number; body: TransactionCreate }) =>
      apiClient.post(`/materials/${matId}/transactions`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mobile-materials", projectId] });
      setTxMaterial(null);
      resetTxForm();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Alert.alert("Error", detail ?? "Failed to log transaction. Please try again.");
    },
  });

  function resetTxForm() {
    setTxType("delivery");
    setTxQty("");
    setTxDate(todayISO());
    setTxNotes("");
  }

  function handleTxSubmit() {
    if (!txMaterial) return;
    const qty = parseFloat(txQty);
    if (!txQty || isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Please enter a positive quantity.");
      return;
    }
    logTx.mutate({
      matId: txMaterial.id,
      body: {
        transaction_type: txType,
        quantity: qty,
        notes: txNotes.trim() || undefined,
        transaction_date: txDate,
      },
    });
  }

  const lowCount = (materials ?? []).filter((m) => m.is_low_stock).length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Summary / filter row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.statsText}>
              {(materials ?? []).length} material{(materials ?? []).length !== 1 ? "s" : ""}
              {lowCount > 0 && (
                <Text style={{ color: COLORS.danger }}>  ·  {lowCount} low stock</Text>
              )}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, filterLow && styles.filterBtnActive]}
            onPress={() => setFilterLow(!filterLow)}
          >
            <Text style={[styles.filterText, filterLow && styles.filterTextActive]}>
              {filterLow ? "⚠ Low Stock" : "All Materials"}
            </Text>
          </TouchableOpacity>
        </View>

        {!projectId ? (
          <Text style={styles.empty}>Select a project first.</Text>
        ) : isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : (materials ?? []).length === 0 ? (
          <Text style={styles.empty}>
            {filterLow ? "No low-stock materials." : "No materials found for this project."}
          </Text>
        ) : (
          (materials ?? []).map((mat) => (
            <View
              key={mat.id}
              style={[styles.matCard, mat.is_low_stock && styles.matCardLow]}
            >
              <View style={styles.matHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matName}>{mat.name}</Text>
                  {mat.category ? (
                    <Text style={styles.matCat}>{mat.category}</Text>
                  ) : null}
                </View>
                {mat.is_low_stock && (
                  <View style={styles.lowBadge}>
                    <Text style={styles.lowBadgeText}>Low Stock</Text>
                  </View>
                )}
              </View>

              {/* Stock bar */}
              <StockBar current={mat.current_stock} estimated={mat.estimated_quantity} />

              <View style={styles.matStats}>
                <Text style={styles.matStatLabel}>Current</Text>
                <Text style={[styles.matStatValue, mat.is_low_stock && { color: COLORS.danger }]}>
                  {mat.current_stock.toFixed(1)} {mat.unit}
                </Text>
                <Text style={styles.matStatLabel}>Reorder at</Text>
                <Text style={styles.matStatValue}>{mat.reorder_level.toFixed(1)} {mat.unit}</Text>
                <Text style={styles.matStatLabel}>Estimated</Text>
                <Text style={styles.matStatValue}>{mat.estimated_quantity.toFixed(1)} {mat.unit}</Text>
              </View>

              {/* Log transaction button */}
              <TouchableOpacity
                style={styles.txBtn}
                activeOpacity={0.8}
                onPress={() => { resetTxForm(); setTxMaterial(mat); }}
              >
                <Text style={styles.txBtnText}>Log Transaction</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Log Transaction modal */}
      <Modal
        visible={!!txMaterial}
        animationType="slide"
        transparent
        onRequestClose={() => setTxMaterial(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTxMaterial(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Log Transaction</Text>
            {txMaterial && (
              <Text style={styles.modalSub}>{txMaterial.name} · current: {txMaterial.current_stock.toFixed(1)} {txMaterial.unit}</Text>
            )}

            {/* Transaction type */}
            <Text style={styles.fieldLabel}>Type</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setTxPickerOpen(!txPickerOpen)}
            >
              <Text style={styles.pickerBtnText}>
                {TX_TYPES.find((t) => t.value === txType)?.label ?? txType}
              </Text>
              <Text style={styles.pickerArrow}>{txPickerOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {txPickerOpen && (
              <View style={styles.pickerDropdown}>
                {TX_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.pickerOption, t.value === txType && styles.pickerOptionActive]}
                    onPress={() => { setTxType(t.value); setTxPickerOpen(false); }}
                  >
                    <Text style={[styles.pickerOptionText, t.value === txType && styles.pickerOptionTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quantity */}
            <Text style={styles.fieldLabel}>Quantity ({txMaterial?.unit ?? "units"}) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 50"
              placeholderTextColor={COLORS.textMuted}
              value={txQty}
              onChangeText={setTxQty}
            />

            {/* Date */}
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-06-01"
              placeholderTextColor={COLORS.textMuted}
              value={txDate}
              onChangeText={setTxDate}
              maxLength={10}
            />

            {/* Notes */}
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              placeholder="Supplier, reference, etc."
              placeholderTextColor={COLORS.textMuted}
              value={txNotes}
              onChangeText={setTxNotes}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTxMaterial(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, logTx.isPending && styles.submitBtnDisabled]}
                onPress={handleTxSubmit}
                disabled={logTx.isPending}
              >
                {logTx.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  content:     { padding: SPACING.md, paddingBottom: SPACING.xl },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  statsText:   { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  filterBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: "#fef3c7", borderColor: COLORS.warning },
  filterText:      { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  filterTextActive:{ color: "#92400e" },

  empty:       { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginTop: 40 },

  matCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  matCardLow:  { borderColor: COLORS.danger, borderWidth: 1.5 },
  matHeader:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  matName:     { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  matCat:      { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  lowBadge: {
    backgroundColor: "#fee2e2",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  lowBadgeText:{ fontSize: 10, fontWeight: "700", color: COLORS.danger },

  matStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: "center",
  },
  matStatLabel:{ fontSize: 10, color: COLORS.textMuted, marginRight: 2 },
  matStatValue:{ fontSize: 12, fontWeight: "600", color: COLORS.textPrimary, marginRight: SPACING.sm },

  txBtn: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
  },
  txBtnText:   { fontSize: 13, fontWeight: "600", color: COLORS.primary },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  modalTitle:   { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 2 },
  modalSub:     { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  fieldLabel:   { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerBtnText:       { fontSize: 14, color: COLORS.textPrimary },
  pickerArrow:         { fontSize: 12, color: COLORS.textMuted },
  pickerDropdown: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    overflow: "hidden",
  },
  pickerOption:        { paddingHorizontal: 12, paddingVertical: 10 },
  pickerOptionActive:  { backgroundColor: COLORS.primary + "15" },
  pickerOptionText:    { fontSize: 14, color: COLORS.textPrimary },
  pickerOptionTextActive: { fontWeight: "700", color: COLORS.primary },

  modalActions:        { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelText:          { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  submitBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitBtnDisabled:   { opacity: 0.6 },
  submitText:          { fontSize: 14, fontWeight: "700", color: "#fff" },
});
