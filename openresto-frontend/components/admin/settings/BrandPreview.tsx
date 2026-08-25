import { Platform, Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getThemeColors, theme } from "@/theme/theme";
import { buildFaviconDataUri } from "@/constants/faviconIcons";
import { useTranslation } from "react-i18next";
import { hexToRgb } from "@/utils/colors";
import { useBrandDraft } from "./BrandDraftContext";
import { styles, domStyles } from "./BrandPreview.styles";

const PLACEHOLDER_LOCATIONS = ["Riverside", "Old Town", "Harbour"];

/**
 * A miniature of the customer home page driven by the unsaved form state, so the admin can see
 * a colour, a tagline or a header image land before committing it. It is deliberately a static
 * mock rather than the real screen: the real one fetches locations and would need the whole
 * customer route tree mounted inside the admin.
 */
export function BrandPreview({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const draft = useBrandDraft();
  const { isDark: adminIsDark } = useAppTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = usePersistedState("settings:brand:preview:expanded", true);
  const [previewDark, setPreviewDark] = usePersistedState(
    "settings:brand:preview:dark",
    adminIsDark
  );

  const site = getThemeColors(previewDark);
  const accent = draft.primaryColor || theme.colors.primary;
  const { r, g, b } = hexToRgb(accent);
  const accentSoft = `rgba(${r},${g},${b},0.18)`;

  const hasHero = !!draft.headerImageUrl && Platform.OS === "web";
  const heroContain = draft.headerImageFit?.toLowerCase() === "contain";
  const subtitle = draft.subtitle.trim() || t("restaurant.home.heroSubtitle");
  const highlightsHeading =
    draft.highlightsHeading.trim() || t("restaurant.home.highlightsHeading");
  const highlightsSubheading =
    draft.highlightsSubheading.trim() || t("restaurant.home.highlightsSubheading");
  const copyright =
    draft.copyrightText.trim() ||
    `© ${new Date().getFullYear()} ${draft.appName}. All rights reserved.`;
  const url = draft.websiteUrl.trim().replace(/^https?:\/\//, "") || "your-site.example";

  // Only the first three fit the row at this scale, and the point is the shape of the section
  // rather than an inventory — the list itself is edited directly below in the same column.
  const shownHighlights = draft.highlights.slice(0, 3);

  const heroGradient = previewDark
    ? `radial-gradient(80% 90% at 90% 10%, ${accentSoft}, transparent 60%), radial-gradient(60% 80% at 10% 100%, rgba(${r},${g},${b},0.12), transparent 60%), linear-gradient(180deg, ${site.card} 0%, ${site.page} 100%)`
    : `radial-gradient(80% 90% at 90% 10%, ${accentSoft}, transparent 60%), linear-gradient(180deg, ${site.card} 0%, ${site.page} 100%)`;

  return (
    <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.headerTitle}>Live preview</ThemedText>
          <ThemedText style={[styles.headerSub, { color: mutedColor }]}>
            Home page, before you save
          </ThemedText>
        </View>

        <View
          style={[styles.schemeGroup, { backgroundColor: previewDark ? "#00000030" : "#0000000d" }]}
        >
          {[
            { label: "Light", dark: false },
            { label: "Dark", dark: true },
          ].map((mode) => {
            const active = previewDark === mode.dark;
            return (
              <Pressable
                key={mode.label}
                onPress={() => setPreviewDark(mode.dark)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Preview in ${mode.label.toLowerCase()} mode`}
                style={[styles.schemeBtn, active && { backgroundColor: `${accent}26` }]}
              >
                <ThemedText style={[styles.schemeLabel, { color: active ? accent : mutedColor }]}>
                  {mode.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Live preview"
          accessibilityState={{ expanded }}
          hitSlop={8}
        >
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
        </Pressable>
      </View>

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.body, { borderTopColor: borderColor }]}>
          <View
            testID="brand-preview-frame"
            style={[styles.frame, { borderColor, backgroundColor: site.page }]}
          >
            <View
              style={[
                styles.chrome,
                { backgroundColor: site.surface, borderBottomColor: site.border },
              ]}
            >
              <View style={styles.chromeDots}>
                {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                  <View key={c} style={[styles.chromeDot, { backgroundColor: c }]} />
                ))}
              </View>

              <View style={[styles.tab, { backgroundColor: site.card, borderColor: site.border }]}>
                {draft.faviconIcon ? (
                  <img
                    data-testid="brand-preview-favicon"
                    src={buildFaviconDataUri(draft.faviconIcon, accent)}
                    alt=""
                    style={domStyles.tabFavicon}
                  />
                ) : (
                  <View style={[styles.tabGlyph, { backgroundColor: site.border }]} />
                )}
                <ThemedText style={[styles.tabTitle, { color: site.text }]} numberOfLines={1}>
                  {draft.appName}
                </ThemedText>
              </View>

              <View
                style={[styles.urlBar, { backgroundColor: site.card, borderColor: site.border }]}
              >
                <ThemedText style={[styles.urlText, { color: site.muted }]} numberOfLines={1}>
                  {url}
                </ThemedText>
              </View>
            </View>

            <View
              style={[
                styles.hero,
                { backgroundColor: site.card, borderBottomColor: site.border },
                !hasHero && Platform.OS === "web" && ({ background: heroGradient } as object),
              ]}
            >
              {hasHero && (
                <>
                  <img
                    data-testid="brand-preview-hero-image"
                    src={draft.headerImageUrl!}
                    alt=""
                    aria-hidden
                    style={{
                      ...domStyles.heroImage,
                      objectFit: heroContain ? "contain" : "cover",
                      objectPosition: heroContain ? "center top" : "center",
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
                      {
                        background: `linear-gradient(160deg, rgba(${r},${g},${b},0.30) 0%, rgba(0,0,0,0.40) 100%)`,
                      } as object,
                    ]}
                  />
                </>
              )}

              <View style={styles.heroInner}>
                <View
                  style={[
                    styles.heroPill,
                    hasHero && {
                      backgroundColor: site.card,
                      borderColor: site.border,
                      borderWidth: 1,
                      borderRadius: 8,
                      padding: 10,
                    },
                  ]}
                >
                  <ThemedText style={[styles.heroTitle, { color: site.text }]} numberOfLines={2}>
                    {draft.appName}
                  </ThemedText>
                  <ThemedText style={[styles.heroSub, { color: site.muted }]} numberOfLines={3}>
                    {subtitle}
                  </ThemedText>
                </View>
              </View>

              {shownHighlights.length > 0 && (
                <View style={styles.highlights}>
                  <View style={styles.highlightsHead}>
                    <ThemedText
                      style={[
                        styles.highlightsLabel,
                        { color: hasHero ? "rgba(255,255,255,0.92)" : site.muted },
                      ]}
                      numberOfLines={1}
                    >
                      {highlightsHeading}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.highlightsBy,
                        { color: hasHero ? "rgba(255,255,255,0.82)" : site.muted },
                      ]}
                      numberOfLines={1}
                    >
                      {highlightsSubheading}
                    </ThemedText>
                  </View>

                  <View style={styles.highlightsRow}>
                    {shownHighlights.map((h) => (
                      <View
                        key={h.id}
                        style={[
                          styles.highlightCard,
                          { backgroundColor: site.card, borderColor: site.border },
                        ]}
                      >
                        <View style={[styles.highlightIconBox, { backgroundColor: accentSoft }]}>
                          <Icon name={h.iconKey as IconName} size={11} color={accent} />
                        </View>
                        <ThemedText
                          style={[styles.highlightTitle, { color: site.text }]}
                          numberOfLines={1}
                        >
                          {h.title}
                        </ThemedText>
                        <ThemedText
                          style={[styles.highlightBody, { color: site.muted }]}
                          numberOfLines={2}
                        >
                          {h.body}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.locations}>
              <ThemedText style={[styles.locationsTitle, { color: site.text }]}>
                {t("restaurant.home.locationsHeading")}
              </ThemedText>
              <View style={styles.locationsRow}>
                {PLACEHOLDER_LOCATIONS.map((name) => (
                  <View
                    key={name}
                    style={[
                      styles.locationCard,
                      { backgroundColor: site.card, borderColor: site.border },
                    ]}
                  >
                    <View style={[styles.locationImage, { backgroundColor: accentSoft }]} />
                    <View style={styles.locationBody}>
                      <ThemedText
                        style={[styles.locationName, { color: site.text }]}
                        numberOfLines={1}
                      >
                        {name}
                      </ThemedText>
                      <View style={[styles.skeletonBar, { backgroundColor: site.border }]} />
                      <View
                        style={[styles.skeletonBar, { backgroundColor: site.border, width: "70%" }]}
                      />
                      <View style={[styles.locationCta, { backgroundColor: accent }]}>
                        <ThemedText style={styles.locationCtaText}>Book</ThemedText>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.footer, { borderTopColor: site.border }]}>
              <ThemedText style={[styles.footerCopy, { color: site.muted }]} numberOfLines={2}>
                {copyright}
              </ThemedText>
              {draft.socialLinks.length > 0 && (
                <View style={styles.footerSocial}>
                  {draft.socialLinks.slice(0, 3).map((link) => (
                    <View key={link.id} style={styles.footerSocialItem}>
                      <Icon name={link.iconKey as IconName} size={10} color={site.muted} />
                      <ThemedText
                        style={[styles.footerSocialLabel, { color: site.muted }]}
                        numberOfLines={1}
                      >
                        {link.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <ThemedText style={[styles.hint, { color: mutedColor }]}>
            Locations are stand-ins. Everything else is your real content, including edits you
            haven&apos;t saved yet.
          </ThemedText>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
