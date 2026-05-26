import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { NetworkError, API_BASE } from "@/services/api";

type ServerStatus = "checking" | "online" | "offline";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");

  // Ping the server root to verify phone-to-server connectivity
  useEffect(() => {
    const host = API_BASE.replace("/api/v1", "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);

    fetch(host, { signal: controller.signal })
      .then(() => setServerStatus("online"))
      .catch(() => setServerStatus("offline"))
      .finally(() => clearTimeout(timer));

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: unknown) {
      if (e instanceof NetworkError) {
        setError(
          `Cannot reach the server.\n\n` +
          `Server: ${API_BASE}\n\n` +
          `Check:\n` +
          `• PC and phone are on the same WiFi\n` +
          `• API server is running (npm run api)\n` +
          `• Windows Firewall allows port 8000 inbound`
        );
        setServerStatus("offline");
      } else {
        const detail = (e as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        setError(detail ?? "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  }

  const statusDot =
    serverStatus === "checking" ? "⏳" :
    serverStatus === "online"   ? "🟢" :
                                  "🔴";
  const statusLabel =
    serverStatus === "checking" ? "Checking server…" :
    serverStatus === "online"   ? "Server reachable" :
                                  "Server unreachable";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        {/* Brand */}
        <View style={styles.brandBox}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>CA</Text>
          </View>
          <Text style={styles.title}>ConstructAI</Text>
          <Text style={styles.subtitle}>Smart Construction Management</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.statusBadge}>{statusDot} {statusLabel}</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {serverStatus === "offline" && !error && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                ⚠️ Cannot reach {API_BASE.replace("/api/v1", "")}
                {"\n"}Make sure the API is running and your phone is on the same WiFi as your PC.
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="pm@constructai.lk"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="demo1234"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Demo: pm@constructai.lk / demo1234
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#0f172a" },
  inner:          { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  brandBox:       { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText:       { color: "#fff", fontWeight: "700", fontSize: 18 },
  title:          { color: "#fff", fontSize: 26, fontWeight: "700" },
  subtitle:       { color: "#64748b", fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle:    { fontSize: 17, fontWeight: "600", color: "#0f172a" },
  statusBadge:  { fontSize: 11, color: "#64748b" },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText:    { color: "#991b1b", fontSize: 13, lineHeight: 18 },
  warnBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  warnText:     { color: "#92400e", fontSize: 12, lineHeight: 17 },
  field:        { marginBottom: 16 },
  label:        { fontSize: 13, fontWeight: "500", color: "#475569", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText:     { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint:           { textAlign: "center", color: "#94a3b8", fontSize: 11, marginTop: 14, fontFamily: "monospace" },
});
