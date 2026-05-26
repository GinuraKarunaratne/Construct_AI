import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { COLORS, SPACING } from "@/lib/constants";
import { useProject } from "@/context/ProjectContext";

const STATUS_COLOR: Record<string, string> = {
  planning:    COLORS.textMuted,
  active:      COLORS.success,
  on_hold:     COLORS.warning,
  completed:   COLORS.primary,
  cancelled:   COLORS.danger,
};

export function ProjectPicker() {
  const { projects, projectsLoading, selectedProject, setSelectedProjectId } =
    useProject();
  const [open, setOpen] = useState(false);

  if (projectsLoading) {
    return (
      <View style={styles.trigger}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (!selectedProject) return null;

  return (
    <>
      {/* Trigger chip shown in header */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: STATUS_COLOR[selectedProject.status] ?? COLORS.textMuted },
          ]}
        />
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedProject.name}
        </Text>
        {projects.length > 1 && (
          <Text style={styles.chevron}>▾</Text>
        )}
      </TouchableOpacity>

      {/* Project list modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Switch Project</Text>

          <FlatList
            data={projects}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const active = item.id === selectedProject.id;
              return (
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedProjectId(item.id);
                    setOpen(false);
                  }}
                >
                  <View
                    style={[
                      styles.rowDot,
                      { backgroundColor: STATUS_COLOR[item.status] ?? COLORS.textMuted },
                    ]}
                  />
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowName, active && styles.rowNameActive]}>
                      {item.name}
                    </Text>
                    {item.location_name ? (
                      <Text style={styles.rowLocation}>{item.location_name}</Text>
                    ) : null}
                  </View>
                  {active && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 10,
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: 180,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
    flexShrink: 1,
  },
  chevron: {
    fontSize: 10,
    color: COLORS.primary,
    marginLeft: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "60%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
  },
  rowActive: {
    backgroundColor: COLORS.primary + "10",
  },
  rowDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  rowNameActive: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  rowLocation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  checkmark: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "700",
  },
});
