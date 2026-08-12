import { useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, View, TouchableWithoutFeedback } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";
import { styles } from "./OverflowMenu.styles";
import { Icon, type IconName } from "@/components/common/Icon";

/** Web-only overflow menu in the navbar. */
export default function OverflowMenu({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);
  // Modal content is portaled to the document root on web, escaping the
  // Navbar's centered maxWidth container — so the panel can't just anchor to
  // a fixed distance from the window edge (the trigger isn't there once the
  // viewport is wider than the navbar's content). Measure the trigger's real
  // on-screen position instead and anchor the panel to that.
  const [panelPos, setPanelPos] = useState({ top: 64, right: 18 });
  const triggerRef = useRef<View>(null);
  const { toggle } = useTheme();
  const { colors, isDark } = useAppTheme();
  const brand = useBrand();

  useEffect(() => {
    fetchSocialLinks().then(setSocialLinks);
  }, []);

  const openMenu = () => {
    // This component is web-only (see doc comment above), so the ref's
    // current node is a real DOM element — read its position synchronously
    // rather than via RNW's measureInWindow, which always defers through a
    // setTimeout(0) and would let the panel flash at the stale position.
    const rect = (triggerRef.current as unknown as HTMLElement | null)?.getBoundingClientRect?.();
    if (rect) {
      setPanelPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        style={({ hovered }: any) => [styles.trigger, hovered && { opacity: 0.7 }]}
        accessibilityLabel="Open menu"
        accessibilityRole="button"
      >
        <Icon name="ellipsis-vertical" size={19} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          testID="menu-backdrop"
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <TouchableWithoutFeedback>
            <View
              role="menu"
              accessibilityLabel="More options"
              style={[
                styles.panel,
                { backgroundColor: colors.card, borderColor: colors.border },
                { top: panelPos.top, right: panelPos.right },
              ]}
            >
              <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.row,
                  (hovered || pressed) && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setOpen(false);
                  setShowHelp(true);
                }}
                accessibilityRole="menuitem"
                accessibilityLabel="Help"
              >
                <Icon name="help-circle-outline" size="lg" color={colors.muted} />
                <ThemedText style={styles.rowText}>Help</ThemedText>
              </Pressable>

              <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.row,
                  (hovered || pressed) && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setOpen(false);
                  toggle();
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: isDark }}
                accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                <Icon
                  name={isDark ? "sunny-outline" : "moon-outline"}
                  size="lg"
                  color={colors.muted}
                />
                <ThemedText style={styles.rowText}>
                  {isDark ? "Switch to light mode" : "Switch to dark mode"}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.row,
                  (hovered || pressed) && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setOpen(false);
                  onOpenShortcuts();
                }}
                accessibilityRole="menuitem"
                accessibilityLabel="View keyboard shortcuts"
              >
                <Icon name="keypad-outline" size="lg" color={colors.muted} />
                <ThemedText style={styles.rowText}>Keyboard shortcuts</ThemedText>
              </Pressable>

              {socialLinks.length > 0 && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={styles.socialRow}>
                    {socialLinks.map((link) => (
                      <Pressable
                        key={link.id}
                        onPress={() => {
                          setOpen(false);
                          Linking.openURL(link.url);
                        }}
                        accessibilityRole="link"
                        accessibilityLabel={link.label}
                        hitSlop={8}
                        style={({ hovered }: any) => [
                          styles.socialBtn,
                          { borderColor: colors.border },
                          hovered && { opacity: 0.65 },
                        ]}
                      >
                        <Icon name={link.iconKey as IconName} size="md" color={colors.muted} />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>

      <Modal
        visible={showHelp}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelp(false)}
      >
        <Pressable
          testID="help-backdrop"
          style={styles.helpBackdrop}
          onPress={() => setShowHelp(false)}
          accessibilityRole="button"
          accessibilityLabel="Close help"
        >
          <TouchableWithoutFeedback>
            <View
              role="dialog"
              aria-modal
              accessibilityViewIsModal
              accessibilityLabel="Help"
              style={[
                styles.helpCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <ThemedText type="h3" accessibilityRole="header">
                Help
              </ThemedText>
              <ThemedText style={[styles.helpText, { color: colors.muted }]}>
                Open the Locations page to see hours, menus, and available times for each location.
                Pick a time slot to open the booking form right there, or use "My Bookings" to look
                up an existing reservation with your booking reference.
              </ThemedText>
              {brand.websiteUrl && (
                <Pressable
                  style={styles.helpLink}
                  onPress={() => {
                    setShowHelp(false);
                    Linking.openURL(brand.websiteUrl!);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="Visit our website"
                >
                  <Icon name="globe-outline" size="md" color={colors.muted} />
                  <ThemedText style={[styles.helpLinkText, { color: colors.muted }]}>
                    Visit our website
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                testID="help-close"
                style={[styles.closeBtn, { borderColor: colors.border }]}
                onPress={() => setShowHelp(false)}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.closeBtnText, { color: colors.muted }]}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    </>
  );
}
