import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { login, getPvqStatus, verifyPvq, resetPassword } from "@/api/auth";
import { useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAuth } from "@/context/AuthContext";
import { isValidEmail, validatePasswordChange } from "@/utils/validation";
import { styles } from "@/styles/admin/login.styles";
import { Icon } from "@/components/common/Icon";

type Stage = "login" | "pvq-email" | "pvq-answer" | "reset" | "done";

export default function AdminLoginScreen() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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
  const { refresh } = useAuth();
  const { colors, brand, primaryColor } = useAppTheme();
  const mutedColor = colors.muted;

  const handleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    const result = await login(email, password);
    setLoginLoading(false);
    if (result) {
      // Pull the new identity into the auth context before navigating — the admin layout
      // decides what to render from that status, and it still holds the pre-login one.
      await refresh();
      router.replace("/admin/dashboard");
    } else {
      setLoginError(t("admin.login.signIn.invalidCredentials"));
    }
  };

  const handleFetchQuestion = async () => {
    setFpError(null);
    setFpLoading(true);
    // The email collected in the previous step is what picks the account — before
    // multi-user it was ignored and the server returned "the" question.
    const status = await getPvqStatus(fpEmail.trim());
    setFpLoading(false);
    if (!status?.isConfigured || !status.question) {
      setFpError(t("admin.login.pvqEmail.noQuestionConfigured"));
      return;
    }
    setPvqQuestion(status.question);
    setStage("pvq-answer");
  };

  const handleVerifyAnswer = async () => {
    setFpError(null);
    setFpLoading(true);
    const result = await verifyPvq(fpEmail, pvqAnswer);
    setFpLoading(false);
    if (!result) {
      setFpError(t("admin.login.pvqAnswer.incorrectAnswer"));
      return;
    }
    setResetToken(result.resetToken);
    setStage("reset");
  };

  const handleResetPassword = async () => {
    const v = validatePasswordChange(newPassword, confirmPassword);
    if (!v.ok) {
      setFpError(v.error);
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

  const cardContent = () => {
    if (stage === "login") {
      return (
        <>
          <ThemedText style={styles.title}>{t("admin.login.signIn.title")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            {t("admin.login.signIn.subtitle")}
          </ThemedText>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t("admin.login.signIn.emailLabel")}</ThemedText>
              <Input
                placeholder={t("admin.login.signIn.emailPlaceholder")}
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
              <ThemedText style={styles.label}>{t("admin.login.signIn.passwordLabel")}</ThemedText>
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
              disabled={!isValidEmail(email) || password.length === 0 || loginLoading}
              style={styles.submitBtn}
            >
              {loginLoading ? t("admin.login.signIn.submitting") : t("admin.login.signIn.submit")}
            </Button>

            <Button
              variant="ghost"
              size="md"
              fullWidth
              accessibilityLabel={t("admin.login.signIn.forgotPassword")}
              onPress={() => {
                setFpEmail(email);
                setStage("pvq-email");
                setFpError(null);
              }}
            >
              {t("admin.login.signIn.forgotPassword")}
            </Button>
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
          <ThemedText style={styles.title}>{t("admin.login.pvqEmail.title")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            {t("admin.login.pvqEmail.subtitle")}
          </ThemedText>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t("admin.login.pvqEmail.emailLabel")}</ThemedText>
              <Input
                placeholder={t("admin.login.pvqEmail.emailPlaceholder")}
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
              disabled={!isValidEmail(fpEmail) || fpLoading}
              style={styles.submitBtn}
            >
              {fpLoading ? t("admin.login.pvqEmail.checking") : t("admin.login.pvqEmail.submit")}
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
          <ThemedText style={styles.title}>{t("admin.login.pvqAnswer.title")}</ThemedText>
          <View
            style={[
              styles.questionBox,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Icon name="help-circle-outline" size="lg" color={primaryColor} />
            <ThemedText style={[styles.questionText, { color: mutedColor }]}>
              {pvqQuestion}
            </ThemedText>
          </View>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t("admin.login.pvqAnswer.answerLabel")}</ThemedText>
              <Input
                placeholder={t("admin.login.pvqAnswer.answerPlaceholder")}
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
              {fpLoading ? t("admin.login.pvqAnswer.verifying") : t("admin.login.pvqAnswer.submit")}
            </Button>
          </View>
        </>
      );
    }

    if (stage === "reset") {
      return (
        <>
          <View style={styles.successIcon}>
            <Icon name="checkmark-circle-outline" size={32} color={theme.colors.success} />
          </View>
          <ThemedText style={styles.title}>{t("admin.login.reset.title")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            {t("admin.login.reset.subtitle")}
          </ThemedText>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>
                {t("admin.login.reset.newPasswordLabel")}
              </ThemedText>
              <Input
                placeholder={t("admin.login.reset.newPasswordPlaceholder")}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label}>
                {t("admin.login.reset.confirmPasswordLabel")}
              </ThemedText>
              <Input
                placeholder={t("admin.login.reset.confirmPasswordPlaceholder")}
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
              {fpLoading ? t("admin.login.reset.resetting") : t("admin.login.reset.submit")}
            </Button>
          </View>
        </>
      );
    }

    return (
      <>
        <View style={styles.successIcon}>
          <Icon name="checkmark-circle" size={40} color={theme.colors.success} />
        </View>
        <ThemedText style={styles.title}>{t("admin.login.done.title")}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
          {t("admin.login.done.subtitle")}
        </ThemedText>
        <Button
          onPress={() => {
            setStage("login");
            setPassword("");
          }}
          style={styles.submitBtn}
        >
          {t("admin.login.done.backToSignIn")}
        </Button>
      </>
    );
  };

  return (
    <ThemedView style={styles.root}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: t("admin.login.nativeTitle") }} />}
      <ScrollView contentContainerStyle={styles.outer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.brandRow}>
            <ThemedText style={[styles.brand, { color: primaryColor, flex: 1 }]} numberOfLines={1}>
              {brand.appName}
            </ThemedText>
            <ThemedText style={[styles.brandBadge, { color: mutedColor }]}>
              {t("admin.login.badge")}
            </ThemedText>
          </View>

          <ThemedView
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {cardContent()}
          </ThemedView>

          {stage === "login" && (
            <Pressable
              onPress={() => router.replace("/")}
              accessibilityRole="link"
              accessibilityLabel={t("admin.login.backToApp", { appName: brand.appName })}
              style={{ cursor: "pointer" } as const}
            >
              <ThemedText style={[styles.backLink, { color: mutedColor }]}>
                ← {t("admin.login.backToApp", { appName: brand.appName })}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <ButtonRow align="start" style={styles.backBtn}>
      <Button
        variant="ghost"
        tone="neutral"
        size="sm"
        icon="arrow-back"
        onPress={onPress}
        accessibilityLabel={t("admin.login.backLabel")}
      >
        {t("admin.login.backLabel")}
      </Button>
    </ButtonRow>
  );
}
