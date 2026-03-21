import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { login } from "@/api/auth";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const cardBg = isDark ? "#1e2022" : "#ffffff";

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result) {
      router.replace("/(admin)/dashboard");
    } else {
      setError("Invalid email or password. Please try again.");
    }
  };

  const isValid = email.includes("@") && password.length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.outer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        {/* Brand */}
        <View style={styles.brandRow}>
          <ThemedText style={[styles.brand, { color: PRIMARY }]}>
            Open Resto
          </ThemedText>
          <ThemedText style={[styles.brandBadge, { color: mutedColor }]}>
            Admin
          </ThemedText>
        </View>

        {/* Card */}
        <ThemedView
          style={[styles.card, { backgroundColor: cardBg, borderColor }]}
        >
          <ThemedText style={styles.title}>Sign in</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Manage your restaurant reservations.
          </ThemedText>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <Input
                placeholder="admin@restaurant.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <Input
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
              />
            </View>

            {error && (
              <ThemedView style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </ThemedView>
            )}

            <Button
              onPress={handleLogin}
              disabled={!isValid || loading}
              style={styles.submitBtn}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </View>
        </ThemedView>

        <Link href="/" asChild>
          <ThemedText style={[styles.backLink, { color: mutedColor }]}>
            ← Back to Open Resto
          </ThemedText>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 60,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    gap: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8,
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  brandBadge: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  fields: {
    gap: 4,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  submitBtn: {
    marginTop: 8,
  },
  backLink: {
    fontSize: 14,
    textAlign: "center",
    cursor: "pointer" as any,
  },
});
