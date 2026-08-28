import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { RowTextButton } from "@/components/common/RowTextButton";
import ConfirmModal from "@/components/common/ConfirmModal";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { theme } from "@/theme/theme";
import { fmtDate } from "@/utils/formatters";
import {
  adminCreateApiKey,
  adminListApiKeys,
  adminRevokeApiKey,
  READ_ONLY_SCOPE_RESOURCES,
  SCOPE_ACCESS_LEVELS,
  SCOPE_RESOURCES,
  type ApiKeyDto,
  type ApiKeyScope,
  type CreatedApiKey,
  type ScopeAccess,
  type ScopeResource,
} from "@/api/apiKeys";
import { ApiKeySecretModal } from "./ApiKeySecretModal";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./ApiKeysCard.styles";

type ScopeState = Record<ScopeResource, Record<ScopeAccess, boolean>>;

const EXPIRY_PRESETS = ["none", "30d", "90d", "1y"] as const;
type ExpiryPreset = (typeof EXPIRY_PRESETS)[number];
const EXPIRY_DAYS: Record<Exclude<ExpiryPreset, "none">, number> = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

function emptyScopeState(): ScopeState {
  return Object.fromEntries(
    SCOPE_RESOURCES.map((resource) => [resource, { read: false, write: false }])
  ) as ScopeState;
}

function scopesFromState(state: ScopeState): ApiKeyScope[] {
  return SCOPE_RESOURCES.flatMap((resource) =>
    SCOPE_ACCESS_LEVELS.filter((access) => state[resource][access]).map((access) => ({
      resource,
      access,
    }))
  );
}

function expiryIsoFor(preset: ExpiryPreset): string | undefined {
  if (preset === "none") return undefined;
  return new Date(Date.now() + EXPIRY_DAYS[preset] * 24 * 60 * 60 * 1000).toISOString();
}

interface NewKeyState {
  name: string;
  scopes: ScopeState;
  expiryPreset: ExpiryPreset;
}

const emptyNewKey = (): NewKeyState => ({
  name: "",
  scopes: emptyScopeState(),
  expiryPreset: "none",
});

/**
 * Owner-only management of the API keys other services use to call OpenResto on the
 * restaurant's behalf. Rendered behind `useCan("manage:api-keys")`, mirroring `UsersCard` —
 * both hand out access an unaudited service could abuse, so both stay Owner-gated the same way.
 * A key's secret only ever exists in {@link ApiKeySecretModal}'s transient state, immediately
 * after creation; nothing here holds onto it afterwards.
 */
