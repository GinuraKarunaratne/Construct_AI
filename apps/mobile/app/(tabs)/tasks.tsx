import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { COLORS, SPACING } from "@/lib/constants";
import { apiClient } from "@/services/api";

interface Task {
  id: number;
  name: string;
  status: string;
  progress_percentage: number;
  planned_end_date?: string | null;
  priority: string;
  is_weather_sensitive: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  not_started: COLORS.textMuted,
  in_progress: COLORS.primary,
  completed:   COLORS.success,
  delayed:     COLORS.danger,
};

export default function TasksScreen() {
  const { data: projects } = useQuery({
    queryKey: ["mobile-projects"],
    queryFn: () => apiClient.get<Array<{ id: number }>>("/projects").then(r => r.data),
  });
  const projectId = projects?.[0]?.id;

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["mobile-tasks", projectId],
    queryFn: () => apiClient.get<Task[]>(`/projects/${projectId}/tasks`).then(r => r.data),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading tasks…</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={tasks ?? []}
      keyExtractor={(t) => String(t.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {tasks?.length ?? 0} tasks
          </Text>
          <Text style={styles.headerSub}>
            {tasks?.filter(t => t.status === "delayed").length ?? 0} delayed
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const color = STATUS_COLOR[item.status] ?? COLORS.textMuted;
        return (
          <TouchableOpacity style={styles.card} activeOpacity={0.8}>
            <View style={styles.cardRow}>
              <Text style={styles.taskName} numberOfLines={1}>
                {item.name}
                {item.is_weather_sensitive ? " 🌧" : ""}
              </Text>
              <View style={[styles.badge, { backgroundColor: color + "22" }]}>
                <Text style={[styles.badgeText, { color }]}>
                  {item.status.replace(/_/g, " ")}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${item.progress_percentage}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {item.progress_percentage}%
              {item.planned_end_date ? ` · Due ${item.planned_end_date}` : ""}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  loadingText:  { fontSize: 13, color: COLORS.textMuted },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  headerTitle:  { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  headerSub:    { fontSize: 13, color: COLORS.danger },
  list:         { padding: SPACING.md, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  taskName:      { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:     { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  progressTrack: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: "100%", borderRadius: 2 },
  progressLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 5 },
});
