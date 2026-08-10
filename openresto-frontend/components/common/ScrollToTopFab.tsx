import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ScrollToTopFab.styles";

/** Scroll distance past which the return-to-top shortcut is worth offering. */
const SHOW_AFTER_SCROLL_Y = 300;

interface Props {
  scrollY: number;
  onPress: () => void;
}

export default function ScrollToTopFab({ scrollY, onPress }: Props) {
  const { primaryColor } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Deliberately not gated on width or orientation. Every screen that mounts this
  // is long enough to bury its own header on a desktop window too, and the old
  // portrait-phone-only gate meant the wide layouts (which scroll furthest) were
  // the only ones without the shortcut.
  if (scrollY <= SHOW_AFTER_SCROLL_Y) return null;

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
