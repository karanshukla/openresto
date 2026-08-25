import { useEffect, useId, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";
import { AnchoredPanel } from "@/components/common/AnchoredPanel";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { ModalCard } from "@/components/common/ModalCard";
import { useAnchorTracking } from "@/hooks/use-anchor-tracking";
import { openIndexFor, resolveListboxKey } from "@/utils/listboxKeys";
import { webProps, type WebKeyEvent } from "@/utils/webProps";
import { styles } from "./OverflowMenu.styles";
import { Icon, type IconName } from "@/components/common/Icon";

/** Width of the panel. Wider than the icon it hangs off, so it is right-aligned to it. */
const PANEL_WIDTH = 260;

interface MenuItem {
  key: string;
  /** The row's visible text. */
  text: string;
  /** What a screen reader announces, where the visible text alone is not a whole instruction. */
  label: string;
  icon: IconName;
  onPress: () => void;
}

/**
 * Web-only overflow menu in the navbar.
 *
 * The second of the app's two anchored popups, and the reason `AnchoredPanel` exists: it used
 * to measure its trigger and place itself with its own copy of the arithmetic `Select` had
 * (issue #348). Everything below the item list — positioning, dismissal, focus, keys — now
 * comes from the shared primitive.
 *
 * @see [OverflowMenu.test.tsx](../../tests/components/layout/OverflowMenu.test.tsx) — pins the
 * rows and the keyboard navigation; the dismissal paths are in `OverflowMenu.dark.test.tsx`.
 */
export default function OverflowMenu({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);
  const triggerRef = useRef<View>(null);
  const { panel, measure, release } = useAnchorTracking(triggerRef, {
    align: "end",
    width: PANEL_WIDTH,
  });
  const { toggle } = useTheme();
  const { colors, isDark } = useAppTheme();
  const brand = useBrand();
  const menuId = useId();
  const itemId = (index: number) => `${menuId}-item-${index}`;

  useEffect(() => {
    fetchSocialLinks().then(setSocialLinks);
  }, []);

  const close = () => setOpen(false);

  const runAndClose = (action: () => void) => () => {
    close();
    action();
  };

  const items: MenuItem[] = [
    {
      key: "help",
      text: t("common.overflowMenu.help"),
      label: t("common.overflowMenu.help"),
      icon: "help-circle-outline",
      onPress: runAndClose(() => setShowHelp(true)),
    },
    {
      key: "theme",
      text: isDark
        ? t("common.overflowMenu.switchToLightMode")
        : t("common.overflowMenu.switchToDarkMode"),
      label: isDark
        ? t("common.overflowMenu.switchToLightMode")
        : t("common.overflowMenu.switchToDarkMode"),
      icon: isDark ? "sunny-outline" : "moon-outline",
      onPress: runAndClose(toggle),
    },
    {
      key: "shortcuts",
      text: t("common.keyboardShortcuts.title"),
      label: t("common.overflowMenu.viewKeyboardShortcuts"),
      icon: "keypad-outline",
      onPress: runAndClose(onOpenShortcuts),
    },
  ];

  const show = (index: number) => {
    measure();
    setActiveIndex(index);
    setOpen(true);
  };

  const isChorded = (event: WebKeyEvent) => !!(event.ctrlKey || event.metaKey || event.altKey);
  const labels = items.map((item) => item.text);

  const handleTriggerKey = (event: WebKeyEvent) => {
    if (isChorded(event)) return;
    const from = openIndexFor(event.key, -1, labels, true);
    if (from === null) return;
    event.preventDefault?.();
    show(from);
  };

  const handleMenuKey = (event: WebKeyEvent) => {
    if (isChorded(event)) return;
    // Menus wrap where the value picker clamps: a command list has no "past the end" to fall
    // off, and every other menu a person uses comes back round.
    const result = resolveListboxKey(event.key, {
      activeIndex,
      labels,
      typeahead: "",
      wrap: true,
    });
    if (result.handled) event.preventDefault?.();
    if (result.activeIndex !== undefined) setActiveIndex(result.activeIndex);
    if (result.commit) items[activeIndex]?.onPress();
    else if (result.close) close();
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={() => show(-1)}
        style={(state) => [
          styles.trigger,
          (state as { hovered?: boolean }).hovered && { opacity: 0.7 },
        ]}
        accessibilityLabel={t("common.overflowMenu.openMenu")}
        role="button"
        aria-expanded={open}
        {...webProps({
          onKeyDown: handleTriggerKey,
          "aria-controls": menuId,
          "aria-haspopup": "menu",
        })}
      >
        <Icon name="ellipsis-vertical" size={19} color={colors.muted} />
      </Pressable>

      <AnchoredPanel
        visible={open}
        onClose={close}
        position={panel}
        onClosed={release}
        role="menu"
        id={menuId}
        accessibilityLabel={t("common.overflowMenu.moreOptions")}
        activeDescendantId={open && activeIndex >= 0 ? itemId(activeIndex) : undefined}
        onKeyDown={handleMenuKey}
        closeLabel={t("common.overflowMenu.closeMenu")}
        backdropTestID="menu-backdrop"
        testID="overflow-menu"
      >
        <View style={styles.panelInner}>
          {items.map((item, i) => (
            <Pressable
              key={item.key}
              style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                styles.row,
                (hovered || pressed || i === activeIndex) && { backgroundColor: colors.input },
              ]}
              onPress={item.onPress}
              id={itemId(i)}
              role="menuitem"
              accessibilityLabel={item.label}
              tabIndex={-1}
            >
              <Icon name={item.icon} size="lg" color={colors.muted} />
              <ThemedText style={styles.rowText}>{item.text}</ThemedText>
            </Pressable>
          ))}

          {socialLinks.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View
                style={styles.socialRow}
                role="group"
                accessibilityLabel={t("common.overflowMenu.findUsElsewhere")}
              >
                {socialLinks.map((link) => (
                  <Pressable
                    key={link.id}
                    onPress={runAndClose(() => {
                      Linking.openURL(link.url);
                    })}
                    accessibilityRole="link"
                    accessibilityLabel={link.label}
                    hitSlop={8}
                    style={(state) => [
                      styles.socialBtn,
                      { borderColor: colors.border },
                      (state as { hovered?: boolean }).hovered && { opacity: 0.65 },
                    ]}
                  >
                    <Icon name={link.iconKey as IconName} size="md" color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </AnchoredPanel>

      <ModalCard
        visible={showHelp}
        title={t("common.overflowMenu.help")}
        onDismiss={() => setShowHelp(false)}
        dismissLabel={t("common.overflowMenu.closeHelp")}
        testID="help-backdrop"
      >
        <ThemedText style={[styles.helpText, { color: colors.muted }]}>
          {t("common.overflowMenu.helpBody")}
        </ThemedText>
        {brand.websiteUrl && (
          <Pressable
            style={styles.helpLink}
            onPress={() => {
              setShowHelp(false);
              Linking.openURL(brand.websiteUrl!);
            }}
            accessibilityRole="link"
            accessibilityLabel={t("common.overflowMenu.visitWebsite")}
          >
            <Icon name="globe-outline" size="md" color={colors.muted} />
            <ThemedText style={[styles.helpLinkText, { color: colors.muted }]}>
              {t("common.overflowMenu.visitWebsite")}
            </ThemedText>
          </Pressable>
        )}
        <ButtonRow>
          <Button
            testID="help-close"
            variant="secondary"
            tone="neutral"
            size="md"
            onPress={() => setShowHelp(false)}
          >
            {t("common.actions.close")}
          </Button>
        </ButtonRow>
      </ModalCard>
    </>
  );
}
