import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { COLORS, SPACING } from "@/lib/constants";
import { apiClient } from "@/services/api";

interface ProjectDashboard {
  project: { name: string; location_name?: string | null };
  total_budget: number;
  actual_cost_to_date: number;
  budget_used_pct: number;
  task_count: number;
  completed_tasks: number;
  delayed_tasks: number;
  progress_pct: number;
  workers_count: number;
  today_attendance: number;
  open_alerts: number;
}

function formatLKR(val: number) {
  if (val >= 1_000_000) return `LKR ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `LKR ${(val / 1_000).toFixed(0)}K`;
  return `LKR ${val.toFixed(0)}`;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: accent }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

const QUICK_ACTIONS = [
  { label: "View Schedule", route: "/(tabs)/tasks" },
  { label: "Scan Material", route: "/(tabs)/scan"  },
  { label: "Attendance",    route: "/(tabs)/attendance" },
  { label: "Alerts",        route: "/(tabs)/alerts" },
];

export default function HomeScreen() {
  // Fetch first project
  const { data: projects } = useQuery({
    queryKey: ["mobile-projects"],
    queryFn: () => apiClient.get<Array<{ id: number; name: string }>>("/projects").then(r => r.data),
  });
  const projectId = projects?.[0]?.id;

  const { data: dash, isLoading } = useQuery({
    queryKey: ["mobile-dashboard", projectId],
    queryFn: () => apiClient.get<ProjectDashboard>(`/projects/${projectId}/dashboard`).then(r => r.data),
    enabled: !!projectId,
  });

  const kpis = dash
    ? [
        { label: "Schedule",   value: `${dash.progress_pct.toFixed(0)}%`, sub: `${dash.completed_tasks}/${dash.task_count} tasks`, accent: COLORS.primary },
        { label: "Budget Used", value: `${dash.budget_used_pct.toFixed(0)}%`, sub: `${formatLKR(dash.actual_cost_to_date)} of ${formatLKR(dash.total_budget)}`, accent: COLORS.success },
        { label: "Alerts",     value: String(dash.open_alerts),           sub: "open alerts",                        accent: COLORS.danger  },
        { label: "Attendance", value: `${dash.today_attendance}/${dash.workers_count}`, sub: "today",                accent: COLORS.warning },
      ]
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Heading */}
      <View style={styles.heading}>
        <Text style={styles.projectName}>
          {dash?.project.name ?? projects?.[0]?.name ?? "ConstructAI"}
        </Text>
        <Text style={styles.projectSub}>{dash?.project.location_name ?? ""}</Text>
      </View>

      {/* KPI grid */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      ) : (
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </View>
      )}

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.actionBtn}
            activeOpacity={0.8}
            onPress={() => router.push(a.route as never)}
          >
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Delayed tasks warning */}
      {dash && dash.delayed_tasks > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠ {dash.delayed_tasks} task{dash.delayed_tasks !== 1 ? "s" : ""} are delayed — review schedule
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  content:      { padding: SPACING.md, paddingBottom: SPACING.xl },
  heading:      { marginBottom: SPACING.md },
  projectName:  { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  projectSub:   { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  loadingBox:   { alignItems: "center", paddingVertical: 32, gap: 8 },
  loadingText:  { fontSize: 13, color: COLORS.textMuted },
  kpiGrid:      { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiLabel:     { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue:     { fontSize: 22, fontWeight: "700", marginTop: 4 },
  kpiSub:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary, marginBottom: SPACING.sm },
  actionsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  actionBtn: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionText:   { color: "#fff", fontWeight: "600", fontSize: 14 },
  warningBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  warningText:  { fontSize: 13, color: "#92400e", fontWeight: "500" },
});
