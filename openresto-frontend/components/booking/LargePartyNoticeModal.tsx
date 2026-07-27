import { useEffect, useState, type ComponentProps } from "react";
import { Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";

/**
 * Icon keys that represent a direct contact channel (vs. social/promo links).
 * Surfaced as tappable CTAs so large parties can reach the restaurant directly.
 */
const CONTACT_ICON_KEYS = new Set([
  "call-outline",
  "mail-outline",
  "logo-whatsapp",
  "chatbubble-outline",
]);

interface LargePartyNoticeModalProps {
  visible: boolean;
  /** Largest single-table capacity at the location, for the message copy. */
  maxCapacity: number;
  onClose: () => void;
}

/**
 * Notice shown when a party is too large for any single table at the location.
 * Matches the AlertModal card pattern, with the addition of contact CTAs pulled
 * from the restaurant's social links (phone/email/etc.). Contact links are
 * fetched lazily on first show so a booking form that never triggers the guard
 * pays nothing.
 */
export default function LargePartyNoticeModal({
  visible,
  maxCapacity,
  onClose,
}: LargePartyNoticeModalProps) {
  const { colors, primaryColor } = useAppTheme();
  const [contactLinks, setContactLinks] = useState<SocialLinkDto[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchSocialLinks().then((links) => {
      if (cancelled) return;
      setContactLinks(links.filter((l) => CONTACT_ICON_KEYS.has(l.iconKey)));
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <ThemedText type="h3">Large party</ThemedText>
          <ThemedText style={[styles.message, { color: colors.muted }]}>
            Our largest table seats {maxCapacity}, so a booking for a bigger group needs to be
            arranged directly. Please get in touch and we&apos;ll happily sort something out.
          </ThemedText>

          {contactLinks.length > 0 && (
            <View style={styles.contacts}>
              {contactLinks.map((link) => (
                <Pressable
                  key={link.id}
                  style={[styles.contactBtn, { borderColor: colors.border }]}
                  onPress={() => Linking.openURL(link.url)}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  hitSlop={6}
                >
                  <Ionicons
                    name={link.iconKey as ComponentProps<typeof Ionicons>["name"]}
                    size={16}
                    color={primaryColor}
                  />
                  <ThemedText style={[styles.contactLabel, { color: primaryColor }]}>
                    {link.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={[styles.btn, { backgroundColor: primaryColor }]} onPress={onClose}>
            <ThemedText style={styles.btnText}>Got it</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  card: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 400,
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
  message: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  contacts: {
    gap: theme.spacing.sm,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  btn: {
    paddingVertical: 11,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  btnText: {
    color: theme.colors.white,
    ...theme.typography.bodyBold,
    fontWeight: "700",
  },
});
