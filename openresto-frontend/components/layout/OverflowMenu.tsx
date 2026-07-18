import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { theme } from "@/theme/theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";

/**
 * Web-only overflow control that replaces the old standalone light/dark toggle
 * in the navbar. Houses a Help entry (a static popup, not a guided tour), the
 * dark-mode toggle, a keyboard-shortcuts entry point, and the restaurant's
 * social links. Uses the same backdrop-dismiss + card pattern as
 * KeyboardShortcutsHelp.
 */
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

  const toggleTheme = () => {
    toggle();
  };

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
        <Ionicons name="ellipsis-vertical" size={19} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <TouchableWithoutFeedback>
            <View
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
                accessibilityLabel="Help"
              >
                <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
                <ThemedText style={styles.rowText}>Help</ThemedText>
              </Pressable>

              <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.row,
                  (hovered || pressed) && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setOpen(false);
                  toggleTheme();
                }}
                accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                <Ionicons
                  name={isDark ? "sunny-outline" : "moon-outline"}
                  size={18}
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
                accessibilityLabel="View keyboard shortcuts"
              >
                <Ionicons name="keypad-outline" size={18} color={colors.muted} />
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
                        <Ionicons
                          name={link.iconKey as ComponentProps<typeof Ionicons>["name"]}
                          size={16}
                          color={colors.muted}
                        />
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
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.helpCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <ThemedText type="h3">Help</ThemedText>
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
                  accessibilityLabel="Visit our website"
                >
                  <Ionicons name="globe-outline" size={16} color={colors.muted} />
                  <ThemedText style={[styles.helpLinkText, { color: colors.muted }]}>
                    Visit our website
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                testID="help-close"
                style={[styles.closeBtn, { borderColor: colors.border }]}
                onPress={() => setShowHelp(false)}
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

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  helpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  panel: {
    position: "absolute",
    minWidth: 230,
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: 6,
    ...theme.shadows.popup,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  rowText: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  socialBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  helpCard: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 380,
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
  helpText: {
    ...theme.typography.caption,
    lineHeight: 20,
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  helpLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  closeBtn: {
    paddingVertical: 11,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    marginTop: theme.spacing.sm,
    borderWidth: 1,
  },
  closeBtnText: {
    ...theme.typography.bodyBold,
  },
});
