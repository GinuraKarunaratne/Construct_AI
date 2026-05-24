import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, SPACING } from "@/lib/constants";
import { apiClient } from "@/services/api";

interface Worker { id: number; full_name: string; skill_type: string; worker_code: string; }
interface AttRecord { id: number; worker_id: number; status: string; attendance_date: string; }

const today = new Date().toISOString().slice(0, 10);

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  present:  { bg: "#d1fae5", text: COLORS.success, label: "Present" },
  absent:   { bg: "#fee2e2", text: COLORS.danger,  label: "Absent"  },
  half_day: { bg: "#fef3c7", text: COLORS.warning, label: "Half Day" },
};

export default function AttendanceScreen() {
  const qc = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ["mobile-projects"],
    queryFn: () => apiClient.get<Array<{ id: number }>>("/projects").then(r => r.data),
  });
  const projectId = projects?.[0]?.id;

  const { data: workers, isLoading: wLoading } = useQuery({
    queryKey: ["mobile-workers", projectId],
    queryFn: () => apiClient.get<Worker[]>(`/projects/${projectId}/workers`).then(r => r.data),
    enabled: !!projectId,
  });

  const { data: attendance, isLoading: aLoading } = useQuery({
    queryKey: ["mobile-attendance", projectId, today],
    queryFn: () =>
      apiClient
        .get<AttRecord[]>(`/projects/${projectId}/attendance?attendance_date=${today}`)
        .then(r => r.data),
    enabled: !!projectId,
  });

  const mark = useMutation({
    mutationFn: ({ workerId, status }: { workerId: number; status: string }) =>
      apiClient.post(`/projects/${projectId}/attendance/manual`, {
        worker_id: workerId,
        attendance_date: today,
        status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mobile-attendance", projectId, today] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to record attendance";
      Alert.alert("Error", msg);
    },
  });

  const attMap = new Map((attendance ?? []).map(a => [a.worker_id, a]));
  const isLoading = wLoading || aLoading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{new Date().toDateString()}</Text>
        <Text style={styles.summary}>
          {[...attMap.values()].filter(a => a.status === "present").length}/{workers?.length ?? 0} present
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={workers ?? []}
          keyExtractor={(w) => String(w.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const att = attMap.get(item.id);
            const s = att ? STATUS_STYLE[att.status] : null;
            return (
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.full_name.charAt(0)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.full_name}</Text>
                  <Text style={styles.role}>{item.skill_type}</Text>
                </View>
                {s ? (
                  <View style={[styles.badge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
                  </View>
                ) : (
                  <View style={styles.markRow}>
                    <TouchableOpacity
                      style={[styles.markBtn, { backgroundColor: COLORS.success }]}
                      onPress={() => mark.mutate({ workerId: item.id, status: "present" })}
                      disabled={mark.isPending}
                    >
                      <Text style={styles.markBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.markBtn, { backgroundColor: COLORS.danger }]}
                      onPress={() => mark.mutate({ workerId: item.id, status: "absent" })}
                      disabled={mark.isPending}
                    >
                      <Text style={styles.markBtnText}>✗</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  date:        { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  summary:     { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  list:        { padding: SPACING.md, gap: SPACING.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + "22", alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  info:        { flex: 1, marginLeft: SPACING.sm },
  name:        { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  role:        { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText:   { fontSize: 12, fontWeight: "600" },
  markRow:     { flexDirection: "row", gap: 6 },
  markBtn:     { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  markBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
