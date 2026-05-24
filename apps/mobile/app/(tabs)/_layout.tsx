import { Tabs } from "expo-router";
import { TouchableOpacity, Text, View } from "react-native";
import { COLORS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

export default function TabsLayout() {
  const { user, logout } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
        },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerRight: () => (
          <TouchableOpacity
            onPress={logout}
            style={{ marginRight: 16, paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: "600" }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        ),
        headerLeft: () =>
          user ? (
            <View style={{ marginLeft: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: COLORS.primary + "22",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.primary }}>
                  {user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </Text>
              </View>
            </View>
          ) : null,
      }}
    >
      <Tabs.Screen name="index"      options={{ title: "Home"       }} />
      <Tabs.Screen name="tasks"      options={{ title: "Tasks"      }} />
      <Tabs.Screen name="scan"       options={{ title: "Scan"       }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
      <Tabs.Screen name="alerts"     options={{ title: "Alerts"     }} />
    </Tabs>
  );
}
