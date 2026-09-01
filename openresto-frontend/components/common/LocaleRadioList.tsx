import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLocale } from "@/context/LocaleContext";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants/locales";
import { styles } from "./LocaleRadioList.styles";

/**
 * The app's list of languages, as radio rows over `LocaleContext`. Shared by the web overflow
 * menu's Language modal and the native guest settings sheet so the two cannot drift — a second
 * copy is how one of them ends up writing `i18n.changeLanguage` without `setActiveLocale`.
 *
 * Rows are `radio`s rather than a `Select`, because both callers already sit inside a modal and
 * a second anchored panel cannot be live at once (issue #387).
 *
 * @see [LocaleRadioList.test.tsx](../../tests/components/common/LocaleRadioList.test.tsx) —
 * pins the checked row, the write through `setLocale`, and the `onSelect` callback.
 */
export function LocaleRadioList({
  onSelect,
  testID = "language-radiogroup",
}: {
  /** Fired after the pick is written — the callers use it to dismiss themselves. */
  onSelect?: (locale: SupportedLocale) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { locale, setLocale } = useLocale();

  return (
    <View
      style={styles.list}
      role="radiogroup"
      accessibilityLabel={t("common.language.switcherLabel")}
      testID={testID}
    >
      {SUPPORTED_LOCALES.map((option) => {
        const checked = option === locale;
        return (
          <Pressable
            key={option}
            onPress={() => {
              setLocale(option);
              onSelect?.(option);
            }}
            accessibilityRole="radio"
            accessibilityLabel={LOCALE_LABELS[option]}
            accessibilityState={{ checked }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.row,
              (hovered || pressed) && { backgroundColor: colors.input },
            ]}
          >
            <ThemedText style={styles.rowText}>{LOCALE_LABELS[option]}</ThemedText>
            {checked && <Icon name="checkmark" size="md" color={colors.muted} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export default LocaleRadioList;
