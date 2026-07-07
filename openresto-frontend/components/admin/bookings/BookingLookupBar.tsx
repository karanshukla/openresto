import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { styles } from "@/components/admin/bookings/bookings.styles";

export type LookupStatus = "idle" | "not_found" | "multiple";

export interface BookingLookupBarProps {
  query: string;
  loading: boolean;
  status: LookupStatus;
  onQueryChange: (text: string) => void;
  onSubmit: () => void;
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  inputBg: string;
  textColor: string;
  placeholderColor: string;
  primaryColor: string;
}

/**
 * Email/reference lookup input + Find button + status messages.
 * Extracted from the bookings screen header for decomposition; presentational,
 * owns no state (the screen drives query/loading/status + the submit handler).
 */
export function BookingLookupBar({
  query,
  loading,
  status,
  onQueryChange,
  onSubmit,
  borderColor,
  inputBg,
  textColor,
  placeholderColor,
  primaryColor,
}: BookingLookupBarProps) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TextInput
          style={[
            {
              height: theme.formSizes.inputSmHeight,
              paddingHorizontal: theme.formSizes.inputPaddingH,
              fontSize: 13,
              borderRadius: theme.formSizes.inputBorderRadius,
              borderWidth: 1,
              borderColor,
              backgroundColor: inputBg,
              color: textColor,
              minWidth: 180,
            },
          ]}
          placeholder="Email or reference…"
          placeholderTextColor={placeholderColor}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={onSubmit}
        />
        <Pressable
          onPress={onSubmit}
          disabled={loading || !query.trim()}
          style={[
            styles.newBookingBtn,
            { backgroundColor: primaryColor },
            (!query.trim() || loading) && { opacity: 0.5 },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="search-outline" size={15} color="#fff" />
              <ThemedText style={styles.newBookingBtnText}>Find</ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {status === "not_found" && (
        <ThemedText style={{ fontSize: 12, color: theme.colors.error, marginTop: -4 }}>
          No booking found.
        </ThemedText>
      )}
      {status === "multiple" && (
        <ThemedText style={{ fontSize: 12, color: primaryColor, marginTop: -4 }}>
          Showing all matches…
        </ThemedText>
      )}
    </>
  );
}
