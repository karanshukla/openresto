import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { uploadHeroImage, deleteHeroImage } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import Select, { type SelectOption } from "@/components/common/Select";
import { styles, domStyles } from "./HeaderImageCard.styles";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";
import { Icon } from "@/components/common/Icon";
import type { TFunction } from "i18next";

const MAX_HERO_MB = 5;

/**
 * `value` ("Cover"/"Contain") is the `BrandSettings.HeaderImageFit` wire value the Select commits
 * — only `label` localizes.
 * @see [HeaderImageCard.test.tsx](../../../tests/components/admin/settings/HeaderImageCard.test.tsx)
 * — pins that the subtitle keeps showing the raw "Cover"/"Contain" value while the picker's own
 * label translates.
 */
function getImageFitOptions(t: TFunction): SelectOption[] {
  return [
    { value: "Cover", label: t("admin.settings.headerImage.fitCoverLabel") },
    { value: "Contain", label: t("admin.settings.headerImage.fitContainLabel") },
  ];
}

/**
 * The home page's header image and how it fills its frame. Upload and removal take effect
 * immediately (they are their own endpoints); only the fit is part of the brand record and so
 * needs saving.
 */
export function HeaderImageCard({
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
  const [headerImageFit, setHeaderImageFit] = useState(brand.headerImageFit ?? "Cover");
  const [heroPreview, setHeroPreview] = useState<string | null>(brand.headerImageUrl ?? null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:headerImage:expanded", true);

  useBrandDraftPublish({ headerImageUrl: heroPreview, headerImageFit });

  const { status, error, retry, undo } = useAutosave({
    values: { headerImageFit },
    saved: { headerImageFit: brand.headerImageFit ?? "Cover" },
    save: saveBrandFields,
    onRestore: (previous) => setHeaderImageFit(previous.headerImageFit),
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderImageFit(brand.headerImageFit ?? "Cover");
    setHeroPreview(brand.headerImageUrl ?? null);
  }, [brand]);

  /* istanbul ignore next */
  const handlePickHero = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_HERO_MB * 1024 * 1024) {
        setMsg({
          text: t("admin.settings.headerImage.tooLarge", { maxMb: MAX_HERO_MB }),
          ok: false,
        });
        return;
      }
      setHeroUploading(true);
      setMsg(null);
      const url = await uploadHeroImage(file);
      setHeroUploading(false);
      if (url) {
        setHeroPreview(url);
        setMsg({ text: t("admin.settings.headerImage.uploaded"), ok: true });
      } else {
        setMsg({ text: t("admin.settings.headerImage.uploadFailed"), ok: false });
      }
    };
    input.click();
  };

  const handleDeleteHero = async () => {
    setHeroUploading(true);
    await deleteHeroImage();
    setHeroUploading(false);
    setHeroPreview(null);
    setMsg({ text: t("admin.settings.headerImage.removed"), ok: true });
  };

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="image-outline"
        title={t("admin.settings.headerImage.title")}
        subtitle={
          heroPreview
            ? t("admin.settings.headerImage.imageSetSubtitle", { fit: headerImageFit })
            : t("admin.settings.headerImage.noImageSubtitle")
        }
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.headerImage.fieldLabel", { maxMb: MAX_HERO_MB })}
            </ThemedText>
            <View style={styles.heroBlock}>
              {heroPreview ? (
                <View style={[styles.heroFrame, { borderColor }]}>
                  <img
                    src={heroPreview}
                    alt={t("admin.settings.headerImage.imageAlt")}
                    style={domStyles.heroImage}
                  />
                </View>
              ) : (
                <View style={[styles.heroPlaceholder, { borderColor }]}>
                  <Icon name="image-outline" size="xxl" color={mutedColor} />
                  <ThemedText style={[styles.heroPlaceholderText, { color: mutedColor }]}>
                    {t("admin.settings.headerImage.noImagePlaceholder")}
                  </ThemedText>
                </View>
              )}
              <View style={styles.heroActions}>
                <Button
                  variant="secondary"
                  size="md"
                  icon="cloud-upload-outline"
                  onPress={handlePickHero}
                  disabled={heroUploading}
                  loading={heroUploading}
                  accessibilityLabel={
                    heroPreview
                      ? t("admin.settings.headerImage.changeLabel")
                      : t("admin.settings.headerImage.uploadLabel")
                  }
                >
                  {heroUploading
                    ? t("admin.settings.headerImage.uploading")
                    : heroPreview
                      ? t("admin.settings.headerImage.change")
                      : t("admin.settings.headerImage.upload")}
                </Button>
                {heroPreview && (
                  <Button
                    variant="secondary"
                    tone="danger"
                    size="md"
                    icon="trash-outline"
                    onPress={handleDeleteHero}
                    disabled={heroUploading}
                    accessibilityLabel={t("admin.settings.headerImage.removeLabel")}
                  >
                    {t("admin.settings.headerImage.remove")}
                  </Button>
                )}
              </View>
            </View>
          </View>

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.headerImage.fitLabel")}
            </ThemedText>
            <Select
              accessibilityLabel={t("admin.settings.headerImage.fitLabel")}
              options={getImageFitOptions(t)}
              selectedValue={headerImageFit}
              onSelect={(value) => setHeaderImageFit(String(value))}
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              {t("admin.settings.headerImage.fitHint")}
            </ThemedText>
          </View>

          {msg && (
            <ThemedText style={msg.ok ? settingsStyles.successText : settingsStyles.errorText}>
              {msg.text}
            </ThemedText>
          )}

          <SaveStatus
            status={status}
            error={error}
            onRetry={retry}
            onUndo={undo}
            mutedColor={mutedColor}
            testID="header-image-save-status"
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}
