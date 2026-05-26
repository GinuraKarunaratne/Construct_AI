import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, SPACING } from "@/lib/constants";
import { apiClient } from "@/services/api";
import { useProject } from "@/context/ProjectContext";

interface AttendanceOut {
  id: number;
  worker_id: number;
  attendance_date: string;
  status: string;
  method: string;
}

interface Worker {
  id: number;
  full_name: string;
  worker_code: string;
  skill_type: string;
}

type ScanState = "idle" | "scanning" | "processing" | "success" | "error" | "manual";

export default function ScanScreen() {
  const qc = useQueryClient();
  const { selectedProjectId: projectId } = useProject();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [lastResult, setLastResult] = useState<{ workerCode: string; name?: string; date?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const scanLockRef = useRef(false);

  // Fetch workers for name lookup
  const { data: workers } = useQuery({
    queryKey: ["mobile-workers", projectId],
    queryFn: () => apiClient.get<Worker[]>(`/projects/${projectId}/workers`).then(r => r.data),
    enabled: !!projectId,
  });

  const workerMap = new Map((workers ?? []).map(w => [w.worker_code, w]));

  const scanMutation = useMutation({
    mutationFn: (workerCode: string) =>
      apiClient.post<AttendanceOut>(`/projects/${projectId}/attendance/scan`, {
        worker_code: workerCode,
        method: "qr",
      }),
    onSuccess: (res, workerCode) => {
      const worker = workerMap.get(workerCode);
      setLastResult({
        workerCode,
        name: worker?.full_name ?? workerCode,
        date: res.data.attendance_date,
      });
      setScanState("success");
      qc.invalidateQueries({ queryKey: ["mobile-attendance", projectId] });
      // Auto-reset to scanning after 3s
      setTimeout(() => {
        scanLockRef.current = false;
        setScanState("scanning");
        setLastResult(null);
      }, 3000);
    },
    onError: (e: unknown) => {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not record attendance";
      setErrorMsg(detail);
      setScanState("error");
      setTimeout(() => {
        scanLockRef.current = false;
        setScanState("scanning");
        setErrorMsg("");
      }, 3000);
    },
  });

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanLockRef.current || !projectId) return;
    scanLockRef.current = true;
    setScanState("processing");
    scanMutation.mutate(data.trim());
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) {
      Alert.alert("Required", "Please enter a worker code");
      return;
    }
    if (!projectId) {
      Alert.alert("Error", "No active project found");
      return;
    }
    setScanState("processing");
    scanMutation.mutate(code);
    setManualCode("");
  };

  // ── Permission not yet determined ──────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          Allow camera access to scan worker QR codes for attendance.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permBtn, styles.permBtnOutline]}
          onPress={() => setScanState("manual")}
        >
          <Text style={[styles.permBtnText, { color: COLORS.primary }]}>
            Enter Code Manually
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Manual entry mode ──────────────────────────────────────────────────────
  if (scanState === "manual") {
    return (
      <ScrollView style={styles.manualContainer} contentContainerStyle={{ padding: SPACING.md }}>
        <Text style={styles.manualTitle}>Manual Worker Check-In</Text>
        <Text style={styles.manualSub}>
          Enter the worker code printed on their ID badge.
        </Text>

        <View style={styles.manualInputRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="e.g. WRK-001"
            placeholderTextColor={COLORS.textMuted}
            value={manualCode}
            onChangeText={t => setManualCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.manualSubmitBtn}
            onPress={handleManualSubmit}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.manualSubmitText}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {scanMutation.isSuccess && lastResult && (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successName}>{lastResult.name}</Text>
            <Text style={styles.successSub}>Marked present for {lastResult.date}</Text>
          </View>
        )}

        {scanMutation.isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Worker list for reference */}
        {workers && workers.length > 0 && (
          <View style={styles.workerListBox}>
            <Text style={styles.workerListTitle}>Worker Codes</Text>
            {workers.map(w => (
              <TouchableOpacity
                key={w.id}
                style={styles.workerRow}
                onPress={() => setManualCode(w.worker_code)}
              >
                <View style={styles.workerAvatar}>
                  <Text style={styles.workerAvatarText}>{w.full_name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{w.full_name}</Text>
                  <Text style={styles.workerSkill}>{w.skill_type}</Text>
                </View>
                <View style={styles.codeChip}>
                  <Text style={styles.codeChipText}>{w.worker_code}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.permBtn, styles.permBtnOutline, { marginTop: SPACING.lg }]}
          onPress={() => { setScanState("scanning"); setManualCode(""); }}
        >
          <Text style={[styles.permBtnText, { color: COLORS.primary }]}>
            ← Switch to Camera
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Camera scanner ─────────────────────────────────────────────────────────
  return (
    <View style={styles.scanRoot}>
      {/* Camera fill */}
      {scanState !== "idle" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
          onBarcodeScanned={scanState === "scanning" ? handleBarcode : undefined}
        />
      ) : null}

      {/* Dark overlay with cutout effect */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topOverlay}>
          <Text style={styles.scanTitle}>Scan Worker QR Code</Text>
          <Text style={styles.scanSub}>Point camera at the worker's QR badge</Text>
        </View>

        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          {/* Processing spinner */}
          {scanState === "processing" && (
            <View style={styles.processingBox}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.processingText}>Checking in…</Text>
            </View>
          )}

          {/* Success overlay */}
          {scanState === "success" && lastResult && (
            <View style={styles.resultBox}>
              <Text style={styles.resultIcon}>✓</Text>
              <Text style={styles.resultName}>{lastResult.name}</Text>
              <Text style={styles.resultSub}>Marked present</Text>
            </View>
          )}

          {/* Error overlay */}
          {scanState === "error" && (
            <View style={[styles.resultBox, styles.resultBoxError]}>
              <Text style={styles.resultIcon}>✗</Text>
              <Text style={styles.resultErrorMsg}>{errorMsg}</Text>
            </View>
          )}
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomOverlay}>
          {scanState === "idle" && (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => setScanState("scanning")}
            >
              <Text style={styles.startBtnText}>Start Scanning</Text>
            </TouchableOpacity>
          )}

          {(scanState === "scanning" || scanState === "processing" || scanState === "success" || scanState === "error") && (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => { setScanState("idle"); scanLockRef.current = false; }}
            >
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => { setScanState("manual"); scanLockRef.current = false; }}
          >
            <Text style={styles.manualBtnText}>⌨  Manual Entry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const CORNER = 24;

const styles = StyleSheet.create({
  center:          { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.lg, backgroundColor: COLORS.background },
  permTitle:       { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 10, textAlign: "center" },
  permSub:         { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", marginBottom: 30, lineHeight: 20 },
  permBtn:         { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 10, minWidth: 220, alignItems: "center" },
  permBtnOutline:  { backgroundColor: "transparent", borderWidth: 1.5, borderColor: COLORS.primary },
  permBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Manual entry
  manualContainer: { flex: 1, backgroundColor: COLORS.background },
  manualTitle:     { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6 },
  manualSub:       { fontSize: 13, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 18 },
  manualInputRow:  { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  manualInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    letterSpacing: 1,
  },
  manualSubmitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, width: 52, alignItems: "center", justifyContent: "center" },
  manualSubmitText:{ color: "#fff", fontSize: 22, fontWeight: "700" },
  successBox:      { backgroundColor: "#d1fae5", borderRadius: 12, padding: SPACING.md, alignItems: "center", marginBottom: SPACING.md },
  successIcon:     { fontSize: 32, color: COLORS.success, fontWeight: "900", marginBottom: 4 },
  successName:     { fontSize: 16, fontWeight: "700", color: "#065f46" },
  successSub:      { fontSize: 12, color: "#065f46", marginTop: 2 },
  errorBox:        { backgroundColor: "#fee2e2", borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md },
  errorText:       { color: COLORS.danger, fontSize: 13, fontWeight: "600", textAlign: "center" },
  workerListBox:   { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginTop: SPACING.md },
  workerListTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, marginBottom: SPACING.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  workerRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  workerAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + "22", alignItems: "center", justifyContent: "center" },
  workerAvatarText:{ fontSize: 15, fontWeight: "700", color: COLORS.primary },
  workerName:      { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  workerSkill:     { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  codeChip:        { backgroundColor: COLORS.primary + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  codeChipText:    { fontSize: 11, fontWeight: "700", color: COLORS.primary, fontFamily: "monospace" },

  // Camera scanner
  scanRoot:        { flex: 1, backgroundColor: "#000" },
  overlay:         { flex: 1, justifyContent: "space-between" },
  topOverlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: "center",
  },
  scanTitle:       { color: "#fff", fontSize: 18, fontWeight: "700" },
  scanSub:         { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },

  viewfinder: {
    alignSelf: "center",
    width: 260,
    height: 260,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0,  left: 0,  borderBottomWidth: 0, borderRightWidth: 0,  borderTopLeftRadius: 6  },
  cornerTR: { top: 0,  right: 0, borderBottomWidth: 0, borderLeftWidth: 0,   borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0,  borderTopWidth: 0, borderRightWidth: 0,   borderBottomLeftRadius: 6  },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0,    borderBottomRightRadius: 6 },

  processingBox:   { alignItems: "center", gap: 10 },
  processingText:  { color: "#fff", fontSize: 14, fontWeight: "600" },
  resultBox:       { backgroundColor: "rgba(5,150,105,0.9)", borderRadius: 12, padding: 20, alignItems: "center", width: "90%" },
  resultBoxError:  { backgroundColor: "rgba(220,38,38,0.9)" },
  resultIcon:      { color: "#fff", fontSize: 36, fontWeight: "900", marginBottom: 4 },
  resultName:      { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  resultSub:       { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 4 },
  resultErrorMsg:  { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },

  bottomOverlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SPACING.lg,
  },
  startBtn:        { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, width: "100%", alignItems: "center" },
  startBtnText:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  stopBtn:         { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, width: "100%", alignItems: "center" },
  stopBtnText:     { color: "#fff", fontWeight: "600", fontSize: 14 },
  manualBtn:       { paddingVertical: 10 },
  manualBtnText:   { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500" },
});
