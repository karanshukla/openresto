import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { isValidEmail } from "@/utils/validation";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";
import { Icon } from "@/components/common/Icon";

// Mirrors the backend ContactLimits caps.
const MAX_CONTACT_PHONE_LENGTH = 32;
const MAX_CONTACT_EMAIL_LENGTH = 254;

/**
 * How a customer reaches you when a location hasn't set its own details, plus the public URL
 * confirmation emails link back to. Grouped together because all three answer "where does this
 * send people", none of them change how the site looks.
 */
export function ContactSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const brand = useBrand();
  const { primaryColor } = useAppTheme();
  const [websiteUrl, setWebsiteUrl] = useState(brand.websiteUrl ?? "");
  const [phoneNumber, setPhoneNumber] = useState(brand.phoneNumber ?? "");
  const [emailAddress, setEmailAddress] = useState(brand.emailAddress ?? "");
  // Key is versioned because the default flipped to expanded: without it, a stored `false`
  // from the collapsed-by-default build would keep the card shut for anyone who saw that one.
  const [expanded, setExpanded] = usePersistedState("settings:contact:expanded:v2", true);

  useBrandDraftPublish({ websiteUrl });

  // A withheld save has to say why: with no button to disable, silence reads as a broken card.
  const blockedReason =
    emailAddress.trim() && !isValidEmail(emailAddress)
      ? "Not saved: that isn't a valid email address yet."
      : null;

  const { status, error, retry } = useAutosave({
    values: {
      websiteUrl: websiteUrl.trim(),
      phoneNumber: phoneNumber.trim(),
      emailAddress: emailAddress.trim(),
    },
    saved: {
      websiteUrl: brand.websiteUrl ?? "",
      phoneNumber: brand.phoneNumber ?? "",
      emailAddress: brand.emailAddress ?? "",
    },
    save: saveBrandFields,
    // A half-typed address is a 400 from the server; blank is a deliberate clear, so it saves.
    canSave: !blockedReason,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebsiteUrl(brand.websiteUrl ?? "");
    setPhoneNumber(brand.phoneNumber ?? "");
    setEmailAddress(brand.emailAddress ?? "");
  }, [brand]);

  const summary =
    [phoneNumber.trim(), emailAddress.trim()].filter(Boolean).join(" · ") ||
    "No fallback contact set";

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Contact & Website"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Icon name="call-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Contact &amp; Website</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {summary}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>Website URL</ThemedText>
            <Input
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder="https://bookings.example.com"
              autoCapitalize="none"
              keyboardType="url"
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              Used in confirmation email links and images. Must be the public URL of this app.
            </ThemedText>
          </View>

          <View style={settingsStyles.fieldRow}>
            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>Contact Phone</ThemedText>
              <Input
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+44 20 7946 0958"
                autoCapitalize="none"
                keyboardType="phone-pad"
                maxLength={MAX_CONTACT_PHONE_LENGTH}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                Fallback contact shown when a location has no phone number of its own.
              </ThemedText>
            </View>

            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>Contact Email</ThemedText>
              <Input
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="bookings@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={MAX_CONTACT_EMAIL_LENGTH}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                Fallback contact shown when a location has no email of its own.
              </ThemedText>
            </View>
          </View>

          <SaveStatus
            status={status}
            error={error}
            onRetry={retry}
            mutedColor={mutedColor}
            blockedReason={blockedReason}
            testID="contact-save-status"
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}
