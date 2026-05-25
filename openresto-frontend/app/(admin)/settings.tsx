import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View, Platform, Pressable, TextInput } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";
import { fetchRestaurants, createRestaurant, RestaurantDto } from "@/api/restaurants";
import { useBrand } from "@/context/BrandContext";

// Components
import { LocationCard } from "@/components/admin/settings/LocationCard";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";
import { styles } from "@/components/admin/settings/settings.styles";

function useConfirmLocal() {
  const [state, setState] = useState<{ message: string } | null>(null);
  const resolveRef = { current: null as ((v: boolean) => void) | null };

  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  };

  return { state, confirm, handleConfirm, handleCancel };
}

function LocationPills({
  restaurants,
  selectedId,
  onSelect,
  onAdd,
  primaryColor,
  borderColor,
  mutedColor,
  isDark,
}: {
  restaurants: RestaurantDto[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  primaryColor: string;
  borderColor: string;
  mutedColor: string;
  isDark: boolean;
}) {
  const surface2 = isDark ? "#252729" : "#f9fafb";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}
    >
      {restaurants.map((r) => {
        const active = selectedId === r.id;
        const initial = r.name.charAt(0).toUpperCase();
        return (
          <Pressable
            key={r.id}
            onPress={() => onSelect(r.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: active ? primaryColor : borderColor,
              backgroundColor: active ? primaryColor : surface2,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: active ? "rgba(255,255,255,0.2)" : `${primaryColor}18`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: active ? "rgba(255,255,255,0.9)" : primaryColor,
                }}
              >
                {initial}
              </ThemedText>
            </View>
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: active ? "#fff" : mutedColor,
              }}
            >
              {r.name}
            </ThemedText>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: active ? "rgba(255,255,255,0.65)" : COLORS.success,
              }}
            />
          </Pressable>
        );
      })}
      <Pressable
        onPress={onAdd}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 9999,
          borderWidth: 1,
          borderStyle: "dashed" as const,
          borderColor,
          backgroundColor: "transparent",
        }}
      >
        <Ionicons name="add" size={14} color={mutedColor} />
        <ThemedText style={{ fontSize: 13, color: mutedColor }}>Add location</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

export default function AdminSettingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const isDark = useColorScheme() === "dark";
  const {
    state: confirmState,
    confirm: confirmAction,
    handleConfirm,
    handleCancel,
  } = useConfirmLocal();

  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;

  function patchRestaurant(id: number, patch: Partial<RestaurantDto>) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  useEffect(() => {
    let cancelled = false;
    fetchRestaurants().then((data) => {
      if (cancelled) return;
      setRestaurants(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRestaurant = restaurants.find((r) => r.id === selectedId) ?? null;

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Settings" }} />}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText
            style={{
              fontSize: 12,
              color: mutedColor,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            Settings · Locations
          </ThemedText>
          <ThemedText style={styles.pageTitle}>Location Manager</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {restaurants.length} location{restaurants.length !== 1 ? "s" : ""} configured
            {restaurants.length > 0 ? " · all active" : ""}
          </ThemedText>
        </View>
      </View>

      {/* Location pills + content */}
      {restaurants.length > 0 ? (
        <View style={{ gap: 12 }}>
          <LocationPills
            restaurants={restaurants}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={() => setAddingLocation(true)}
            primaryColor={primaryColor}
            borderColor={borderColor}
            mutedColor={mutedColor}
            isDark={isDark}
          />
          {addingLocation && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 14,
                borderWidth: 1,
                borderColor,
                borderRadius: 14,
                backgroundColor: cardBg,
              }}
            >
              <TextInput
                value={newLocationName}
                onChangeText={setNewLocationName}
                placeholder="Location name (e.g. Downtown, Westside)"
                placeholderTextColor={mutedColor}
                autoFocus
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: isDark ? "#fff" : "#000",
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              />
              <Pressable
                disabled={savingLocation || !newLocationName.trim()}
                onPress={async () => {
                  if (!newLocationName.trim()) return;
                  setSavingLocation(true);
                  const created = await createRestaurant(newLocationName.trim());
                  setSavingLocation(false);
                  if (created) {
                    setRestaurants((prev) => [...prev, { ...created, sections: [] }]);
                    setSelectedId(created.id);
                  }
                  setNewLocationName("");
                  setAddingLocation(false);
                }}
                style={{
                  backgroundColor: primaryColor,
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                  {savingLocation ? "Adding…" : "Add"}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAddingLocation(false);
                  setNewLocationName("");
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="close-outline" size={20} color={mutedColor} />
              </Pressable>
            </View>
          )}
          {selectedRestaurant && (
            <View
              style={{
                borderWidth: 1,
                borderColor,
                borderRadius: 14,
                backgroundColor: cardBg,
                overflow: "hidden",
              }}
            >
              <LocationCard
                key={selectedRestaurant.id}
                restaurant={selectedRestaurant}
                onSaved={(patch) => patchRestaurant(selectedRestaurant.id, patch)}
                isDark={isDark}
                borderColor={borderColor}
                mutedColor={mutedColor}
                cardBg={cardBg}
                confirmAction={confirmAction}
              />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.emptyCard, { borderColor, backgroundColor: cardBg }]}>
          <Ionicons name="storefront-outline" size={32} color={mutedColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            No locations found
          </ThemedText>
        </View>
      )}

      {/* Global Settings */}
      <View style={[styles.section, { marginTop: 8 }]}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          GLOBAL SETTINGS
        </ThemedText>
        <BrandSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <HighlightsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <EmailSettingsCard
          borderColor={borderColor}
          mutedColor={mutedColor}
          cardBg={cardBg}
          isDark={isDark}
        />
      </View>

      {/* Account Security */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          ACCOUNT SECURITY
        </ThemedText>
        <SecurityCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
      </View>

      <ConfirmModal
        visible={!!confirmState}
        title="Confirm"
        message={confirmState?.message ?? ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ScrollView>
  );
}
