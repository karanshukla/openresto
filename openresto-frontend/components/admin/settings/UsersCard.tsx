import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { useAuth } from "@/context/AuthContext";
import { ASSIGNABLE_ROLES, ROLES, roleLabel, type AssignableRole } from "@/constants/roles";
import { isValidEmail } from "@/utils/validation";
import {
  adminCreateUser,
  adminListUsers,
  adminResetUserPassword,
  adminSetUserActive,
  adminUpdateUserRole,
  type AdminUserDto,
  type UserMutationResult,
} from "@/api/users";
import { theme } from "@/theme/theme";
import { RowTextButton } from "@/components/common/RowTextButton";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./UsersCard.styles";

const MIN_PASSWORD_LENGTH = 6;

interface NewUserState {
  email: string;
  displayName: string;
  password: string;
  role: AssignableRole;
}

const emptyNewUser = (): NewUserState => ({
  email: "",
  displayName: "",
  password: "",
  role: ROLES.manager,
});

/**
 * `role` is the identifier `roleLabel` resolves and the API/JWT compare against (mirrored from
 * `constants/roles.ts`, owned by #375/PR4); only the label this returns localizes.
 * @see [UsersCard.test.tsx](../../../tests/components/admin/settings/UsersCard.test.tsx)
 * — pins that both roles render their translated label at every render site (badge, picker,
 * and the outcome messages) while `adminUpdateUserRole` still receives the raw role string.
 */
function roleDisplayLabel(role: string, t: TFunction): string {
  const resolved = roleLabel(role);
  switch (resolved) {
    case ROLES.owner:
      return t("admin.settings.users.roleOwner");
    case ROLES.manager:
      return t("admin.settings.users.roleManager");
    default:
      return resolved;
  }
}

/**
 * Owner-only management of the other admin accounts. Rendered behind `useCan("manage:users")`
 * so a Manager never sees a control the API would refuse — but the server is still the
 * authority, and every rejection it sends (last-Owner, duplicate email) is surfaced verbatim
 * rather than being second-guessed here.
 */
