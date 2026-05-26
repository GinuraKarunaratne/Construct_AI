/**
 * ConstructAI Mobile — Expense Logging Screen
 * ============================================
 * Lets on-site staff record expenses directly from the field.
 * Shows a rolling list of recent expenses and a quick-log form.
 *
 * API:
 *   GET  /projects/{id}/expenses            → list of ExpenseOut
 *   POST /projects/{id}/expenses            → create ExpenseOut
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
interface ExpenseOut {
  id: number;
  category: string;
  description?: string | null;
  amount: number;
  expense_date: string;
}

interface ExpenseCreate {
  category: string;
  description?: string;
  amount: number;
  expense_date: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatLKR(v: number) {
  if (v >= 1_000_000) return `LKR ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `LKR ${(v / 1_000).toFixed(1)}K`;
  return `LKR ${v.toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const CATEGORIES = [
  "Labour", "Materials", "Equipment", "Transport",
  "Subcontractor", "Utilities", "Other",
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CostsScreen() {
  const { selectedProjectId: projectId } = useProject();
  const qc = useQueryClient();

  // Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  // Data
  const { data: expenses, isLoading } = useQuery<ExpenseOut[]>({
    queryKey: ["mobile-expenses", projectId],
    queryFn: () =>
      apiClient.get<ExpenseOut[]>(`/projects/${projectId}/expenses`).then((r) => r.data),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: (body: ExpenseCreate) =>
      apiClient.post<ExpenseOut>(`/projects/${projectId}/expenses`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mobile-expenses", projectId] });
      qc.invalidateQueries({ queryKey: ["mobile-dashboard", projectId] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Alert.alert("Error", detail ?? "Failed to log expense. Please try again.");
    },
  });

  function resetForm() {
    setCategory(CATEGORIES[0]);
    setDescription("");
    setAmount("");
    setExpenseDate(todayISO());
  }

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid amount", "Please enter a positive expense amount.");
      return;
    }
    if (!expenseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Invalid date", "Date must be in YYYY-MM-DD format.");
      return;
    }
    create.mutate({
      category,
      description: description.trim() || undefined,
      amount: amt,
      expense_date: expenseDate,
    });
  }

  const totalSpend = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Summary chip */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Logged</Text>
            <Text style={styles.summaryValue}>{formatLKR(totalSpend)}</Text>
            <Text style={styles.summaryMeta}>{(expenses ?? []).length} expense{expenses?.length !== 1 ? "s" : ""}</Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => { resetForm(); setModalOpen(true); }}
          >
            <Text style={styles.addBtnText}>+ Log Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Expense list */}
        <Text style={styles.sectionTitle}>Recent Expenses</Text>

        {!projectId ? (
          <Text style={styles.empty}>Select a project first.</Text>
        ) : isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : (expenses ?? []).length === 0 ? (
          <Text style={styles.empty}>No expenses logged yet. Tap "+ Log Expense" to get started.</Text>
        ) : (
          [...(expenses ?? [])].reverse().map((exp) => (
            <View key={exp.id} style={styles.expenseCard}>
              <View style={styles.expenseLeft}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{exp.category}</Text>
                </View>
                <Text style={styles.expenseDate}>{exp.expense_date}</Text>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>{formatLKR(exp.amount)}</Text>
                {exp.description ? (
                  <Text style={styles.expenseDesc} numberOfLines={1}>{exp.description}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Log Expense modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Log Expense</Text>

            {/* Category picker */}
            <Text style={styles.fieldLabel}>Category</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setCatPickerOpen(!catPickerOpen)}
            >
              <Text style={styles.pickerBtnText}>{category}</Text>
              <Text style={styles.pickerArrow}>{catPickerOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {catPickerOpen && (
              <View style={styles.pickerDropdown}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pickerOption, cat === category && styles.pickerOptionActive]}
                    onPress={() => { setCategory(cat); setCatPickerOpen(false); }}
                  >
                    <Text style={[styles.pickerOptionText, cat === category && styles.pickerOptionTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Amount */}
            <Text style={styles.fieldLabel}>Amount (LKR) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 15000"
              placeholderTextColor={COLORS.textMuted}
              value={amount}
              onChangeText={setAmount}
            />

            {/* Date */}
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-06-01"
              placeholderTextColor={COLORS.textMuted}
              value={expenseDate}
              onChangeText={setExpenseDate}
              maxLength={10}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: "top" }]}
              placeholder="e.g. Cement delivery from Holcim"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, create.isPending && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={create.isPending}
              >
                {create.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitText}>Save Expense</Text>
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
  container:       { flex: 1, backgroundColor: COLORS.background },
  content:         { padding: SPACING.md, paddingBottom: SPACING.xl },

  summaryRow:      { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md, alignItems: "center" },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel:    { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue:    { fontSize: 20, fontWeight: "700", color: COLORS.primary, marginTop: 4 },
  summaryMeta:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
  },
  addBtnText:      { color: "#fff", fontWeight: "700", fontSize: 13 },

  sectionTitle:    { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary, marginBottom: SPACING.sm },
  empty:           { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginTop: 40 },

  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  expenseLeft:     { gap: 4 },
  expenseRight:    { alignItems: "flex-end", flex: 1, marginLeft: SPACING.md },

  categoryBadge: {
    backgroundColor: COLORS.primary + "18",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  categoryText:    { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  expenseDate:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  expenseAmount:   { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  expenseDesc:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2, maxWidth: 180 },

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
  modalTitle:      { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary, marginBottom: SPACING.md },
  fieldLabel:      { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
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
  pickerBtnText:   { fontSize: 14, color: COLORS.textPrimary },
  pickerArrow:     { fontSize: 12, color: COLORS.textMuted },
  pickerDropdown: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    overflow: "hidden",
  },
  pickerOption:    { paddingHorizontal: 12, paddingVertical: 10 },
  pickerOptionActive: { backgroundColor: COLORS.primary + "15" },
  pickerOptionText:   { fontSize: 14, color: COLORS.textPrimary },
  pickerOptionTextActive: { fontWeight: "700", color: COLORS.primary },

  modalActions:    { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelText:      { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  submitBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { fontSize: 14, fontWeight: "700", color: "#fff" },
});
