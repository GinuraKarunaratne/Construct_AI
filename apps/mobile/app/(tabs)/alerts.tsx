import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, SPACING } from "@/lib/constants";
import { apiClient } from "@/services/api";
import { useProject } from "@/context/ProjectContext";

interface AlertItem {
  id: number;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  is_read: boolean;
  created_at?: string | null;
}

const SEVERITY_STYLE: Record<string, { dot: string; bg: string; text: string }> = {
  critical: { dot: COLORS.danger,  bg: "#fee2e2", text: "#991b1b" },
  warning:  { dot: COLORS.warning, bg: "#fef3c7", text: "#92400e" },
  info:     { dot: COLORS.primary, bg: "#dbeafe", text: "#1e40af" },
};

export default function AlertsScreen() {
  const qc = useQueryClient();
  const { selectedProjectId: projectId } = useProject();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["mobile-alerts", projectId],
    queryFn: () =>
      apiClient.get<AlertItem[]>(`/projects/${projectId}/alerts`).then(r => r.data),
    enabled: !!projectId,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (alertId: number) =>
      apiClient.patch(`/alerts/${alertId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mobile-alerts", projectId] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${projectId}/alerts/mark-all-read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mobile-alerts", projectId] });
    },
  });

  const unread = (alerts ?? []).filter(a => !a.is_read).length;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unread > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>{unread} unread alert{unread > 1 ? "s" : ""}</Text>
          <TouchableOpacity
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={alerts ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const s = SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.info;
          return (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.cardUnread]}
              activeOpacity={0.8}
              onPress={() => !item.is_read && markRead.mutate(item.id)}
            >
              <View style={[styles.dot, { backgroundColor: s.dot }]} />
              <View style={styles.body}>
                <View style={[styles.pill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.pillText, { color: s.text }]}>
                    {item.severity}
                  </Text>
                </View>
                <Text style={styles.alertTitle}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                {item.created_at && (
                  <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>✓ No alerts</Text>
            <Text style={styles.emptySubText}>All clear</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.danger, paddingVertical: 8, paddingHorizontal: SPACING.md },
  topBarText:   { color: "#fff", fontWeight: "600", fontSize: 13 },
  markAllText:  { color: "#fecaca", fontSize: 12, fontWeight: "500" },
  list:         { padding: SPACING.md, gap: SPACING.sm },
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardUnread:   { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  dot:          { width: 8, height: 8, borderRadius: 4, marginTop: 4, marginRight: SPACING.sm, flexShrink: 0 },
  body:         { flex: 1 },
  pill:         { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginBottom: 5 },
  pillText:     { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  alertTitle:   { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary, marginBottom: 3 },
  message:      { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  time:         { fontSize: 11, color: COLORS.textMuted, marginTop: 5 },
  emptyBox:     { alignItems: "center", paddingVertical: 60 },
  emptyText:    { fontSize: 18, fontWeight: "700", color: COLORS.success },
  emptySubText: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
});
