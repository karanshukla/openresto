import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { isValidEmail } from "@/utils/validation";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";

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
  const { t } = useTranslation();
  const brand = useBrand();
  const { primaryColor } = useAppTheme();
  const [websiteUrl, setWebsiteUrl] = useState(brand.websiteUrl ?? "");
  const [phoneNumber, setPhoneNumber] = useState(brand.phoneNumber ?? "");
  const [emailAddress, setEmailAddress] = useState(brand.emailAddress ?? "");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(brand.privacyPolicyUrl ?? "");
  // Key is versioned because the default flipped to expanded: without it, a stored `false`
  // from the collapsed-by-default build would keep the card shut for anyone who saw that one.
  const [expanded, setExpanded] = usePersistedState("settings:contact:expanded:v2", true);

  useBrandDraftPublish({ websiteUrl, privacyPolicyUrl });

  // A withheld save has to say why: with no button to disable, silence reads as a broken card.
  const blockedReason =
    emailAddress.trim() && !isValidEmail(emailAddress)
      ? t("admin.settings.contact.invalidEmailBlocked")
      : null;

  const { status, error, retry, undo } = useAutosave({
    values: {
      websiteUrl: websiteUrl.trim(),
      phoneNumber: phoneNumber.trim(),
      emailAddress: emailAddress.trim(),
      privacyPolicyUrl: privacyPolicyUrl.trim(),
    },
    saved: {
      websiteUrl: brand.websiteUrl ?? "",
      phoneNumber: brand.phoneNumber ?? "",
      emailAddress: brand.emailAddress ?? "",
      privacyPolicyUrl: brand.privacyPolicyUrl ?? "",
    },
    save: saveBrandFields,
    // A half-typed address is a 400 from the server; blank is a deliberate clear, so it saves.
    canSave: !blockedReason,
    onRestore: (previous) => {
      setWebsiteUrl(previous.websiteUrl);
      setPhoneNumber(previous.phoneNumber);
      setEmailAddress(previous.emailAddress);
      setPrivacyPolicyUrl(previous.privacyPolicyUrl);
    },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebsiteUrl(brand.websiteUrl ?? "");
    setPhoneNumber(brand.phoneNumber ?? "");
    setEmailAddress(brand.emailAddress ?? "");
    setPrivacyPolicyUrl(brand.privacyPolicyUrl ?? "");
  }, [brand]);

  const summary =
    [phoneNumber.trim(), emailAddress.trim()].filter(Boolean).join(" · ") ||
    t("admin.settings.contact.noFallback");

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="call-outline"
        title={t("admin.settings.contact.title")}
        subtitle={summary}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.contact.websiteUrlLabel")}
            </ThemedText>
            <Input
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder={t("admin.settings.contact.websiteUrlPlaceholder")}
              autoCapitalize="none"
              keyboardType="url"
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              {t("admin.settings.contact.websiteUrlHint")}
            </ThemedText>
          </View>

          <View style={settingsStyles.fieldRow}>
            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.contact.phoneLabel")}
              </ThemedText>
              <Input
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder={t("admin.settings.contact.phonePlaceholder")}
                autoCapitalize="none"
                keyboardType="phone-pad"
                maxLength={MAX_CONTACT_PHONE_LENGTH}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                {t("admin.settings.contact.phoneHint")}
              </ThemedText>
            </View>

            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.contact.emailLabel")}
              </ThemedText>
              <Input
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder={t("admin.settings.contact.emailPlaceholder")}
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={MAX_CONTACT_EMAIL_LENGTH}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                {t("admin.settings.contact.emailHint")}
              </ThemedText>
            </View>
          </View>

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.contact.privacyPolicyLabel")}
            </ThemedText>
            <Input
              value={privacyPolicyUrl}
              onChangeText={setPrivacyPolicyUrl}
              placeholder={t("admin.settings.contact.privacyPolicyPlaceholder")}
              autoCapitalize="none"
              keyboardType="url"
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              {t("admin.settings.contact.privacyPolicyHint")}
            </ThemedText>
          </View>

          <SaveStatus
            status={status}
            error={error}
            onRetry={retry}
            onUndo={undo}
            mutedColor={mutedColor}
            blockedReason={blockedReason}
            testID="contact-save-status"
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}
