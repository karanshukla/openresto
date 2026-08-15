import { TextInput, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { theme } from "@/theme/theme";

export type LookupStatus = "idle" | "not_found" | "multiple";

export interface BookingLookupBarProps {
  query: string;
  loading: boolean;
  status: LookupStatus;
  onQueryChange: (text: string) => void;
  onSubmit: () => void;
  borderColor: string;
  inputBg: string;
  textColor: string;
  placeholderColor: string;
  primaryColor: string;
}

/**
 * Email/reference lookup input + Find button + status messages.
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
        <Button
          size="md"
          icon="search-outline"
          onPress={onSubmit}
          disabled={loading || !query.trim()}
          loading={loading}
          accessibilityLabel="Find booking"
        >
          Find
        </Button>
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
