import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import {
  RestaurantDto,
  TableDto,
  addSection,
  uploadLocationImage,
  deleteLocationImage,
} from "@/api/restaurants";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { RestaurantInfoForm } from "./RestaurantInfoForm";
import { SectionBlock } from "./SectionBlock";
import { AddRow } from "./AddRow";
import { useBrand } from "@/context/BrandContext";
import { styles } from "./settings.styles";

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
    <View
      style={{
        backgroundColor: surface2,
        borderWidth: 1,
        borderColor,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 8,
        minWidth: 72,
        alignItems: "flex-start",
      }}
    >
      <ThemedText
        style={{
          fontSize: 20,
          fontWeight: "600",
          letterSpacing: -0.5,
          lineHeight: 24,
          marginBottom: 3,
        }}
      >
        {value}
      </ThemedText>
      <ThemedText
        style={{ fontSize: 11, color: mutedColor, textTransform: "uppercase", letterSpacing: 0.7 }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

export function LocationCard({
  restaurant,
  onSaved,
  isDark,
  borderColor,
  mutedColor,
  confirmAction,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const accentSoft = `${primaryColor}18`;

  const [imgUploading, setImgUploading] = useState(false);
  const [imgMsg, setImgMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
    await deleteLocationImage(restaurant.id);
    setImgUploading(false);
    onSaved({ imageUrl: null });
    setImgMsg({ text: "Image removed.", ok: true });
  };

  const tableCount = restaurant.sections.reduce((acc, s) => acc + s.tables.length, 0);
  const seatCount = restaurant.sections.reduce(
    (acc, s) => acc + s.tables.reduce((a, t) => a + t.seats, 0),
    0
  );
  const hoursText = `${restaurant.openTime ?? "09:00"}–${restaurant.closeTime ?? "22:00"}`;

  return (
    <View>
      {/* Hero strip */}
      <View
        style={{
          padding: 20,
          paddingHorizontal: 22,
          flexDirection: "row",
          gap: 20,
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        {/* Logo box */}
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            backgroundColor: accentSoft,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="storefront-outline" size={22} color={primaryColor} />
        </View>

        {/* Name + meta */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText
            style={{ fontSize: 20, fontWeight: "600", letterSpacing: -0.3, marginBottom: 5 }}
            numberOfLines={1}
          >
            {restaurant.name}
          </ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {restaurant.address ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="location-outline" size={12} color={mutedColor} />
                  <ThemedText style={{ fontSize: 13, color: mutedColor }} numberOfLines={1}>
                    {restaurant.address}
                  </ThemedText>
                </View>
                <View
                  style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: mutedColor }}
                />
              </>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="time-outline" size={12} color={mutedColor} />
              <ThemedText style={{ fontSize: 13, color: mutedColor }}>{hoursText}</ThemedText>
            </View>
            {restaurant.timezone ? (
              <>
                <View
                  style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: mutedColor }}
                />
                <ThemedText style={{ fontSize: 13, color: mutedColor }}>
                  {restaurant.timezone}
                </ThemedText>
              </>
            ) : null}
          </View>
        </View>

        {/* Right: stats */}
        <View style={{ alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
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
        </View>
      </View>

      {/* Compact image strip */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingVertical: 16,
          flexDirection: "row",
          gap: 16,
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        {/* Thumbnail */}
        <View
          style={{
            width: 96,
            height: 68,
            borderRadius: 8,
            overflow: "hidden",
            borderWidth: 1,
            borderStyle: restaurant.imageUrl ? ("solid" as const) : ("dashed" as const),
            borderColor,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {restaurant.imageUrl ? (
            <img
              src={restaurant.imageUrl}
              alt="Location"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Ionicons name="image-outline" size={20} color={mutedColor} />
          )}
        </View>

        {/* Label + buttons */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <ThemedText style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.1 }}>
              Location image
            </ThemedText>
            <ThemedText
              style={{
                fontSize: 10,
                fontWeight: "600",
                textTransform: "uppercase" as const,
                letterSpacing: 1,
                color: mutedColor,
              }}
            >
              optional
            </ThemedText>
          </View>
          <ThemedText style={{ fontSize: 12, color: mutedColor, marginBottom: 10 }}>
            Shown on the restaurant card. JPEG, PNG or WebP, max 2 MB.
          </ThemedText>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pressable
              style={[styles.secBtn, { borderColor, opacity: imgUploading ? 0.5 : 1 }]}
              onPress={handlePickImage}
              disabled={imgUploading}
            >
              <ThemedText style={[styles.secBtnText, { color: primaryColor }]}>
                {imgUploading
                  ? "Uploading…"
                  : restaurant.imageUrl
                    ? "Change image"
                    : "Upload image"}
              </ThemedText>
            </Pressable>
            {restaurant.imageUrl && (
              <Pressable
                style={[styles.secBtn, { borderColor, opacity: imgUploading ? 0.5 : 1 }]}
                onPress={handleDeleteImage}
                disabled={imgUploading}
              >
                <ThemedText style={[styles.secBtnText, { color: COLORS.error }]}>Remove</ThemedText>
              </Pressable>
            )}
            {imgMsg && (
              <ThemedText
                style={{ fontSize: 12, color: imgMsg.ok ? COLORS.success : COLORS.error }}
              >
                {imgMsg.text}
              </ThemedText>
            )}
          </View>
        </View>
      </View>

      {/* Restaurant info — full width */}
      <View style={{ padding: 22, borderBottomWidth: 1, borderBottomColor: borderColor }}>
        <RestaurantInfoForm restaurant={restaurant} onSaved={onSaved} />
      </View>

      {/* Sections & Tables — full width below */}
      <View style={{ padding: 22 }}>
        <ThemedText
          style={{ fontSize: 15, fontWeight: "600", letterSpacing: -0.2, marginBottom: 3 }}
        >
          Sections & tables
        </ThemedText>
        <ThemedText style={{ fontSize: 13, color: mutedColor, marginBottom: 20 }}>
          Group tables into dining areas. Guests can book by section.
        </ThemedText>

        <View style={{ gap: 14 }}>
          {restaurant.sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              restaurantId={restaurant.id}
              isDark={isDark}
              borderColor={borderColor}
              mutedColor={mutedColor}
              confirmAction={confirmAction}
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
                    s.id === section.id ? { ...s, tables: s.tables.filter((x) => x.id !== id) } : s
                  ),
                })
              }
            />
          ))}
          {restaurant.sections.length === 0 && (
            <ThemedText style={{ fontSize: 13, color: mutedColor, fontStyle: "italic" }}>
              No sections yet.
            </ThemedText>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
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
    </View>
  );
}