export function ApiKeysCard({
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
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [keys, setKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = usePersistedState("settings:apiKeys:expanded", true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyState>(emptyNewKey());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyDto | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);

  useEffect(() => {
    adminListApiKeys().then((list) => {
      if (list) setKeys(list);
      else setMsg({ text: t("admin.settings.apiKeys.loadFailed"), ok: false });
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleScope = (resource: ScopeResource, access: ScopeAccess) => {
    setNewKey((s) => ({
      ...s,
      scopes: {
        ...s.scopes,
        [resource]: { ...s.scopes[resource], [access]: !s.scopes[resource][access] },
      },
    }));
  };

  const handleCreate = async () => {
    const name = newKey.name.trim();
    if (!name) {
      setMsg({ text: t("admin.settings.apiKeys.nameRequired"), ok: false });
      return;
    }
    const scopes = scopesFromState(newKey.scopes);
    if (scopes.length === 0) {
      setMsg({ text: t("admin.settings.apiKeys.scopeRequired"), ok: false });
      return;
    }

    setBusy(true);
    const result = await adminCreateApiKey({
      name,
      scopes,
      expiresAt: expiryIsoFor(newKey.expiryPreset),
    });
    setBusy(false);

    if (!result.ok) {
      setMsg({ text: result.message, ok: false });
      return;
    }
    setKeys((prev) => [...prev, result.key]);
    setMsg({
      text: t("admin.settings.apiKeys.createdMessage", { name: result.key.name }),
      ok: true,
    });
    setShowAddForm(false);
    setNewKey(emptyNewKey());
    setCreatedKey(result.key);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const result = await adminRevokeApiKey(revokeTarget.id);
    setRevoking(false);

    if (!result.ok) {
      setMsg({ text: result.message, ok: false });
      setRevokeTarget(null);
      return;
    }
    const revoked = result.key ?? { ...revokeTarget, revokedAt: new Date().toISOString() };
    setKeys((prev) => prev.map((k) => (k.id === revokeTarget.id ? revoked : k)));
    setMsg({
      text: t("admin.settings.apiKeys.revokedMessage", { name: revokeTarget.name }),
      ok: true,
    });
    setRevokeTarget(null);
  };

  const scopeLabel = (access: ScopeAccess) =>
    t(
      access === "read"
        ? "admin.settings.apiKeys.scopeReadLabel"
        : "admin.settings.apiKeys.scopeWriteLabel"
    );

  // A switch rather than a template-literal key: `t()`'s typed overload only accepts a key
  // literal it can resolve against en.json, so a dynamic `scopeResource.${resource}` path
  // would need the untyped (key, defaultValue) escape hatch `errors.ts` uses for a truly
  // unbounded set of keys. This set is small and fixed, so a literal per case keeps the
  // typo-catching intact instead.
  const resourceLabel = (resource: ScopeResource) => {
    switch (resource) {
      case "bookings":
        return t("admin.settings.apiKeys.scopeResource.bookings");
      case "locations":
        return t("admin.settings.apiKeys.scopeResource.locations");
      case "tables":
        return t("admin.settings.apiKeys.scopeResource.tables");
      case "brand":
        return t("admin.settings.apiKeys.scopeResource.brand");
      case "users":
        return t("admin.settings.apiKeys.scopeResource.users");
      case "audit":
        return t("admin.settings.apiKeys.scopeResource.audit");
      case "guests":
        return t("admin.settings.apiKeys.scopeResource.guests");
    }
  };

  const expiryPresetLabel = (preset: ExpiryPreset) => {
    switch (preset) {
      case "none":
        return t("admin.settings.apiKeys.expiryPreset.none");
      case "30d":
        return t("admin.settings.apiKeys.expiryPreset.thirtyDays");
      case "90d":
        return t("admin.settings.apiKeys.expiryPreset.ninetyDays");
      case "1y":
        return t("admin.settings.apiKeys.expiryPreset.oneYear");
    }
  };

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="api-keys-card"
    >
      <AccordionCardHeader
        icon="key-outline"
        title={t("admin.settings.apiKeys.title")}
        subtitle={
          loading
            ? t("common.status.loading")
            : t("admin.settings.apiKeys.subtitle", { count: keys.length })
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
              {keys.map((k) => {
                const revoked = !!k.revokedAt;
                return (
                  <View
                    key={k.id}
                    style={[
                      settingsStyles.tile,
                      styles.keyTile,
                      { backgroundColor: surface2, borderColor },
                      revoked && styles.revokedRow,
                    ]}
                    testID={`api-key-row-${k.id}`}
                  >
                    <View style={settingsStyles.tileCopy}>
                      <ThemedText style={settingsStyles.tileTitle}>{k.name}</ThemedText>
                      <ThemedText style={[styles.prefix, { color: mutedColor }]}>
                        {t("admin.settings.apiKeys.prefixValue", { prefix: k.prefix })}
                      </ThemedText>

                      <View style={styles.scopeBadges}>
                        {k.scopes.map((s) => (
                          <View
                            key={`${s.resource}-${s.access}`}
                            style={[styles.badge, { backgroundColor: `${primaryColor}14` }]}
                          >
                            <ThemedText style={[styles.badgeText, { color: primaryColor }]}>
                              {t("admin.settings.apiKeys.scopeBadge", {
                                resource: resourceLabel(s.resource),
                                access: scopeLabel(s.access),
                              })}
                            </ThemedText>
                          </View>
                        ))}
                      </View>

                      <View style={styles.metaRow}>
                        <ThemedText style={[styles.metaText, { color: mutedColor }]}>
                          {t("admin.settings.apiKeys.createdLabel", {
                            date: fmtDate(new Date(k.createdAt)),
                          })}
                        </ThemedText>
                        <ThemedText style={[styles.metaText, { color: mutedColor }]}>
                          {k.lastUsedAt
                            ? t("admin.settings.apiKeys.lastUsedLabel", {
                                date: fmtDate(new Date(k.lastUsedAt)),
                              })
                            : t("admin.settings.apiKeys.neverUsedLabel")}
                        </ThemedText>
                        {k.expiresAt && (
                          <ThemedText style={[styles.metaText, { color: mutedColor }]}>
                            {t("admin.settings.apiKeys.expiresLabel", {
                              date: fmtDate(new Date(k.expiresAt)),
                            })}
                          </ThemedText>
                        )}
                        {revoked && (
                          <View
                            style={[styles.badge, { backgroundColor: `${theme.colors.error}22` }]}
                          >
                            <ThemedText style={[styles.badgeText, { color: theme.colors.error }]}>
                              {t("admin.settings.apiKeys.revokedBadge")}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.actions}>
                      {!revoked && (
                        <RowTextButton
                          label={t("admin.settings.apiKeys.revoke")}
                          icon="ban-outline"
                          color={theme.colors.error}
                          disabled={busy || revoking}
                          accessibilityLabel={t("admin.settings.apiKeys.revokeLabel", {
                            name: k.name,
                          })}
                          onPress={() => setRevokeTarget(k)}
                        />
                      )}
                    </View>
                  </View>
                );
              })}

              {msg && (
                <ThemedText style={msg.ok ? settingsStyles.successText : settingsStyles.errorText}>
                  {msg.text}
                </ThemedText>
              )}

              {showAddForm ? (
                <View style={settingsStyles.addForm}>
                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>
                      {t("admin.settings.apiKeys.nameLabel")}
                    </ThemedText>
                    <Input
                      value={newKey.name}
                      onChangeText={(name) => setNewKey((s) => ({ ...s, name }))}
                      placeholder={t("admin.settings.apiKeys.namePlaceholder")}
                    />
                  </View>

                  <View style={styles.scopeField}>
                    <ThemedText style={settingsStyles.fieldLabel}>
                      {t("admin.settings.apiKeys.scopesLabel")}
                    </ThemedText>
                    <View style={styles.scopeGrid}>
                      {SCOPE_RESOURCES.map((resource) => (
                        <View key={resource} style={styles.scopeRow}>
                          <ThemedText style={styles.scopeResourceLabel}>
                            {resourceLabel(resource)}
                          </ThemedText>
                          <View style={styles.scopeToggles}>
                            {SCOPE_ACCESS_LEVELS.map((access) => {
                              if (access === "write" && READ_ONLY_SCOPE_RESOURCES.has(resource))
                                return null;
                              const checked = newKey.scopes[resource][access];
                              const label = scopeLabel(access);
                              return (
                                <Pressable
                                  key={access}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked }}
                                  accessibilityLabel={t("admin.settings.apiKeys.scopeToggleLabel", {
                                    resource: resourceLabel(resource),
                                    access: label,
                                  })}
                                  onPress={() => toggleScope(resource, access)}
                                  style={[
                                    styles.scopeChip,
                                    { borderColor: checked ? primaryColor : borderColor },
                                    checked && { backgroundColor: primaryColor },
                                  ]}
                                >
                                  <ThemedText
                                    style={[
                                      styles.scopeChipText,
                                      { color: checked ? theme.colors.white : mutedColor },
                                    ]}
                                  >
                                    {label}
                                  </ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={settingsStyles.field}>
                    <ThemedText style={settingsStyles.fieldLabel}>
                      {t("admin.settings.apiKeys.expiryLabel")}
                    </ThemedText>
                    <View style={styles.expiryChoices}>
                      {EXPIRY_PRESETS.map((preset) => {
                        const selected = newKey.expiryPreset === preset;
                        return (
                          <Pressable
                            key={preset}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={expiryPresetLabel(preset)}
                            onPress={() => setNewKey((s) => ({ ...s, expiryPreset: preset }))}
                            style={[
                              styles.scopeChip,
                              { borderColor: selected ? primaryColor : borderColor },
                              selected && { backgroundColor: `${primaryColor}14` },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.scopeChipText,
                                { color: selected ? primaryColor : mutedColor },
                              ]}
                            >
                              {expiryPresetLabel(preset)}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                    <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                      {t("admin.settings.apiKeys.expiryHint")}
                    </ThemedText>
                  </View>

                  <ButtonRow style={settingsStyles.formActions}>
                    <Button
                      variant="secondary"
                      tone="neutral"
                      size="md"
                      onPress={() => {
                        setShowAddForm(false);
                        setNewKey(emptyNewKey());
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
                      accessibilityLabel={t("admin.settings.apiKeys.addThisKeyLabel")}
                    >
                      {busy ? t("common.status.adding") : t("admin.settings.apiKeys.add")}
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
                    {t("admin.settings.apiKeys.addKey")}
                  </Button>
                </ButtonRow>
              )}
            </View>
          )}
        </View>
      </AnimatedAccordion>

      <ConfirmModal
        visible={!!revokeTarget}
        title={t("admin.settings.apiKeys.confirmRevokeTitle")}
        message={
          revokeTarget
            ? t("admin.settings.apiKeys.confirmRevokeMessage", { name: revokeTarget.name })
            : ""
        }
        confirmLabel={
          revoking
            ? t("admin.settings.apiKeys.revoking")
            : t("admin.settings.apiKeys.confirmRevokeConfirmLabel")
        }
        destructive
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />

      <ApiKeySecretModal
        visible={!!createdKey}
        secret={createdKey?.secret ?? ""}
        onDismiss={() => setCreatedKey(null)}
      />
    </View>
  );
}

export default ApiKeysCard;
