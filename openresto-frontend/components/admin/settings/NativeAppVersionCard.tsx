import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { useBrand } from "@/context/BrandContext";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";

/** Mirrors the backend's own rule: three numbers, nothing else. Blank clears the floor. */
const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * The floor a guest build has to meet to talk to this server: anything below it gets an
 * update-required screen instead of the app, which is how a self-hoster retires a build that
 * predates a change to the guest API. A build's version is the OpenResto release it was built
 * from, so the value here is a release number, not a store build number.
 *
 * @see [NativeAppVersionCard.test.tsx](../../../tests/components/admin/settings/NativeAppVersionCard.test.tsx) —
 * pins that a well-formed version saves, that a half-typed one is withheld with the reason on
 * screen rather than silently, and that emptying the field clears the stored floor.
 */
export function NativeAppVersionCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { t } = useTranslation();
  const brand = useBrand();
  const { primaryColor } = useAppTheme();
  const [minimumAppVersion, setMinimumAppVersion] = useState(brand.minimumAppVersion ?? "");
  const [expanded, setExpanded] = usePersistedState("settings:nativeAppVersion:expanded", true);

  const trimmed = minimumAppVersion.trim();
  // With no button to grey out, a withheld write has to say why or it reads as a broken card.
  const blockedReason =
    trimmed && !SEMVER.test(trimmed) ? t("admin.settings.nativeApp.version.invalidBlocked") : null;

  const { status, error, retry, undo } = useAutosave({
    values: { minimumAppVersion: trimmed },
    saved: { minimumAppVersion: brand.minimumAppVersion ?? "" },
    save: saveBrandFields,
    // Blank is a deliberate clear, so it saves; a partial "1.9" is a 400 and waits.
    canSave: !blockedReason,
    onRestore: (previous) => setMinimumAppVersion(previous.minimumAppVersion),
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinimumAppVersion(brand.minimumAppVersion ?? "");
  }, [brand]);

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="native-app-version-card"
    >
      <AccordionCardHeader
        icon="git-branch-outline"
        title={t("admin.settings.nativeApp.version.title")}
        subtitle={trimmed || t("admin.settings.nativeApp.version.anyVersion")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.nativeApp.version.label")}
            </ThemedText>
            <Input
              value={minimumAppVersion}
              onChangeText={setMinimumAppVersion}
              placeholder={t("admin.settings.nativeApp.version.placeholder")}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              {t("admin.settings.nativeApp.version.hint")}
            </ThemedText>
          </View>

          <SaveStatus
            status={status}
            error={error}
            onRetry={retry}
            onUndo={undo}
            mutedColor={mutedColor}
            blockedReason={blockedReason}
            testID="native-app-version-save-status"
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export default NativeAppVersionCard;
