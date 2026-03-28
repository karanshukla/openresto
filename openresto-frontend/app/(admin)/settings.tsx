import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";

// Components
import { LocationCard } from "@/components/admin/settings/LocationCard";
import { GlobalSettingRow } from "@/components/admin/settings/GlobalSettingRow";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
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

export default function AdminSettingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useColorScheme() === "dark";
  const {
    state: confirmState,
    confirm: confirmAction,
    handleConfirm,
    handleCancel,
  } = useConfirmLocal();

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
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText style={styles.pageTitle}>Location Manager</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {restaurants.length} location{restaurants.length !== 1 ? "s" : ""} configured
          </ThemedText>
        </View>
      </View>

      {/* Location cards */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          YOUR LOCATIONS
        </ThemedText>
        {restaurants.map((r) => (
          <LocationCard
            key={r.id}
            restaurant={r}
            isSelected={selectedId === r.id}
            onSelect={() => setSelectedId((prev) => (prev === r.id ? null : r.id))}
            onSaved={(patch) => patchRestaurant(r.id, patch)}
            isDark={isDark}
            borderColor={borderColor}
            mutedColor={mutedColor}
            cardBg={cardBg}
            confirmAction={confirmAction}
          />
        ))}
        {restaurants.length === 0 && (
          <View style={[styles.emptyCard, { borderColor, backgroundColor: cardBg }]}>
            <Ionicons name="storefront-outline" size={32} color={mutedColor} />
            <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
              No locations found
            </ThemedText>
          </View>
        )}
      </View>

      {/* Global Settings */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          GLOBAL SETTINGS
        </ThemedText>
        <BrandSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <EmailSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <GlobalSettingRow
          icon="globe-outline"
          title="API & Network"
          sub="API keys, webhooks, and integrations"
          mutedColor={mutedColor}
          borderColor={borderColor}
          cardBg={cardBg}
          comingSoon
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