export function UsersCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { t } = useTranslation();
  const { isDark, primaryColor } = useAppTheme();
  const { user: currentUser } = useAuth();
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = usePersistedState("settings:users:expanded", true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState<NewUserState>(emptyNewUser());
  const [resetForId, setResetForId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    adminListUsers().then((list) => {
      // An empty list and a failed request both render as "no accounts", which is never true
      // — the caller is signed in — so say which one happened.
      if (list) setUsers(list);
      else setMsg({ text: t("admin.settings.users.loadFailed"), ok: false });
      setLoading(false);
    });
    // Runs once on mount only — `t`'s identity is stable across a locale switch, and
    // re-running this fetch on every language change would be a wasted round trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every mutation returns the updated row, so the list is patched in place rather than refetched.
  const applyResult = useCallback((result: UserMutationResult, successText: string): boolean => {
    if (!result.ok) {
      setMsg({ text: result.message, ok: false });
      return false;
    }
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
    setMsg({ text: successText, ok: true });
    return true;
  }, []);

  const handleCreate = async () => {
    const email = newUser.email.trim();
    if (!isValidEmail(email)) {
      setMsg({ text: t("admin.settings.users.invalidEmail"), ok: false });
      return;
    }
    if (newUser.password.length < MIN_PASSWORD_LENGTH) {
      setMsg({
        text: t("admin.settings.users.passwordTooShort", { min: MIN_PASSWORD_LENGTH }),
        ok: false,
      });
      return;
    }

    setBusy(true);
    const result = await adminCreateUser({
      email,
      password: newUser.password,
      displayName: newUser.displayName.trim() || undefined,
      role: newUser.role,
    });
    setBusy(false);

    if (!result.ok) {
      setMsg({ text: result.message, ok: false });
      return;
    }
    setUsers((prev) => [...prev, result.user]);
    setMsg({
      text: t("admin.settings.users.createdMessage", { email: result.user.email }),
      ok: true,
    });
    setShowAddForm(false);
    setNewUser(emptyNewUser());
  };

  const handleRoleChange = async (target: AdminUserDto, role: AssignableRole) => {
    setBusy(true);
    const result = await adminUpdateUserRole(target.id, role);
    setBusy(false);
    applyResult(
      result,
      t("admin.settings.users.roleChangedMessage", {
        email: target.email,
        role: roleDisplayLabel(role, t),
      })
    );
  };

  const handleActiveToggle = async (target: AdminUserDto) => {
    setBusy(true);
    const result = await adminSetUserActive(target.id, !target.isActive);
    setBusy(false);
    applyResult(
      result,
      target.isActive
        ? t("admin.settings.users.deactivatedMessage", { email: target.email })
        : t("admin.settings.users.reactivatedMessage", { email: target.email })
    );
  };

  const handleResetPassword = async (target: AdminUserDto) => {
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setMsg({
        text: t("admin.settings.users.passwordTooShort", { min: MIN_PASSWORD_LENGTH }),
        ok: false,
      });
      return;
    }
    setBusy(true);
    const result = await adminResetUserPassword(target.id, resetPassword);
    setBusy(false);
    if (
      applyResult(result, t("admin.settings.users.passwordResetMessage", { email: target.email }))
    ) {
      setResetForId(null);
      setResetPassword("");
    }
  };

  const isSelf = (u: AdminUserDto) => currentUser?.id === u.id;

  /**
   * The role picker below the row already states the current role, so the badge is only
   * worth its space where no picker is offered: your own row, and the legacy `Admin` claim
   * that no picker option matches.
   */
  const showsRoleBadge = (u: AdminUserDto) =>
    isSelf(u) || !ASSIGNABLE_ROLES.some((r) => r.toLowerCase() === u.role.toLowerCase());

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="users-card"
    >
      <AccordionCardHeader
        icon="people-outline"
        title={t("admin.settings.users.title")}
        subtitle={
          loading
            ? t("admin.settings.users.loading")
            : t("admin.settings.users.subtitle", { count: users.length })
        }
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor, gap: 12 }]}>
          {loading ? (
            <ActivityIndicator color={primaryColor} />
          ) : (
            <View style={styles.list}>
              {users.map((u) => (
                <View key={u.id}>
                  <View
                    style={[
                      settingsStyles.tile,
                      styles.userTile,
                      { backgroundColor: surface2, borderColor },
                      !u.isActive && styles.inactiveRow,
                    ]}
                    testID={`user-row-${u.id}`}
                  >
                    <View style={settingsStyles.tileCopy}>
                      <ThemedText style={settingsStyles.tileTitle}>
                        {u.displayName ?? u.email}
                      </ThemedText>
                      {u.displayName && (
                        <ThemedText style={[settingsStyles.tileSub, { color: mutedColor }]}>
                          {u.email}
                        </ThemedText>
                      )}
                      {(showsRoleBadge(u) || !u.isActive) && (
                        <View style={styles.rowMeta}>
                          {showsRoleBadge(u) && (
                            <View style={[styles.badge, { backgroundColor: `${primaryColor}14` }]}>
                              <ThemedText style={[styles.badgeText, { color: primaryColor }]}>
                                {roleDisplayLabel(u.role, t)}
                              </ThemedText>
                            </View>
                          )}
                          {!u.isActive && (
                            <View
                              style={[styles.badge, { backgroundColor: `${theme.colors.error}22` }]}
                            >
                              <ThemedText style={[styles.badgeText, { color: theme.colors.error }]}>
                                {t("admin.settings.users.deactivatedBadge")}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      )}
                      {isSelf(u) && (
                        <ThemedText style={[styles.selfNote, { color: mutedColor }]}>
                          {t("admin.settings.users.selfNote")}
                        </ThemedText>
                      )}
                      {/* Your own role is shown as the badge above but not offered as a
                          control: the server refuses a self-role-change for the same reason
                          it refuses a self-deactivation. */}
                      {!isSelf(u) && (
                        <View style={styles.roleField}>
                          <ThemedText style={[styles.roleFieldLabel, { color: mutedColor }]}>
                            {t("admin.settings.users.roleFieldLabel")}
                          </ThemedText>
                          <View style={styles.roleChoices}>
                            {ASSIGNABLE_ROLES.map((role) => {
                              const selected = u.role.toLowerCase() === role.toLowerCase();
                              return (
                                <Pressable
                                  key={role}
                                  disabled={busy || selected}
                                  onPress={() => handleRoleChange(u, role)}
                                  accessibilityRole="radio"
                                  accessibilityLabel={t("admin.settings.users.makeRoleLabel", {
                                    email: u.email,
                                    role: roleDisplayLabel(role, t),
                                  })}
                                  accessibilityState={{ checked: selected, disabled: busy }}
                                  style={[
                                    styles.roleChoice,
                                    { borderColor: selected ? primaryColor : borderColor },
                                  ]}
                                >
                                  <ThemedText
                                    style={[
                                      styles.roleChoiceText,
                                      { color: selected ? primaryColor : mutedColor },
                                    ]}
                                  >
                                    {roleDisplayLabel(role, t)}
                                  </ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={styles.actions}>
                      <RowTextButton
                        label={t("admin.settings.users.resetPassword")}
                        icon="key-outline"
                        color={mutedColor}
                        accessibilityLabel={t("admin.settings.users.resetPasswordLabel", {
                          email: u.email,
                        })}
                        onPress={() => {
                          setMsg(null);
                          setResetPassword("");
                          setResetForId((id) => (id === u.id ? null : u.id));
                        }}
                      />
                      {!isSelf(u) && (
                        <RowTextButton
                          label={
                            u.isActive
                              ? t("admin.settings.users.deactivate")
                              : t("admin.settings.users.reactivate")
                          }
                          icon={u.isActive ? "ban-outline" : "checkmark-circle-outline"}
                          color={u.isActive ? theme.colors.error : primaryColor}
                          disabled={busy}
                          accessibilityLabel={
                            u.isActive
                              ? t("admin.settings.users.deactivateLabel", { email: u.email })
                              : t("admin.settings.users.reactivateLabel", { email: u.email })
                          }
                          onPress={() => handleActiveToggle(u)}
                        />
                      )}
                    </View>
                  </View>

                  {resetForId === u.id && (
                    <View style={settingsStyles.addForm}>
                      <View style={settingsStyles.field}>
                        <ThemedText style={settingsStyles.fieldLabel}>
                          {t("admin.settings.users.newPasswordLabel")}
                        </ThemedText>
                        <Input
                          value={resetPassword}
                          onChangeText={setResetPassword}
                          secureTextEntry
                          placeholder="••••••••"
                        />
                        <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                          {t("admin.settings.users.resetPasswordHint", { email: u.email })}
                        </ThemedText>
                      </View>
                      <ButtonRow style={settingsStyles.formActions}>
                        <Button
                          variant="secondary"
                          tone="neutral"
                          size="md"
                          onPress={() => setResetForId(null)}
                        >
                          {t("common.actions.cancel")}
                        </Button>
                        <Button size="md" onPress={() => handleResetPassword(u)} loading={busy}>
                          {t("admin.settings.users.setPassword")}
                        </Button>
                      </ButtonRow>
                    </View>
                  )}
                </View>
              ))}

              {msg && (
                <ThemedText style={msg.ok ? settingsStyles.successText : settingsStyles.errorText}>
                  {msg.text}
                </ThemedText>
              )}

              {showAddForm ? (
                <View style={settingsStyles.addForm}>
                  <View style={settingsStyles.fieldRow}>
                    <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                      <ThemedText style={settingsStyles.fieldLabel}>
                        {t("admin.settings.users.emailLabel")}
                      </ThemedText>
                      <Input
                        value={newUser.email}
                        onChangeText={(email) => setNewUser((s) => ({ ...s, email }))}
                        placeholder="colleague@restaurant.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>
                    <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                      <ThemedText style={settingsStyles.fieldLabel}>
                        {t("admin.settings.users.displayNameLabel")}
                      </ThemedText>
                      <Input
                        value={newUser.displayName}
                        onChangeText={(displayName) => setNewUser((s) => ({ ...s, displayName }))}
                        placeholder="Alex Rivera"
                      />
                    </View>
                  </View>
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>
                      {t("admin.settings.users.temporaryPasswordLabel")}
                    </ThemedText>
                    <Input
                      value={newUser.password}
                      onChangeText={(password) => setNewUser((s) => ({ ...s, password }))}
                      secureTextEntry
                      placeholder="••••••••"
                    />
                  </View>
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>
                      {t("admin.settings.users.roleFieldLabel")}
                    </ThemedText>
                    <View style={styles.roleChoices}>
                      {ASSIGNABLE_ROLES.map((role) => {
                        const selected = newUser.role === role;
                        return (
                          <Pressable
                            key={role}
                            onPress={() => setNewUser((s) => ({ ...s, role }))}
                            accessibilityRole="button"
                            accessibilityLabel={t("admin.settings.users.newUserRoleLabel", {
                              role: roleDisplayLabel(role, t),
                            })}
                            accessibilityState={{ selected }}
                            style={[
                              styles.roleChoice,
                              { borderColor: selected ? primaryColor : borderColor },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.roleChoiceText,
                                { color: selected ? primaryColor : mutedColor },
                              ]}
                            >
                              {roleDisplayLabel(role, t)}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <ButtonRow style={settingsStyles.formActions}>
                    <Button
                      variant="secondary"
                      tone="neutral"
                      size="md"
                      onPress={() => {
                        setShowAddForm(false);
                        setNewUser(emptyNewUser());
                        setMsg(null);
                      }}
                    >
                      {t("common.actions.cancel")}
                    </Button>
                    <Button
                      size="md"
                      icon="add"
                      onPress={handleCreate}
                      loading={busy}
                      accessibilityLabel={t("admin.settings.users.addThisUserLabel")}
                    >
                      {busy ? t("admin.settings.users.adding") : t("admin.settings.users.add")}
                    </Button>
                  </ButtonRow>
                </View>
              ) : (
                <ButtonRow align="start">
                  <Button
                    size="md"
                    icon="add"
                    onPress={() => {
                      setShowAddForm(true);
                      setMsg(null);
                    }}
                  >
                    {t("admin.settings.users.addUser")}
                  </Button>
                </ButtonRow>
              )}
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
