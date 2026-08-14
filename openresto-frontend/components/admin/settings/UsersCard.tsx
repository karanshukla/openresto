import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { Icon } from "@/components/common/Icon";
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
import { styles as settingsStyles } from "./settings.styles";
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
      if (list) setUsers(list);
      setLoading(false);
    });
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
      setMsg({ text: "Enter a valid email address.", ok: false });
      return;
    }
    if (newUser.password.length < MIN_PASSWORD_LENGTH) {
      setMsg({ text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, ok: false });
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
    setMsg({ text: `${result.user.email} can now sign in.`, ok: true });
    setShowAddForm(false);
    setNewUser(emptyNewUser());
  };

  const handleRoleChange = async (target: AdminUserDto, role: AssignableRole) => {
    setBusy(true);
    const result = await adminUpdateUserRole(target.id, role);
    setBusy(false);
    applyResult(result, `${target.email} is now ${roleLabel(role)}.`);
  };

  const handleActiveToggle = async (target: AdminUserDto) => {
    setBusy(true);
    const result = await adminSetUserActive(target.id, !target.isActive);
    setBusy(false);
    applyResult(
      result,
      target.isActive ? `${target.email} deactivated.` : `${target.email} reactivated.`
    );
  };

  const handleResetPassword = async (target: AdminUserDto) => {
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setMsg({ text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, ok: false });
      return;
    }
    setBusy(true);
    const result = await adminResetUserPassword(target.id, resetPassword);
    setBusy(false);
    if (applyResult(result, `New password set for ${target.email}. Share it out of band.`)) {
      setResetForId(null);
      setResetPassword("");
    }
  };

  const isSelf = (u: AdminUserDto) => currentUser?.id === u.id;

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Users"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}14` }]}>
          <Icon name="people-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Users</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]}>
            {loading
              ? "Loading…"
              : `${users.length} account${users.length !== 1 ? "s" : ""} · Owners can manage users`}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

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
                      { backgroundColor: surface2, borderColor },
                      !u.isActive && styles.inactiveRow,
                    ]}
                    testID={`user-row-${u.id}`}
                  >
                    <View style={settingsStyles.tileCopy}>
                      <ThemedText style={settingsStyles.tileTitle}>
                        {u.displayName ?? u.email}
                      </ThemedText>
                      <ThemedText style={[settingsStyles.tileSub, { color: mutedColor }]}>
                        {u.email}
                      </ThemedText>
                      <View style={styles.rowMeta}>
                        <View style={[styles.badge, { backgroundColor: `${primaryColor}14` }]}>
                          <ThemedText style={[styles.badgeText, { color: primaryColor }]}>
                            {roleLabel(u.role)}
                          </ThemedText>
                        </View>
                        {!u.isActive && (
                          <View style={[styles.badge, { backgroundColor: "#ef444422" }]}>
                            <ThemedText style={[styles.badgeText, { color: "#ef4444" }]}>
                              Deactivated
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      {isSelf(u) && (
                        <ThemedText style={[styles.selfNote, { color: mutedColor }]}>
                          This is you — change your own password under Account Security.
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => {
                          setMsg(null);
                          setResetPassword("");
                          setResetForId((id) => (id === u.id ? null : u.id));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Set a new password for ${u.email}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="key-outline" size="md" color={mutedColor} />
                      </Pressable>
                      {!isSelf(u) && (
                        <Pressable
                          onPress={() => handleActiveToggle(u)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel={
                            u.isActive ? `Deactivate ${u.email}` : `Reactivate ${u.email}`
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon
                            name={u.isActive ? "ban-outline" : "checkmark-circle-outline"}
                            size="md"
                            color={u.isActive ? "#ef4444" : primaryColor}
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <View style={styles.roleChoices}>
                    {ASSIGNABLE_ROLES.map((role) => {
                      const selected = u.role.toLowerCase() === role.toLowerCase();
                      return (
                        <Pressable
                          key={role}
                          disabled={busy || selected}
                          onPress={() => handleRoleChange(u, role)}
                          accessibilityRole="button"
                          accessibilityLabel={`Make ${u.email} ${role}`}
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
                            {role}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  {resetForId === u.id && (
                    <View style={settingsStyles.addForm}>
                      <View style={settingsStyles.field}>
                        <ThemedText style={settingsStyles.fieldLabel}>New password</ThemedText>
                        <Input
                          value={resetPassword}
                          onChangeText={setResetPassword}
                          secureTextEntry
                          placeholder="••••••••"
                        />
                        <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                          Share this with {u.email} out of band; they can change it once signed in.
                        </ThemedText>
                      </View>
                      <View style={settingsStyles.formActions}>
                        <Button
                          style={settingsStyles.formActionPrimary}
                          onPress={() => handleResetPassword(u)}
                          loading={busy}
                        >
                          Set password
                        </Button>
                        <Button variant="secondary" onPress={() => setResetForId(null)}>
                          Cancel
                        </Button>
                      </View>
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
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>Email</ThemedText>
                    <Input
                      value={newUser.email}
                      onChangeText={(email) => setNewUser((s) => ({ ...s, email }))}
                      placeholder="colleague@restaurant.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>
                      Display name (optional)
                    </ThemedText>
                    <Input
                      value={newUser.displayName}
                      onChangeText={(displayName) => setNewUser((s) => ({ ...s, displayName }))}
                      placeholder="Alex Rivera"
                    />
                  </View>
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>Temporary password</ThemedText>
                    <Input
                      value={newUser.password}
                      onChangeText={(password) => setNewUser((s) => ({ ...s, password }))}
                      secureTextEntry
                      placeholder="••••••••"
                    />
                  </View>
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>Role</ThemedText>
                    <View style={styles.roleChoices}>
                      {ASSIGNABLE_ROLES.map((role) => {
                        const selected = newUser.role === role;
                        return (
                          <Pressable
                            key={role}
                            onPress={() => setNewUser((s) => ({ ...s, role }))}
                            accessibilityRole="button"
                            accessibilityLabel={`New user role ${role}`}
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
                              {role}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={settingsStyles.formActions}>
                    <Button
                      style={settingsStyles.formActionPrimary}
                      onPress={handleCreate}
                      loading={busy}
                    >
                      Create user
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setShowAddForm(false);
                        setNewUser(emptyNewUser());
                        setMsg(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={[settingsStyles.addPill, { backgroundColor: primaryColor }]}
                  onPress={() => {
                    setShowAddForm(true);
                    setMsg(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add user"
                >
                  <Icon name="add" size="md" color="#fff" />
                  <ThemedText style={settingsStyles.addPillText}>Add user</ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
