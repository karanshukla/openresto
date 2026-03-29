import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { login, getPvqStatus, verifyPvq, resetPassword } from "@/api/auth";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { Ionicons } from "@expo/vector-icons";

type Stage = "login" | "pvq-email" | "pvq-answer" | "reset" | "done";

export default function AdminLoginScreen() {
  const [stage, setStage] = useState<Stage>("login");

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Forgot password flow
  const [fpEmail, setFpEmail] = useState("");
  const [pvqQuestion, setPvqQuestion] = useState<string | null>(null);
  const [pvqAnswer, setPvqAnswer] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const brand = useBrand();
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;

  // ── Login ────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    const result = await login(email, password);
    setLoginLoading(false);
    if (result) {
      router.replace("/(admin)/dashboard");
    } else {
      setLoginError("Invalid email or password. Please try again.");
    }
  };

  // ── Forgot password: step 1 — load PVQ question ─────────────────────────

  const handleFetchQuestion = async () => {
    setFpError(null);
    setFpLoading(true);
    const status = await getPvqStatus();
    setFpLoading(false);
    if (!status?.isConfigured || !status.question) {
      setFpError("No security question has been configured for this account.");
      return;
    }
    setPvqQuestion(status.question);
    setStage("pvq-answer");
  };

  // ── Forgot password: step 2 — verify PVQ answer ──────────────────────────

  const handleVerifyAnswer = async () => {
    setFpError(null);
    setFpLoading(true);
    const result = await verifyPvq(fpEmail, pvqAnswer);
    setFpLoading(false);
    if (!result) {
      setFpError("Incorrect answer. Please try again.");
      return;
    }
    setResetToken(result.resetToken);
    setStage("reset");
  };

  // ── Forgot password: step 3 — set new password ───────────────────────────

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setFpError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setFpError("Password must be at least 6 characters.");
      return;
    }
    setFpError(null);
    setFpLoading(true);
    const result = await resetPassword(resetToken!, newPassword);
    setFpLoading(false);
    if (!result.ok) {
      setFpError(result.message);
      return;
    }
    setStage("done");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const cardContent = () => {
    if (stage === "login") {
      return (
        <>
          <ThemedText style={styles.title}>Sign in</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Manage your restaurant bookings.
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
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <Input
                ref={passwordRef}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
            </View>

            {loginError && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{loginError}</ThemedText>
              </View>
            )}

            <Button
              onPress={handleLogin}
              disabled={!email.includes("@") || password.length === 0 || loginLoading}
              style={styles.submitBtn}
            >
              {loginLoading ? "Signing in…" : "Sign In"}
            </Button>

            <Pressable
              onPress={() => {
                setFpEmail(email);
                setStage("pvq-email");
                setFpError(null);
              }}
            >
              <ThemedText style={[styles.forgotLink, { color: COLORS.primary }]}>
                Forgot password?
              </ThemedText>
            </Pressable>
          </View>
        </>
      );
    }

    if (stage === "pvq-email") {
      return (
        <>
          <BackButton
            onPress={() => {
              setStage("login");
              setFpError(null);
            }}
          />
          <ThemedText style={styles.title}>Reset password</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            We'll verify your identity using your security question.
          </ThemedText>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Admin email</ThemedText>
              <Input
                placeholder="admin@restaurant.com"
                value={fpEmail}
                onChangeText={setFpEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {fpError && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{fpError}</ThemedText>
              </View>
            )}

            <Button
              onPress={handleFetchQuestion}
              disabled={!fpEmail.includes("@") || fpLoading}
              style={styles.submitBtn}
            >
              {fpLoading ? "Checking…" : "Continue"}
            </Button>
          </View>
        </>
      );
    }

    if (stage === "pvq-answer") {
      return (
        <>
          <BackButton
            onPress={() => {
              setStage("pvq-email");
              setFpError(null);
              setPvqAnswer("");
            }}
          />
          <ThemedText style={styles.title}>Security question</ThemedText>
          <View
            style={[
              styles.questionBox,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <Ionicons name="help-circle-outline" size={18} color={COLORS.primary} />
            <ThemedText style={[styles.questionText, { color: mutedColor }]}>
              {pvqQuestion}
            </ThemedText>
          </View>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Your answer</ThemedText>
              <Input
                placeholder="Answer (not case sensitive)"
                value={pvqAnswer}
                onChangeText={setPvqAnswer}
                autoCapitalize="none"
              />
            </View>

            {fpError && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{fpError}</ThemedText>
              </View>
            )}

            <Button
              onPress={handleVerifyAnswer}
              disabled={pvqAnswer.trim().length === 0 || fpLoading}
              style={styles.submitBtn}
            >
              {fpLoading ? "Verifying…" : "Verify Answer"}
            </Button>
          </View>
        </>
      );
    }

    if (stage === "reset") {
      return (
        <>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle-outline" size={32} color="#16a34a" />
          </View>
          <ThemedText style={styles.title}>Set new password</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            This link expires in 15 minutes.
          </ThemedText>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>New password</ThemedText>
              <Input
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Confirm password</ThemedText>
              <Input
                placeholder="Repeat password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            {fpError && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{fpError}</ThemedText>
              </View>
            )}

            <Button
              onPress={handleResetPassword}
              disabled={newPassword.length < 6 || fpLoading}
              style={styles.submitBtn}
            >
              {fpLoading ? "Resetting…" : "Reset Password"}
            </Button>
          </View>
        </>
      );
    }

    // stage === "done"
    return (
      <>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
        </View>
        <ThemedText style={styles.title}>Password reset!</ThemedText>
        <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
          Your password has been updated. Sign in with your new credentials.
        </ThemedText>
        <Button
          onPress={() => {
            setStage("login");
            setPassword("");
          }}
          style={styles.submitBtn}
        >
          Back to Sign In
        </Button>
      </>
    );
  };

  return (
    <ThemedView style={styles.root}>
      <Stack.Screen options={{ title: "Admin Login" }} />
      <ScrollView contentContainerStyle={styles.outer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.brandRow}>
            <ThemedText style={[styles.brand, { color: COLORS.primary }]}>
              {brand.appName}
            </ThemedText>
            <ThemedText style={[styles.brandBadge, { color: mutedColor }]}>Admin</ThemedText>
          </View>

          <ThemedView
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {cardContent()}
          </ThemedView>

          {stage === "login" && (
            <Pressable onPress={() => router.replace("/")} style={{ cursor: "pointer" } as const}>
              <ThemedText style={[styles.backLink, { color: mutedColor }]}>
                ← Back to {brand.appName}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  return (
    <Pressable style={styles.backBtn} onPress={onPress}>
      <Ionicons name="arrow-back" size={16} color={colors.muted} />
      <ThemedText style={[styles.backBtnText, { color: colors.muted }]}>Back</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  outer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 60,
  },
  container: { width: "100%", maxWidth: 420, gap: 16 },
  brandRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 8 },
  brand: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  brandBadge: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
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
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  fields: { gap: 12 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  errorText: { color: "#dc2626", fontSize: 14 },
  submitBtn: { marginTop: 8 },
  forgotLink: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
    cursor: "pointer" as const,
  },
  backLink: { fontSize: 14, textAlign: "center", cursor: "pointer" as const },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  backBtnText: { fontSize: 13 },
  questionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  questionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  successIcon: { alignItems: "center", marginBottom: 8 },
});
