import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import {
  RestaurantDto,
  TableDto,
  addSection,
  uploadLocationImage,
  deleteLocationImage,
} from "@/api/restaurants";
import { reorderSections } from "@/api/admin";
import { theme } from "@/theme/theme";
import { RestaurantInfoForm } from "./RestaurantInfoForm";
import { SectionBlock } from "./SectionBlock";
import { AddRow } from "./AddRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import Button from "@/components/common/Button";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles as settingsStyles } from "./settings.styles";
import { styles, domStyles } from "./LocationCard.styles";
import { Icon } from "@/components/common/Icon";

function StatChip({
  label,
  value,
  isDark,
  borderColor,
  mutedColor,
}: {
  label: string;
  value: number;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
}) {
  const surface2 = isDark ? "#252729" : "#f9fafb";
  return (
    <View style={[styles.statChip, { backgroundColor: surface2, borderColor }]}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: mutedColor }]}>{label}</ThemedText>
    </View>
  );
}

export function LocationCard({
  restaurant,
  onSaved,
  upcomingBookingsCount = 0,
  isDark,
  borderColor,
  mutedColor,
  cardBg,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
  /** Forwarded to the timezone warning; 0 keeps it hidden. */
  upcomingBookingsCount?: number;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { t } = useTranslation();
  const { primaryColor } = useAppTheme();

  const [imgUploading, setImgUploading] = useState(false);
  const [imgMsg, setImgMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [imageExpanded, setImageExpanded] = usePersistedState("locations:image:expanded", true);
  const [sectionsExpanded, setSectionsExpanded] = usePersistedState(
    "locations:sections:expanded",
    true
  );

  const handlePickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setImgMsg({ text: t("admin.settings.locationCard.imageTooLarge"), ok: false });
        return;
      }
      setImgUploading(true);
      setImgMsg(null);
      const url = await uploadLocationImage(restaurant.id, file);
      setImgUploading(false);
      if (url) {
        onSaved({ imageUrl: url });
        setImgMsg({ text: t("admin.settings.locationCard.imageUploaded"), ok: true });
      } else {
        setImgMsg({ text: t("admin.settings.locationCard.imageUploadFailed"), ok: false });
      }
    };
    input.click();
  };

  const handleDeleteImage = async () => {
    setImgUploading(true);
    const ok = await deleteLocationImage(restaurant.id);
    setImgUploading(false);
    if (ok) {
      onSaved({ imageUrl: null });
      setImgMsg({ text: t("admin.settings.locationCard.imageRemoved"), ok: true });
    } else {
      setImgMsg({ text: t("admin.settings.locationCard.imageRemoveFailed"), ok: false });
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (reordering) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= restaurant.sections.length) return;

    const reordered = [...restaurant.sections];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setReordering(true);
    const success = await reorderSections(
      restaurant.id,
      reordered.map((s) => s.id)
    );
    setReordering(false);
    if (success) {
      onSaved({ sections: reordered });
    }
  };

  const tableCount = restaurant.sections.reduce((acc, s) => acc + s.tables.length, 0);
  const seatCount = restaurant.sections.reduce(
    (acc, s) => acc + s.tables.reduce((a, t) => a + t.seats, 0),
    0
  );
  const sectionCount = restaurant.sections.length;
  const sectionsSubtitle =
    sectionCount === 0
      ? t("admin.settings.locationCard.noSectionsSubtitle")
      : t("admin.settings.locationCard.sectionsSubtitle", {
          sections: t("admin.settings.locationCard.sectionsCount", { count: sectionCount }),
          tables: t("admin.settings.locationCard.tablesCount", { count: tableCount }),
        });

  return (
    <>
      <View style={styles.statsRow}>
        <StatChip
          label={t("admin.settings.locationCard.sectionsStat")}
          value={restaurant.sections.length}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
        <StatChip
          label={t("admin.settings.locationCard.tablesStat")}
          value={tableCount}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
        <StatChip
          label={t("admin.settings.locationCard.seatsStat")}
          value={seatCount}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
      </View>

      <RestaurantInfoForm
        restaurant={restaurant}
        onSaved={onSaved}
        upcomingBookingsCount={upcomingBookingsCount}
      />

      <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
        <AccordionCardHeader
          icon="image-outline"
          title={t("admin.settings.locationCard.imageTitle")}
          subtitle={
            restaurant.imageUrl
              ? t("admin.settings.locationCard.imageSet")
              : t("admin.settings.locationCard.noImageSet")
          }
          expanded={imageExpanded}
          onToggle={() => setImageExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />

        <AnimatedAccordion expanded={imageExpanded}>
          <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
            <View style={styles.imageRow}>
              <View
                style={[
                  styles.imageFrame,
                  { borderStyle: restaurant.imageUrl ? "solid" : "dashed", borderColor },
                ]}
              >
                {restaurant.imageUrl ? (
                  <img
                    src={restaurant.imageUrl}
                    alt={t("admin.settings.locationCard.imageAlt")}
                    style={domStyles.image}
                  />
                ) : (
                  <Icon name="image-outline" size="xl" color={mutedColor} />
                )}
              </View>

              <View style={styles.imageCopy}>
                <ThemedText style={[styles.imageHint, { color: mutedColor }]}>
                  {t("admin.settings.locationCard.imageHint")}
                </ThemedText>
                <View style={styles.imageActions}>
                  <Button
                    variant="secondary"
                    size="md"
                    icon="cloud-upload-outline"
                    onPress={handlePickImage}
                    disabled={imgUploading}
                    loading={imgUploading}
                    accessibilityLabel={
                      restaurant.imageUrl
                        ? t("admin.settings.locationCard.changeImageLabel", {
                            name: restaurant.name,
                          })
                        : t("admin.settings.locationCard.uploadImageLabel", {
                            name: restaurant.name,
                          })
                    }
                  >
                    {imgUploading
                      ? t("admin.settings.locationCard.uploading")
                      : restaurant.imageUrl
                        ? t("admin.settings.locationCard.changeImage")
                        : t("admin.settings.locationCard.uploadImage")}
                  </Button>
                  {restaurant.imageUrl && (
                    <Button
                      variant="secondary"
                      tone="danger"
                      size="md"
                      icon="trash-outline"
                      onPress={handleDeleteImage}
                      disabled={imgUploading}
                      accessibilityLabel={t("admin.settings.locationCard.removeImageLabel", {
                        name: restaurant.name,
                      })}
                    >
                      {t("admin.settings.locationCard.remove")}
                    </Button>
                  )}
                  {imgMsg && (
                    <ThemedText
                      style={[
                        styles.imageMsg,
                        { color: imgMsg.ok ? theme.colors.success : theme.colors.error },
                      ]}
                    >
                      {imgMsg.text}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          </View>
        </AnimatedAccordion>
      </View>

      <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
        <AccordionCardHeader
          icon="grid-outline"
          title={t("admin.settings.locationCard.sectionsTablesTitle")}
          subtitle={sectionsSubtitle}
          expanded={sectionsExpanded}
          onToggle={() => setSectionsExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />

        <AnimatedAccordion expanded={sectionsExpanded}>
          <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
            <ThemedText style={[styles.sectionsSub, { color: mutedColor }]}>
              {t("admin.settings.locationCard.sectionsHint")}
            </ThemedText>

            <View style={styles.sectionsList}>
              {restaurant.sections.map((section, index) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  restaurantId={restaurant.id}
                  isDark={isDark}
                  borderColor={borderColor}
                  mutedColor={mutedColor}
                  groups={restaurant.groups ?? []}
                  isFirst={index === 0}
                  isLast={index === restaurant.sections.length - 1}
                  moveDisabled={reordering}
                  onMoveUp={() => handleMove(index, -1)}
                  onMoveDown={() => handleMove(index, 1)}
                  onSectionRenamed={(name) =>
                    onSaved({
                      sections: restaurant.sections.map((s) =>
                        s.id === section.id ? { ...s, name } : s
                      ),
                    })
                  }
                  onSectionDeleted={() =>
                    onSaved({
                      sections: restaurant.sections.filter((s) => s.id !== section.id),
                    })
                  }
                  onTableAdded={(t: TableDto) =>
                    onSaved({
                      sections: restaurant.sections.map((s) =>
                        s.id === section.id ? { ...s, tables: [...s.tables, t] } : s
                      ),
                    })
                  }
                  onTableUpdated={(t: TableDto) =>
                    onSaved({
                      sections: restaurant.sections.map((s) =>
                        s.id === section.id
                          ? { ...s, tables: s.tables.map((x) => (x.id === t.id ? t : x)) }
                          : s
                      ),
                    })
                  }
                  onTableDeleted={(id: number) =>
                    onSaved({
                      sections: restaurant.sections.map((s) =>
                        s.id === section.id
                          ? { ...s, tables: s.tables.filter((x) => x.id !== id) }
                          : s
                      ),
                    })
                  }
                  onGroupsChanged={(updatedGroups) => onSaved({ groups: updatedGroups })}
                />
              ))}
              {restaurant.sections.length === 0 && (
                <ThemedText style={[styles.sectionsEmpty, { color: mutedColor }]}>
                  {t("admin.settings.locationCard.noSectionsYet")}
                </ThemedText>
              )}
            </View>

            <View style={styles.addSectionRow}>
              <AddRow
                label={t("admin.settings.locationCard.addSection")}
                placeholder={t("admin.settings.locationCard.addSectionPlaceholder")}
                onAdd={async (name) => {
                  const result = await addSection(restaurant.id, name);
                  if (result)
                    onSaved({
                      sections: [...restaurant.sections, { ...result, tables: [] }],
                    });
                }}
              />
            </View>
          </View>
        </AnimatedAccordion>
      </View>
    </>
  );
}
