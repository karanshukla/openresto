import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { ModalCard } from "@/components/common/ModalCard";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";
import { useBrand } from "@/context/BrandContext";
import { ContactSource, hasContact, mailtoHref, resolveContact, telHref } from "@/utils/contact";
import { styles } from "./LargePartyNoticeModal.styles";
import { Icon, type IconName } from "@/components/common/Icon";

interface LargePartyNoticeModalProps {
  visible: boolean;
  /** Largest single-table capacity at the location, for the message copy. */
  maxCapacity: number;
  /** This location's own contact fields, which take precedence over the brand defaults. */
  restaurant?: ContactSource | null;
  onClose: () => void;
}

/**
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
  const { t } = useTranslation();
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
      setContactLinks([...links].sort((a, b) => a.sortOrder - b.sortOrder));
    });
    return () => {
      cancelled = true;
    };
  }, [visible, hasTypedContact]);

  return (
    <ModalCard
      visible={visible}
      title={t("booking.largeParty.title")}
      onDismiss={onClose}
      dismissLabel={t("common.actions.close")}
    >
      <ThemedText style={[styles.message, { color: colors.muted }]}>
        {t("booking.largeParty.modalMessage", { count: maxCapacity })}
      </ThemedText>

      {hasTypedContact ? (
        <View style={styles.contacts}>
          {contact.phone && (
            <Pressable
              style={[styles.contactBtn, { borderColor: colors.border }]}
              onPress={() => Linking.openURL(telHref(contact.phone!))}
              accessibilityRole="link"
              accessibilityLabel={t("booking.largeParty.callLabel", { phone: contact.phone })}
              hitSlop={6}
            >
              <Icon name="call-outline" size="md" color={primaryColor} />
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
              accessibilityLabel={t("booking.largeParty.emailLabel", { email: contact.email })}
              hitSlop={6}
            >
              <Icon name="mail-outline" size="md" color={primaryColor} />
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
                <Icon name={link.iconKey as IconName} size="md" color={primaryColor} />
                <ThemedText style={[styles.contactLabel, { color: primaryColor }]}>
                  {link.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : (
          <ThemedText style={[styles.noContacts, { color: colors.muted }]}>
            {t("booking.largeParty.noContactsMessage")}
          </ThemedText>
        ))
      )}

      <Button size="md" onPress={onClose}>
        {t("booking.largeParty.gotItLabel")}
      </Button>
    </ModalCard>
  );
}
