import { useEffect, useState, type ComponentProps } from "react";
import { Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";
import { useBrand } from "@/context/BrandContext";
import { ContactSource, hasContact, mailtoHref, resolveContact, telHref } from "@/utils/contact";

interface LargePartyNoticeModalProps {
  visible: boolean;
  /** Largest single-table capacity at the location, for the message copy. */
  maxCapacity: number;
  /** This location's own contact fields, which take precedence over the brand defaults. */
  restaurant?: ContactSource | null;
  onClose: () => void;
}

/**
 * Notice shown when a party is too large for any single table at the location.
 * Matches the AlertModal card pattern, with the addition of contact CTAs.
 *
 * Contact resolution runs per-field, location-first then brand-wide (see
 * {@link resolveContact}). Social links are the last resort, for deployments that
 * configured a footer link ("Message us on WhatsApp") but no typed contact — they're
 * fetched lazily and only when no typed contact exists, so the common path costs no request.
 */
export default function LargePartyNoticeModal({
  visible,
  maxCapacity,
  restaurant,
  onClose,
}: LargePartyNoticeModalProps) {
  const { colors, primaryColor } = useAppTheme();
  const brand = useBrand();
  const [contactLinks, setContactLinks] = useState<SocialLinkDto[] | null>(null);

  const contact = resolveContact(restaurant, brand);
  const hasTypedContact = hasContact(contact);

  useEffect(() => {
    if (!visible || hasTypedContact) return;
    let cancelled = false;
    fetchSocialLinks().then((links) => {
      if (cancelled) return;
      // Surface every configured link; the restaurant controls what shows up.
      // Sorted by the admin-set order, same as the footer.
      setContactLinks([...links].sort((a, b) => a.sortOrder - b.sortOrder));
    });
    return () => {
      cancelled = true;
    };
  }, [visible, hasTypedContact]);

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

          {hasTypedContact ? (
            <View style={styles.contacts}>
              {contact.phone && (
                <Pressable
                  style={[styles.contactBtn, { borderColor: colors.border }]}
                  onPress={() => Linking.openURL(telHref(contact.phone!))}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${contact.phone}`}
                  hitSlop={6}
                >
                  <Ionicons name="call-outline" size={16} color={primaryColor} />
                  <ThemedText style={[styles.contactLabel, { color: primaryColor }]}>
                    {contact.phone}
                  </ThemedText>
                </Pressable>
              )}
              {contact.email && (
                <Pressable
                  style={[styles.contactBtn, { borderColor: colors.border }]}
                  onPress={() => Linking.openURL(mailtoHref(contact.email!))}
                  accessibilityRole="link"
                  accessibilityLabel={`Email ${contact.email}`}
                  hitSlop={6}
                >
                  <Ionicons name="mail-outline" size={16} color={primaryColor} />
                  <ThemedText style={[styles.contactLabel, { color: primaryColor }]}>
                    {contact.email}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : (
            contactLinks !== null &&
            (contactLinks.length > 0 ? (
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
            ) : (
              <ThemedText style={[styles.noContacts, { color: colors.muted }]}>
                No contact details are listed yet — please reach out to us directly.
              </ThemedText>
            ))
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
  noContacts: {
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
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
