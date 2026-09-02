import { useRef, useState } from "react";
import { Pressable, View, type ViewStyle, type StyleProp } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { AnchoredPanel } from "@/components/common/AnchoredPanel";
import { IconButton } from "@/components/common/IconButton";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAnchorTracking } from "@/hooks/use-anchor-tracking";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import { LOCALE_LABELS, isSupportedLocale } from "@/constants/locales";
import GuestSettingsDialog, { type GuestSettingsPane } from "./GuestSettingsDialog";
import { MENU_WIDTH, styles } from "./GuestSettingsMenu.styles";

interface Row {
  key: GuestSettingsPane;
  icon: IconName;
  text: string;
  /** The current setting, shown on the row so the menu answers before it is opened. */
  value?: string;
}

/**
 * The guest app's settings, off web. `Navbar`'s `OverflowMenu` is the web counterpart and does
 * not render here, so this is the only way to language, theme, and what the web footer carries.
 *
 * It hangs off its own trigger rather than filling the screen. Each row opens one small dialog,
 * which is what keeps the menu to four rows and off the scrollbar a settings list should never
 * need: the alternative — every control stacked in one sheet — outgrew the viewport the moment
 * it took on the About section.
 *
 * @see [GuestSettingsMenu.test.tsx](../../tests/components/layout/GuestSettingsMenu.test.tsx)
 * — pins that the menu anchors to its trigger, that each row opens its own pane, and that no
 * keyboard-shortcuts row appears, since shortcuts do not fire off web.
 */
export default function GuestSettingsMenu({
  color,
  backgroundColor,
  variant = "plain",
  size = "lg",
  testID = "guest-settings-open",
  style,
}: {
  color?: string;
  backgroundColor?: string;
  variant?: "plain" | "tinted" | "outlined";
  size?: "md" | "lg";
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { locale } = useLocale();
  const { preference } = useTheme();
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<GuestSettingsPane | null>(null);

  // `align: "end"` keeps a panel wider than its trigger inside the screen: a gear in the top
  // right corner anchored from its left edge would hang off the side.
  const { panel, measure, release } = useAnchorTracking(triggerRef, {
    align: "end",
    width: MENU_WIDTH,
  });

  const themeLabel = {
    system: t("common.guestSettings.themeSystem"),
    light: t("common.guestSettings.themeLight"),
    dark: t("common.guestSettings.themeDark"),
  }[preference];

  const rows: Row[] = [
    {
      key: "language",
      icon: "language-outline",
      text: t("common.overflowMenu.language"),
      value: isSupportedLocale(locale) ? LOCALE_LABELS[locale] : undefined,
    },
    {
      key: "appearance",
      icon: "contrast-outline",
      text: t("common.guestSettings.appearance"),
      value: themeLabel,
    },
    { key: "about", icon: "information-circle-outline", text: t("common.guestSettings.about") },
    { key: "help", icon: "help-circle-outline", text: t("common.overflowMenu.help") },
  ];

  return (
    <>
      <View ref={triggerRef} style={[styles.trigger, style]} collapsable={false}>
        <IconButton
          name="settings-outline"
          accessibilityLabel={t("common.guestSettings.openLabel")}
          color={color ?? colors.muted}
          backgroundColor={backgroundColor}
          variant={variant}
          size={size}
          testID={testID}
          onPress={() => {
            measure();
            setOpen(true);
          }}
        />
      </View>

      <AnchoredPanel
        visible={open}
        onClose={() => setOpen(false)}
        onClosed={release}
        position={panel}
        role="menu"
        accessibilityLabel={t("common.guestSettings.title")}
        closeLabel={t("common.guestSettings.closeLabel")}
        testID="guest-settings-menu"
      >
        <View style={styles.panelInner}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              testID={`guest-settings-${row.key}`}
              accessibilityRole="menuitem"
              accessibilityLabel={row.text}
              tabIndex={-1}
              style={({ pressed }: { pressed: boolean }) => [
                styles.row,
                pressed && { backgroundColor: colors.input },
              ]}
              onPress={() => {
                setOpen(false);
                setPane(row.key);
              }}
            >
              <Icon name={row.icon} size="lg" color={colors.muted} />
              <ThemedText style={styles.rowText}>{row.text}</ThemedText>
              {row.value && (
                <ThemedText style={[styles.value, { color: colors.muted }]}>{row.value}</ThemedText>
              )}
            </Pressable>
          ))}
        </View>
      </AnchoredPanel>

      <GuestSettingsDialog pane={pane} onClose={() => setPane(null)} />
    </>
  );
}
