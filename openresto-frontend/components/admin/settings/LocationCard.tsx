import { useState } from "react";
import { View } from "react-native";
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
  isDark,
  borderColor,
  mutedColor,
  cardBg,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
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
        setImgMsg({ text: "Image must be under 2 MB.", ok: false });
        return;
      }
      setImgUploading(true);
      setImgMsg(null);
      const url = await uploadLocationImage(restaurant.id, file);
      setImgUploading(false);
      if (url) {
        onSaved({ imageUrl: url });
        setImgMsg({ text: "Image uploaded.", ok: true });
      } else {
        setImgMsg({ text: "Failed to upload image.", ok: false });
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
      setImgMsg({ text: "Image removed.", ok: true });
    } else {
      setImgMsg({ text: "Failed to remove image.", ok: false });
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
      ? "No sections yet"
      : `${sectionCount} section${sectionCount === 1 ? "" : "s"} · ${tableCount} table${tableCount === 1 ? "" : "s"}`;

  return (
    <>
      <View style={styles.statsRow}>
        <StatChip
          label="Sections"
          value={restaurant.sections.length}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
        <StatChip
          label="Tables"
          value={tableCount}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
        <StatChip
          label="Seats"
          value={seatCount}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
      </View>

      <RestaurantInfoForm restaurant={restaurant} onSaved={onSaved} />

      <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
        <AccordionCardHeader
          icon="image-outline"
          title="Location Image"
          subtitle={restaurant.imageUrl ? "Image set" : "No image set"}
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
                  <img src={restaurant.imageUrl} alt="Location" style={domStyles.image} />
                ) : (
                  <Icon name="image-outline" size="xl" color={mutedColor} />
                )}
              </View>

              <View style={styles.imageCopy}>
                <ThemedText style={[styles.imageHint, { color: mutedColor }]}>
                  Shown on the restaurant card. JPEG, PNG or WebP, max 2 MB.
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
                        ? `Change image for ${restaurant.name}`
                        : `Upload image for ${restaurant.name}`
                    }
                  >
                    {imgUploading
                      ? "Uploading…"
                      : restaurant.imageUrl
                        ? "Change image"
                        : "Upload image"}
                  </Button>
                  {restaurant.imageUrl && (
                    <Button
                      variant="secondary"
                      tone="danger"
                      size="md"
                      icon="trash-outline"
                      onPress={handleDeleteImage}
                      disabled={imgUploading}
                      accessibilityLabel={`Remove image for ${restaurant.name}`}
                    >
                      Remove
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
          title="Sections & Tables"
          subtitle={sectionsSubtitle}
          expanded={sectionsExpanded}
          onToggle={() => setSectionsExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />

        <AnimatedAccordion expanded={sectionsExpanded}>
          <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
            <ThemedText style={[styles.sectionsSub, { color: mutedColor }]}>
              Group tables into dining areas. Guests can book by section.
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
                  No sections yet.
                </ThemedText>
              )}
            </View>

            <View style={styles.addSectionRow}>
              <AddRow
                label="Add Section"
                placeholder="e.g. Indoor, Patio, Bar"
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
