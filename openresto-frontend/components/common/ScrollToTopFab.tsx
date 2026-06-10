import { Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";

interface Props {
  scrollY: number;
  onPress: () => void;
}

export default function ScrollToTopFab({ scrollY, onPress }: Props) {
  const { width, height } = useWindowDimensions();
  const { primaryColor } = useAppTheme();
  const insets = useSafeAreaInsets();

  const isMobile = width < 700;
  const isPortrait = height > width;

  if (!isMobile || !isPortrait || scrollY <= 300) return null;

  return (
    <Pressable
      style={[styles.fab, { backgroundColor: primaryColor, bottom: insets.bottom + 20 }]}
      onPress={onPress}
      accessibilityLabel="Scroll to top"
      accessibilityRole="button"
    >
      <Ionicons name="chevron-up" size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
});
