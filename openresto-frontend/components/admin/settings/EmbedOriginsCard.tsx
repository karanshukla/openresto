import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { AddRow } from "./AddRow";
import { RowIconButton } from "./RowIconButton";
import { styles } from "./EmbedOriginsCard.styles";

/**
 * The sites allowed to frame the booking widget. Every change saves the whole list through
 * `useEmbedOrigins`, and the list shown is the one the server answered with, so a typed
 * `https://Site.com/` reads back as the canonical `https://site.com` it is stored as.
 *
 * @see [EmbedOriginsCard.test.tsx](../../../tests/components/admin/settings/EmbedOriginsCard.test.tsx):
 * pins that adding and removing save the list, and that a refused origin leaves it unchanged.
 */
export function EmbedOriginsCard({
  borderColor,
  mutedColor,
  cardBg,
  origins,
  error,
  onSave,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  origins: string[];
  error: string | null;
  onSave: (origins: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { primaryColor, colors } = useAppTheme();
  const [expanded, setExpanded] = usePersistedState("settings:embedOrigins:expanded", true);

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="embed-origins-card"
    >
      <AccordionCardHeader
        icon="shield-checkmark-outline"
        title={t("admin.settings.embed.origins.title")}
        subtitle={t("admin.settings.embed.origins.subtitle")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />
      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }, styles.body]}>
          <ThemedText style={[styles.intro, { color: mutedColor }]}>
            {origins.length === 0
              ? t("admin.settings.embed.origins.empty")
              : t("admin.settings.embed.origins.intro")}
          </ThemedText>
          <View>
            {origins.map((origin) => (
              <View key={origin} style={[styles.row, { borderBottomColor: borderColor }]}>
                <ThemedText style={styles.origin}>{origin}</ThemedText>
                <RowIconButton
                  name="trash-outline"
                  color={colors.error}
                  accessibilityLabel={t("admin.settings.embed.origins.removeLabel", { origin })}
                  onPress={() => onSave(origins.filter((o) => o !== origin))}
                />
              </View>
            ))}
          </View>
          {error && <ThemedText style={settingsStyles.errorText}>{error}</ThemedText>}
          <AddRow
            label={t("admin.settings.embed.origins.add")}
            placeholder="https://your-restaurant.com"
            onAdd={(origin) => onSave([...origins, origin])}
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}
