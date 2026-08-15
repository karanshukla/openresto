import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { uploadHeroImage, deleteHeroImage } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import {
  styles as settingsStyles,
  domStyles as settingsDomStyles,
  themedSelect,
} from "./settings.styles";
import { styles, domStyles } from "./HeaderImageCard.styles";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";
import { Icon } from "@/components/common/Icon";

const MAX_HERO_MB = 5;

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
  const brand = useBrand();
  const { primaryColor, colors } = useAppTheme();
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
        setMsg({ text: `Image must be under ${MAX_HERO_MB} MB.`, ok: false });
        return;
      }
      setHeroUploading(true);
      setMsg(null);
      const url = await uploadHeroImage(file);
      setHeroUploading(false);
      if (url) {
        setHeroPreview(url);
        setMsg({ text: "Header image uploaded.", ok: true });
      } else {
        setMsg({ text: "Failed to upload image.", ok: false });
      }
    };
    input.click();
  };

  const handleDeleteHero = async () => {
    setHeroUploading(true);
    await deleteHeroImage();
    setHeroUploading(false);
    setHeroPreview(null);
    setMsg({ text: "Header image removed.", ok: true });
  };

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Homepage Header"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Icon name="image-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Homepage Header</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {heroPreview ? `Image set · ${headerImageFit}` : "No image · brand gradient"}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              Header image (max {MAX_HERO_MB} MB)
            </ThemedText>
            <View style={styles.heroBlock}>
              {heroPreview ? (
                <View style={[styles.heroFrame, { borderColor }]}>
                  <img src={heroPreview} alt="Header" style={domStyles.heroImage} />
                </View>
              ) : (
                <View style={[styles.heroPlaceholder, { borderColor }]}>
                  <Icon name="image-outline" size="xxl" color={mutedColor} />
                  <ThemedText style={[styles.heroPlaceholderText, { color: mutedColor }]}>
                    No header image
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
                  accessibilityLabel={heroPreview ? "Change header image" : "Upload header image"}
                >
                  {heroUploading ? "Uploading…" : heroPreview ? "Change" : "Upload"}
                </Button>
                {heroPreview && (
                  <Button
                    variant="secondary"
                    tone="danger"
                    size="md"
                    icon="trash-outline"
                    onPress={handleDeleteHero}
                    disabled={heroUploading}
                    accessibilityLabel="Remove header image"
                  >
                    Remove
                  </Button>
                )}
              </View>
            </View>
          </View>

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>Image fit</ThemedText>
            <select
              data-testid="header-image-fit-select"
              value={headerImageFit}
              onChange={/* istanbul ignore next */ (e) => setHeaderImageFit(e.target.value)}
              style={{ ...settingsDomStyles.select, ...themedSelect(colors) }}
            >
              <option value="Cover">Cover (fill, may crop)</option>
              <option value="Contain">Contain (show whole image)</option>
            </select>
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              &quot;Contain&quot; avoids cropping on mobile; &quot;Cover&quot; fills the frame.
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
